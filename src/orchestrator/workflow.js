/**
 * Podcast Generation Workflow
 * 
 * Orchestrates the entire podcast generation pipeline:
 * 1. Load user context (channels, preferences)
 * 2. Run channel agents in parallel
 * 3. Run custom request agent (if needed)
 * 4. Synthesize all reports into final script
 * 
 * This is the core coordinator that demonstrates the multi-agent pattern.
 */

import config from '../config/config.js';
import logger from '../utils/logger.js';
import { ProgressTracker } from './progress-tracker.js';
import { createChannelAgents, createCustomAgent } from '../agents/index.js';
import { deterministicChannelReport } from '../agents/deterministic-research.js';
import { planPodcast } from '../synthesis/planner.js';
import { writeSection as writeOneSection } from '../synthesis/writer.js';

const log = logger.child('Workflow');

export class PodcastWorkflow {
  constructor(userContext) {
    this.userContext = userContext;
    this.progress = new ProgressTracker();
    this.results = {
      channelReports: {},
      customReport: null,
      metadata: {
        tokenUsage: {
          agents: {},
          synthesis: {
            planner: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            writer: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          },
          total: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        },
      },
    };
  }

  /**
   * Register progress callback
   * 
   * @param {Function} callback - Progress callback function
   */
  onProgress(callback) {
    this.progress.onProgress(callback);
  }

  /**
   * Execute the complete workflow
   * 
   * @returns {Promise<Object>} Workflow results
   */
  async execute() {
    this.progress.start();
    log.start('Starting podcast generation workflow');

    try {
      // Stage 1: Validate context
      await this.validateContext();

      // Stage 2: Run channel agents
      await this.runChannelAgents();

      // Stage 3: Run custom agent (if needed)
      await this.runCustomAgent();

      // Stage 4: Plan and iteratively write script
      await this.planAndWriteScript();

      // Complete workflow
      this.progress.complete(this.results);
      log.complete('Workflow completed successfully');

      // Return results with summary
      return {
        ...this.results,
        summary: this.getResultsSummary(),
      };
    } catch (error) {
      this.progress.fail(error);
      log.error('Workflow failed', error);
      throw error;
    }
  }

  /**
   * Stage 1: Validate user context
   */
  async validateContext() {
    this.progress.beginStage('validate_context');

    const errors = this.userContext.getValidationErrors();
    
    if (errors.length > 0) {
      throw new Error(`Invalid user context: ${errors.join(', ')}`);
    }

    const context = this.userContext.getContext();
    this.results.metadata.context = context;

    log.info('User context validated', {
      channels: context.channels.length,
      customRequests: context.customRequests.length,
      setting: context.setting,
      duration: context.duration,
    });

    this.progress.completeStage({ valid: true });
  }

  /**
   * Stage 2: Run channel agents in parallel with concurrency control
   */
  async runChannelAgents() {
    const { channels, customRequests } = this.userContext.getContext();
    const deterministic = this.userContext.deterministic === true;

    if (channels.length === 0) {
      log.info('No channels specified, skipping channel agents');
      return;
    }

    this.progress.beginStage('run_channel_agents', {
      channels: channels.length,
    });

    try {
      let results;
      if (deterministic) {
        // Run deterministic pipeline per channel sequentially or with limited concurrency
        results = await this.executeDeterministicWithConcurrency(
          channels,
          customRequests,
          Math.min(config.concurrencyLimit, 5)
        );
      } else {
        // Create agents for all channels
        const agents = createChannelAgents(channels);
        log.info(`Created ${agents.length} channel agents`);
        // Execute agents with concurrency control
        results = await this.executeAgentsWithConcurrency(
          agents,
          customRequests,
          config.concurrencyLimit
        );
      }

      // Store results and aggregate token usage
      for (const result of results) {
        this.results.channelReports[result.channelId] = result;
        
        // Track agent token usage
        if (result.tokenUsage) {
          this.results.metadata.tokenUsage.agents[result.channelId] = result.tokenUsage;
        }
      }

      // Log summary
      const successCount = results.filter(r => r.status === 'success').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      log.info('Channel agents complete', {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      });

      this.progress.completeStage({
        totalAgents: results.length,
        successful: successCount,
        failed: failureCount,
      });
    } catch (error) {
      this.progress.failStage(error);
      throw error;
    }
  }

  /**
   * Execute agents with concurrency control
   * 
   * @param {Array} agents - Array of agent instances
   * @param {Array} customRequests - User custom requests
   * @param {number} concurrencyLimit - Max concurrent executions
   * @returns {Promise<Array>} Array of results
   */
  async executeAgentsWithConcurrency(agents, customRequests, concurrencyLimit) {
    const results = [];
    
    for (let i = 0; i < agents.length; i += concurrencyLimit) {
      const batch = agents.slice(i, i + concurrencyLimit);
      
      this.progress.updateProgress(
        `Processing agent batch ${Math.floor(i / concurrencyLimit) + 1}`,
        { agents: batch.map(a => a.channelId) }
      );

      // Execute batch in parallel
      const batchPromises = batch.map(agent =>
        this.executeAgentWithFallback(agent, customRequests)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Deterministic per-channel execution with concurrency control
   */
  async executeDeterministicWithConcurrency(channels, customRequests, concurrencyLimit) {
    const results = [];
    for (let i = 0; i < channels.length; i += concurrencyLimit) {
      const batch = channels.slice(i, i + concurrencyLimit);
      this.progress.updateProgress(
        `Processing deterministic batch ${Math.floor(i / concurrencyLimit) + 1}`,
        { channels: batch }
      );

      const batchPromises = batch.map(async (channelId) => {
        try {
          return await deterministicChannelReport(channelId, customRequests);
        } catch (error) {
          log.error(`Deterministic research failed for ${channelId}`, error);
          return {
            channelId,
            channelName: channelId,
            report: this.generateAgentFallback(channelId),
            duration: 0,
            status: 'failed',
            method: 'deterministic',
            error: error.message,
            timestamp: new Date().toISOString(),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * Execute a single agent with error handling and fallback
   * 
   * @param {Object} agent - Agent instance
   * @param {Array} customRequests - User custom requests
   * @returns {Promise<Object>} Agent result
   */
  async executeAgentWithFallback(agent, customRequests) {
    const startTime = Date.now();
    const channelId = agent.channelId;

    try {
      log.info(`Executing agent: ${channelId}`);
      
      const result = await agent.research(customRequests);
      
      log.success(`Agent ${channelId} completed`, {
        duration: `${result.duration}ms`,
        reportLength: result.report.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error(`Agent ${channelId} failed`, error, { duration: `${duration}ms` });

      // Return failure result with fallback content
      return {
        channelId,
        channelName: agent.channel.name,
        report: this.generateAgentFallback(channelId),
        duration,
        status: 'failed',
        method: 'fallback',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate fallback content for a failed agent
   * 
   * @param {string} channelId - Channel identifier
   * @returns {string} Fallback content
   */
  generateAgentFallback(channelId) {
    const fallbacks = {
      tech: 'Recent technology developments continue with focus on AI integration, cloud services, and developer tools. The software industry maintains rapid innovation across frameworks and platforms.',
      finance: 'Financial markets show mixed performance with ongoing attention to economic indicators and central bank policies. Investment strategies adapt to current market conditions.',
      f1: 'Formula 1 continues with competitive racing and strategic battles. Teams focus on performance optimization while championship standings evolve throughout the season.',
      science: 'Scientific research progresses across multiple disciplines with developments in medical research, environmental science, and technological innovation.',
      world_news: 'Global developments continue with focus on diplomatic efforts, economic progress, and international cooperation on shared challenges.',
    };

    return fallbacks[channelId] || 'Recent developments in this area continue to evolve with various factors influencing current trends.';
  }

  /**
   * Stage 3: Run custom request agent
   */
  async runCustomAgent() {
    const { customRequests } = this.userContext.getContext();

    if (!customRequests || customRequests.length === 0) {
      log.info('No custom requests specified, skipping custom agent');
      return;
    }

    this.progress.beginStage('run_custom_agent', {
      requests: customRequests.length,
    });

    try {
      const agent = createCustomAgent();
      log.info(`Created custom agent for ${customRequests.length} requests`);

      const result = await agent.research(customRequests);
      this.results.customReport = result;

      if (result.status === 'success') {
        log.success('Custom agent completed', {
          duration: `${result.duration}ms`,
          reportLength: result.report.length,
        });
      } else {
        log.info('Custom agent skipped (no requests)');
      }

      this.progress.completeStage({
        status: result.status,
        requests: customRequests.length,
      });
    } catch (error) {
      log.error('Custom agent failed', error);
      
      // Store failure but don't fail the workflow
      this.results.customReport = {
        report: '',
        requests: customRequests,
        duration: 0,
        status: 'failed',
        method: 'fallback',
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      this.progress.completeStage({ status: 'failed', error: error.message });
    }
  }

  /**
   * Stage 4: Plan and iteratively write the final script
   */
  async planAndWriteScript() {
    const { setting, duration } = this.userContext.getContext();
    this.progress.beginStage('plan_and_write');

    try {
      const { plan, raw, tokenUsage: plannerTokens } = await planPodcast({
        channelReports: this.results.channelReports,
        customReport: this.results.customReport,
        setting,
        duration,
      });

      // Track planner tokens
      this.results.metadata.tokenUsage.synthesis.planner = plannerTokens;

      let script = '';
      for (const section of plan.sections) {
        const { text: sectionText, tokenUsage: sectionTokens } = await writeOneSection({
          plan,
          section,
          setting,
          currentScript: script,
          channelReports: this.results.channelReports,
        });
        
        // Accumulate writer tokens
        this.results.metadata.tokenUsage.synthesis.writer.promptTokens += sectionTokens.promptTokens;
        this.results.metadata.tokenUsage.synthesis.writer.completionTokens += sectionTokens.completionTokens;
        this.results.metadata.tokenUsage.synthesis.writer.totalTokens += sectionTokens.totalTokens;
        
        script = script ? `${script}\n\n${sectionText}` : sectionText;
        this.progress.updateProgress(`Wrote section: ${section.id}`, { title: section.title, words: section.approx_words });
      }

      this.results.finalScript = script;
      this.results.plan = plan;
      this.results.planRaw = raw;
      this.progress.completeStage({ sections: plan.sections.length });
    } catch (error) {
      this.progress.failStage(error);
      throw error;
    }
  }

  /**
   * Get workflow results
   * 
   * @returns {Object} Complete workflow results
   */
  getResults() {
    // Calculate total token usage
    this.calculateTotalTokenUsage();
    
    return {
      ...this.results,
      summary: this.getResultsSummary(),
    };
  }

  /**
   * Calculate and update total token usage across all components
   */
  calculateTotalTokenUsage() {
    const total = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    
    // Sum agent tokens
    for (const channelId in this.results.metadata.tokenUsage.agents) {
      const usage = this.results.metadata.tokenUsage.agents[channelId];
      total.promptTokens += usage.promptTokens || 0;
      total.completionTokens += usage.completionTokens || 0;
      total.totalTokens += usage.totalTokens || 0;
    }
    
    // Sum synthesis tokens (planner + writer)
    const planner = this.results.metadata.tokenUsage.synthesis.planner;
    const writer = this.results.metadata.tokenUsage.synthesis.writer;
    
    total.promptTokens += planner.promptTokens + writer.promptTokens;
    total.completionTokens += planner.completionTokens + writer.completionTokens;
    total.totalTokens += planner.totalTokens + writer.totalTokens;
    
    this.results.metadata.tokenUsage.total = total;
  }

  /**
   * Get results summary
   * 
   * @returns {Object} Results summary
   */
  getResultsSummary() {
    const channelResults = Object.values(this.results.channelReports);
    
    return {
      totalChannels: channelResults.length,
      successfulChannels: channelResults.filter(r => r.status === 'success').length,
      failedChannels: channelResults.filter(r => r.status === 'failed').length,
      customRequestStatus: this.results.customReport?.status || 'none',
      totalReportLength: channelResults.reduce((sum, r) => sum + (r.report?.length || 0), 0) +
                         (this.results.customReport?.report?.length || 0),
    };
  }
}

/**
 * Create and execute workflow
 * 
 * @param {UserContext} userContext - User context
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Object>} Workflow results
 */
export async function executeWorkflow(userContext, progressCallback = null) {
  const workflow = new PodcastWorkflow(userContext);
  
  if (progressCallback) {
    workflow.onProgress(progressCallback);
  }

  return await workflow.execute();
}

export default {
  PodcastWorkflow,
  executeWorkflow,
};

