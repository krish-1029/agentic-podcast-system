/**
 * Agents Module - Central export for all agent types
 * 
 * This module provides a unified interface to the agent system.
 */

import BaseAgent from './base-agent.js';
import { ChannelAgent } from './channel-agent.js';
import { CustomAgent } from './custom-agent.js';
import {
  CHANNELS,
  getAllChannels,
  getChannel,
  hasChannel,
} from './channel-registry.js';
import {
  createChannelAgent,
  createCustomAgent,
  createChannelAgents,
} from './agent-factory.js';

export {
  // Base classes
  BaseAgent,
  ChannelAgent,
  CustomAgent,
  
  // Channel registry
  CHANNELS,
  getAllChannels,
  getChannel,
  hasChannel,
  
  // Factory functions
  createChannelAgent,
  createCustomAgent,
  createChannelAgents,
};

export default {
  BaseAgent,
  ChannelAgent,
  CustomAgent,
  CHANNELS,
  getAllChannels,
  getChannel,
  hasChannel,
  createChannelAgent,
  createCustomAgent,
  createChannelAgents,
};

