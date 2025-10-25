/**
 * Agent Factory
 * 
 * Centralized factory for creating agents.
 * Provides a clean interface for instantiating different agent types.
 */

import { ChannelAgent } from './channel-agent.js';
import { CustomAgent } from './custom-agent.js';
import { hasChannel } from './channel-registry.js';
import logger from '../utils/logger.js';

const log = logger.child('AgentFactory');

/**
 * Create a channel agent
 * 
 * @param {string} channelId - Channel identifier
 * @returns {ChannelAgent} Channel agent instance
 */
export function createChannelAgent(channelId) {
  if (!hasChannel(channelId)) {
    throw new Error(`Unknown channel: ${channelId}. Check channel registry.`);
  }

  log.debug(`Creating channel agent: ${channelId}`);
  return new ChannelAgent(channelId);
}

/**
 * Create a custom request agent
 * 
 * @returns {CustomAgent} Custom agent instance
 */
export function createCustomAgent() {
  log.debug('Creating custom request agent');
  return new CustomAgent();
}

/**
 * Create multiple channel agents at once
 * 
 * @param {Array<string>} channelIds - Array of channel identifiers
 * @returns {Array<ChannelAgent>} Array of channel agents
 */
export function createChannelAgents(channelIds) {
  log.info(`Creating ${channelIds.length} channel agents`, { channels: channelIds });
  
  return channelIds.map(channelId => {
    try {
      return createChannelAgent(channelId);
    } catch (error) {
      log.error(`Failed to create agent for ${channelId}`, error);
      throw error;
    }
  });
}

export default {
  createChannelAgent,
  createCustomAgent,
  createChannelAgents,
};

