/**
 * Base Agent Class
 * 
 * Provides common functionality for all channel-specific agents.
 * Each agent is a specialized researcher that gathers information
 * about a specific topic or domain.
 */

import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import withTimeout from '../utils/timeout.js';

export class BaseAgent {
  /**
   * Create a new base agent
   * 
   * @param {string} name - Agent name
   * @param {string} description - Agent description
   * @param {Array} tools - LangChain tools the agent can use
   * @param {Object} options - Agent options
   */
  constructor(name, description, tools, options = {}) {
    this.name = name;
    this.description = description;
    this.tools = tools;
    this.options = {
      temperature: options.temperature || 0.3,
      timeout: options.timeout || config.agentTimeout,
      maxIterations: options.maxIterations || config.agentMaxIterations,
      ...options,
    };
    
    this.log = logger.child(`Agent:${name}`);
    this.executor = null;
  }

  /**
   * Initialize the agent executor
   * 
   * This creates the LangChain agent with the configured LLM and tools.
   */
  async initialize() {
    if (this.executor) {
      return; // Already initialized
    }

    this.log.info('Initializing agent', {
      tools: this.tools.map(t => t.name),
      temperature: this.options.temperature,
    });

    try {
      // Create LLM
      const llm = new ChatOpenAI({
        openAIApiKey: config.openaiApiKey,
        modelName: config.openaiModel,
        temperature: this.options.temperature,
        timeout: 30000, // 30 second timeout for LLM calls
      });

      // Pull ReAct prompt from LangChain Hub
      const prompt = await pull('hwchase17/react');

      // Create agent
      const agent = await createReactAgent({
        llm,
        tools: this.tools,
        prompt,
      });

      // Create custom callback handler for detailed logging and token tracking
      const agentLog = this.log;
      class AgentLoggingCallback extends BaseCallbackHandler {
        constructor() {
          super();
          this.tokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          };
        }

        async handleAgentAction(action) {
          agentLog.debug('Agent action', {
            tool: action.tool,
            toolInput: typeof action.toolInput === 'string' 
              ? action.toolInput.substring(0, 200) 
              : JSON.stringify(action.toolInput).substring(0, 200),
            log: action.log?.substring(0, 300), // Thought/reasoning
          });
          agentLog.info(`Agent reasoning: ${action.log?.substring(0, 150) || 'Thinking...'}`);
          agentLog.info(`Calling tool: ${action.tool}`);
        }

        async handleToolEnd(output) {
          const outputPreview = typeof output === 'string' 
            ? output.substring(0, 200) 
            : JSON.stringify(output).substring(0, 200);
          agentLog.debug('Tool execution complete', {
            outputLength: typeof output === 'string' ? output.length : JSON.stringify(output).length,
            outputPreview,
          });
          agentLog.info(`Tool execution complete`);
        }

        async handleAgentEnd(action) {
          agentLog.debug('Agent final action', {
            returnValues: action.returnValues,
          });
        }

        async handleLLMStart(llm, prompts) {
          agentLog.debug('LLM call starting', {
            model: llm?.constructor?.name || 'unknown',
            promptLength: prompts?.[0]?.length || 0,
            promptPreview: prompts?.[0]?.substring(0, 200),
          });
          agentLog.info(`LLM reasoning call starting...`);
        }

        async handleLLMEnd(output) {
          const text = output.generations?.[0]?.[0]?.text || '';
          
          // Extract token usage from OpenAI response - try multiple possible locations
          const usage = output.llmOutput?.tokenUsage || 
                       output.llmOutput?.usage ||
                       output.llmOutput?.estimatedTokenUsage ||
                       output.generations?.[0]?.[0]?.generationInfo?.usage;
          
          if (usage) {
            this.tokenUsage.promptTokens += usage.promptTokens || usage.prompt_tokens || 0;
            this.tokenUsage.completionTokens += usage.completionTokens || usage.completion_tokens || 0;
            this.tokenUsage.totalTokens += usage.totalTokens || usage.total_tokens || 0;
            
            agentLog.debug('LLM call complete', {
              outputLength: text.length,
              outputPreview: text.substring(0, 200),
              tokensUsed: usage.totalTokens || usage.total_tokens,
              runningTotal: this.tokenUsage.totalTokens,
            });
          } else {
            // Log the structure to help debug
            agentLog.debug('LLM call complete (no token usage found)', {
              outputLength: text.length,
              outputPreview: text.substring(0, 200),
              llmOutputKeys: output.llmOutput ? Object.keys(output.llmOutput) : 'no llmOutput',
            });
          }
          agentLog.info(`LLM reasoning call complete`);
        }

        async handleLLMError(err) {
          agentLog.error('LLM call failed', err);
        }

        async handleToolStart(tool, input) {
          agentLog.info(`Tool starting: ${tool.name}`);
          agentLog.debug('Tool input', {
            tool: tool.name,
            inputPreview: typeof input === 'string' ? input.substring(0, 200) : JSON.stringify(input).substring(0, 200),
          });
        }

        async handleToolError(err) {
          agentLog.error('Tool execution failed', err);
        }
      }

      // Store callback handler instance to access token usage
      this.callbackHandler = new AgentLoggingCallback();

      // Create executor with custom callback for detailed logging
      this.executor = new AgentExecutor({
        agent,
        tools: this.tools,
        verbose: true, // Always verbose for our custom logging
        maxIterations: this.options.maxIterations,
        handleParsingErrors: true,
        earlyStoppingMethod: 'force',
        maxExecutionTime: this.options.timeout,
        callbacks: [this.callbackHandler],
      });

      this.log.success('Agent initialized successfully');
    } catch (error) {
      this.log.error('Failed to initialize agent', error);
      throw error;
    }
  }

  /**
   * Execute the agent with a given prompt
   * 
   * @param {string} prompt - Task prompt for the agent
   * @returns {Promise<string>} Agent's response
   */
  async execute(prompt) {
    const startTime = Date.now();
    this.log.start(`Executing agent with prompt (${prompt.length} chars)`);

    // Ensure agent is initialized
    if (!this.executor) {
      await this.initialize();
    }

    // Reset token usage for this execution
    if (this.callbackHandler) {
      this.callbackHandler.tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    try {
      // Log execution start with heartbeat to track progress
      const heartbeatInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.floor(elapsed / 1000);
        if (elapsedSec % 5 === 0 && elapsedSec > 0) {
          this.log.info(`Agent still running... (${elapsedSec}s elapsed, ${Math.floor((this.options.timeout - elapsed) / 1000)}s remaining)`);
        }
      }, 1000);

      // Execute with timeout - create an AbortController for cleanup
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          clearInterval(heartbeatInterval);
          const error = new Error(`Agent ${this.name} timed out after ${this.options.timeout}ms`);
          error.code = 'TIMEOUT';
          reject(error);
        }, this.options.timeout);
      });

      this.log.info(`Starting agent execution (max ${this.options.timeout}ms, ${this.options.maxIterations} iterations)`);

      // Track token usage across all LLM calls in this execution
      let totalTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      const executionPromise = this.executor.invoke({
        input: prompt,
      });

      // Race between execution and timeout
      const response = await Promise.race([executionPromise, timeoutPromise]);
      
      // Clear timeout and heartbeat if we completed successfully
      clearTimeout(timeoutId);
      clearInterval(heartbeatInterval);

      const result = response.output || response;
      const duration = Date.now() - startTime;
      const resultLength = typeof result === 'string' ? result.length : JSON.stringify(result).length;

      // Try to get token usage from callback handler first (if it worked)
      let tokenUsage = this.callbackHandler?.tokenUsage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      // If callback handler has no tokens, check if response has usage metadata
      // Note: AgentExecutor doesn't expose individual LLM call metadata,
      // so we're logging this for awareness but can't capture it reliably
      if (tokenUsage.totalTokens === 0) {
        this.log.debug('No token usage captured from callbacks - AgentExecutor does not expose LLM call metadata');
      }

      this.log.success(`Agent completed successfully`, {
        duration: `${duration}ms`,
        outputLength: `${resultLength} chars`,
        totalTokens: tokenUsage.totalTokens,
      });

      // Return both output and token usage
      return {
        output: typeof result === 'string' ? result : result.output || JSON.stringify(result),
        tokenUsage,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log.error(`Agent failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Get agent metadata
   * 
   * @returns {Object} Agent metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      tools: this.tools.map(t => ({
        name: t.name,
        description: t.description,
      })),
      options: {
        temperature: this.options.temperature,
        timeout: this.options.timeout,
        maxIterations: this.options.maxIterations,
      },
      initialized: !!this.executor,
    };
  }
}

export default BaseAgent;

