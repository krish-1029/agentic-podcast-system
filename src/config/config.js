/**
 * Centralized Configuration Management
 * 
 * Loads configuration from environment variables with sensible defaults.
 * All API keys and settings are accessed through this single module.
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

class Config {
  constructor() {
    this.validateRequired();
  }

  // OpenAI Configuration
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY;
  }

  get openaiModel() {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  get openaiSynthesisModel() {
    return process.env.OPENAI_SYNTHESIS_MODEL || 'gpt-4o';
  }

  // Tavily Configuration (optional)
  get tavilyApiKey() {
    return process.env.TAVILY_API_KEY;
  }

  get hasTavilyKey() {
    return !!this.tavilyApiKey;
  }

  // ElevenLabs Configuration (optional)
  get elevenLabsApiKey() {
    return process.env.ELEVENLABS_API_KEY;
  }

  get hasElevenLabsKey() {
    return !!this.elevenLabsApiKey;
  }

  // Logging Configuration
  get logLevel() {
    return process.env.LOG_LEVEL || 'info';
  }

  // Agent Configuration
  get agentTimeout() {
    return parseInt(process.env.AGENT_TIMEOUT_MS || '45000', 10);
  }

  get agentMaxIterations() {
    return parseInt(process.env.AGENT_MAX_ITERATIONS || '6', 10);
  }

  get concurrencyLimit() {
    return parseInt(process.env.CONCURRENCY_LIMIT || '2', 10);
  }

  // Circuit Breaker Configuration
  get circuitBreakerThreshold() {
    return parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '3', 10);
  }

  get circuitBreakerTimeout() {
    return parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '60000', 10);
  }

  // Output Configuration
  get outputDir() {
    return process.env.OUTPUT_DIR || './output';
  }

  /**
   * Validate that required configuration is present
   */
  validateRequired() {
    if (!this.openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY is required. Please set it in your .env file or environment variables.'
      );
    }
  }

  /**
   * Get a summary of the current configuration
   */
  getSummary() {
    return {
      openai: {
        configured: !!this.openaiApiKey,
        model: this.openaiModel,
        synthesisModel: this.openaiSynthesisModel,
      },
      tavily: {
        configured: this.hasTavilyKey,
        fallbackEnabled: true,
      },
      elevenLabs: {
        configured: this.hasElevenLabsKey,
      },
      agent: {
        timeout: this.agentTimeout,
        maxIterations: this.agentMaxIterations,
        concurrency: this.concurrencyLimit,
      },
      circuitBreaker: {
        threshold: this.circuitBreakerThreshold,
        timeout: this.circuitBreakerTimeout,
      },
      output: {
        directory: this.outputDir,
      },
      logging: {
        level: this.logLevel,
      },
    };
  }
}

// Export singleton instance
export default new Config();

