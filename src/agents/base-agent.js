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

      // Create executor
      this.executor = new AgentExecutor({
        agent,
        tools: this.tools,
        verbose: config.logLevel === 'debug',
        maxIterations: this.options.maxIterations,
        handleParsingErrors: true,
        earlyStoppingMethod: 'force',
        maxExecutionTime: this.options.timeout,
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

    try {
      // Execute with timeout - create an AbortController for cleanup
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(`Agent ${this.name} timed out after ${this.options.timeout}ms`);
          error.code = 'TIMEOUT';
          reject(error);
        }, this.options.timeout);
      });

      const executionPromise = this.executor.invoke({
        input: prompt,
      });

      // Race between execution and timeout
      const response = await Promise.race([executionPromise, timeoutPromise]);
      
      // Clear timeout if we completed successfully
      clearTimeout(timeoutId);

      const result = response.output || response;
      const duration = Date.now() - startTime;
      const resultLength = typeof result === 'string' ? result.length : JSON.stringify(result).length;

      this.log.success(`Agent completed successfully`, {
        duration: `${duration}ms`,
        outputLength: `${resultLength} chars`,
      });

      return typeof result === 'string' ? result : result.output || JSON.stringify(result);
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

