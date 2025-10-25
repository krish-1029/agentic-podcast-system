/**
 * Channel Agent
 * 
 * A specialized agent that researches a specific content channel
 * (tech, finance, F1, etc.) and generates a focused report.
 */

import BaseAgent from './base-agent.js';
import { getAllToolsWithBudget } from '../tools/index.js';
import { getChannel } from './channel-registry.js';
import config from '../config/config.js';

export class ChannelAgent extends BaseAgent {
  /**
   * Create a new channel agent
   * 
   * @param {string} channelId - Channel identifier (tech, finance, f1, etc.)
   */
  constructor(channelId) {
    const channel = getChannel(channelId);
    
    if (!channel) {
      throw new Error(`Unknown channel: ${channelId}`);
    }

    // Create agent with channel-specific configuration
    super(
      channel.name,
      channel.description,
      // Enforce per-run tool budgets to avoid stalls while allowing focused research
      getAllToolsWithBudget({ searchMax: 3, scrapeMax: 1 }),
      {
        temperature: 0.3, // Lower temperature for more focused research
        // Respect configured iteration cap (no forced minimum)
        maxIterations: config.agentMaxIterations,
      }
    );

    this.channelId = channelId;
    this.channel = channel;
  }

  /**
   * Research the channel and generate a report
   * 
   * @param {Array} customRequests - User's custom requests/interests
   * @returns {Promise<Object>} Research report with metadata
   */
  async research(customRequests = []) {
    const startTime = Date.now();
    this.log.start(`Researching ${this.channelId} channel`);

    try {
      // Get channel-specific prompt
      const prompt = this.channel.getPrompt(customRequests);

      // Execute agent
      const report = await this.execute(prompt);

      const duration = Date.now() - startTime;

      this.log.success(`Research complete for ${this.channelId}`, {
        duration: `${duration}ms`,
        reportLength: `${report.length} chars`,
      });

      return {
        channelId: this.channelId,
        channelName: this.channel.name,
        report,
        duration,
        status: 'success',
        method: 'agent',
        timestamp: new Date().toISOString(),
        prompt,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.log.error(`Research failed for ${this.channelId} after ${duration}ms`, error);

      throw error;
    }
  }

  /**
   * Get channel metadata
   * 
   * @returns {Object} Channel metadata
   */
  getChannelInfo() {
    return {
      id: this.channelId,
      name: this.channel.name,
      description: this.channel.description,
      category: this.channel.category,
    };
  }
}

export default ChannelAgent;

