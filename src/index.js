/**
 * Main Entry Point for Programmatic API
 * 
 * This file exports the main functions for using the system programmatically
 * (not via CLI). Useful for integrating into other applications.
 */

// Core orchestration
export { executeWorkflow, PodcastWorkflow } from './orchestrator/workflow.js';
export { createUserContext, UserContext } from './orchestrator/user-context.js';
export { ProgressTracker } from './orchestrator/progress-tracker.js';

// Agents
export {
  createChannelAgent,
  createCustomAgent,
  createChannelAgents,
  getAllChannels,
  getChannel,
  hasChannel,
} from './agents/index.js';

// Synthesis
export {
  synthesizeScript,
  EditorInChief,
  getSetting,
  getAllSettings,
  hasSetting,
} from './synthesis/index.js';

// Audio generation
export {
  generateAudio,
  AudioGenerator,
  getVoiceConfig,
} from './audio/index.js';

// Tools
export {
  search,
  scrape,
  getAllTools,
} from './tools/index.js';

// Utilities
export { default as config } from './config/config.js';
export { default as logger } from './utils/logger.js';
export { default as circuitBreakerManager } from './utils/circuit-breaker.js';
export { retry } from './utils/retry.js';
export { withTimeout } from './utils/timeout.js';

/**
 * Example usage:
 * 
 * import { createUserContext, executeWorkflow, synthesizeScript } from 'agentic-podcast-system';
 * 
 * const context = createUserContext({
 *   channels: ['tech', 'finance'],
 *   customRequests: ['latest AI developments'],
 *   setting: 'morning_routine',
 *   duration: 5,
 * });
 * 
 * const workflowResults = await executeWorkflow(context);
 * const script = await synthesizeScript(workflowResults, context.getContext());
 * 
 * console.log('Generated script:', script);
 */

