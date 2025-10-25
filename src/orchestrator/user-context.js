/**
 * User Context Manager
 * 
 * Manages user preferences and subscriptions for personalized content.
 * In the standalone version, this uses simple in-memory storage or JSON files.
 */

import logger from '../utils/logger.js';
import { hasChannel } from '../agents/channel-registry.js';

const log = logger.child('UserContext');

/**
 * User context with subscriptions and preferences
 */
export class UserContext {
  constructor() {
    this.channels = [];
    this.customRequests = [];
    this.setting = 'morning_routine';
    this.duration = 5;
    this.deterministic = false;
  }

  /**
   * Set user's channel subscriptions
   * 
   * @param {Array<string>} channels - Array of channel IDs
   */
  setChannels(channels) {
    // Validate channels
    const validChannels = channels.filter(channelId => {
      if (!hasChannel(channelId)) {
        log.warn(`Invalid channel: ${channelId}`);
        return false;
      }
      return true;
    });

    this.channels = validChannels;
    log.info('Channels set', { channels: validChannels });
  }

  /**
   * Set custom requests
   * 
   * @param {Array<string>} requests - Array of custom request strings
   */
  setCustomRequests(requests) {
    this.customRequests = requests || [];
    log.info('Custom requests set', { count: this.customRequests.length });
  }

  /**
   * Set podcast setting
   * 
   * @param {string} setting - Setting type (morning_routine, workout, etc.)
   */
  setSetting(setting) {
    this.setting = setting;
    log.info('Setting configured', { setting });
  }

  /**
   * Set podcast duration
   * 
   * @param {number} duration - Duration in minutes
   */
  setDuration(duration) {
    this.duration = duration;
    log.info('Duration configured', { duration: `${duration} minutes` });
  }

  /**
   * Get full user context
   * 
   * @returns {Object} User context object
   */
  getContext() {
    return {
      channels: this.channels,
      customRequests: this.customRequests,
      setting: this.setting,
      duration: this.duration,
      deterministic: this.deterministic,
    };
  }

  /**
   * Validate context is complete
   * 
   * @returns {boolean} True if context is valid
   */
  isValid() {
    return this.channels.length > 0 || this.customRequests.length > 0;
  }

  /**
   * Get validation errors
   * 
   * @returns {Array<string>} Array of validation error messages
   */
  getValidationErrors() {
    const errors = [];

    if (this.channels.length === 0 && this.customRequests.length === 0) {
      errors.push('At least one channel or custom request is required');
    }

    if (this.duration < 1 || this.duration > 30) {
      errors.push('Duration must be between 1 and 30 minutes');
    }

    return errors;
  }
}

/**
 * Create user context from options
 * 
 * @param {Object} options - Context options
 * @param {Array<string>} options.channels - Channel subscriptions
 * @param {Array<string>} options.customRequests - Custom requests
 * @param {string} options.setting - Podcast setting
 * @param {number} options.duration - Duration in minutes
 * @returns {UserContext} User context instance
 */
export function createUserContext(options = {}) {
  const context = new UserContext();

  if (options.channels) {
    context.setChannels(options.channels);
  }

  if (options.customRequests) {
    context.setCustomRequests(options.customRequests);
  }

  if (options.setting) {
    context.setSetting(options.setting);
  }

  if (options.duration !== undefined) {
    context.setDuration(options.duration);
  }

  if (options.deterministic !== undefined) {
    context.deterministic = !!options.deterministic;
    log.info('Deterministic mode', { deterministic: context.deterministic });
  }

  return context;
}

export default {
  UserContext,
  createUserContext,
};

