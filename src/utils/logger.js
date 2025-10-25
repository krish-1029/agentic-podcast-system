/**
 * Structured Logging Utility
 * 
 * Provides consistent logging across the application with levels,
 * timestamps, and structured data support.
 */

import chalk from 'chalk';
import config from '../config/config.js';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.level = LOG_LEVELS[config.logLevel] || LOG_LEVELS.info;
  }

  /**
   * Create a child logger with a specific context
   */
  child(context) {
    return new Logger(`${this.context}:${context}`);
  }

  /**
   * Format timestamp for log entries
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with context and timestamp
   */
  formatMessage(level, message, data) {
    const timestamp = chalk.gray(this.getTimestamp());
    const ctx = chalk.cyan(`[${this.context}]`);
    const lvl = this.getLevelColor(level)(`[${level.toUpperCase()}]`);
    
    let formatted = `${timestamp} ${lvl} ${ctx} ${message}`;
    
    if (data && Object.keys(data).length > 0) {
      formatted += '\n' + JSON.stringify(data, null, 2);
    }
    
    return formatted;
  }

  /**
   * Get appropriate chalk color for log level
   */
  getLevelColor(level) {
    switch (level) {
      case 'debug':
        return chalk.gray;
      case 'info':
        return chalk.blue;
      case 'warn':
        return chalk.yellow;
      case 'error':
        return chalk.red;
      default:
        return chalk.white;
    }
  }

  /**
   * Log at debug level
   */
  debug(message, data = {}) {
    if (this.level <= LOG_LEVELS.debug) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  /**
   * Log at info level
   */
  info(message, data = {}) {
    if (this.level <= LOG_LEVELS.info) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  /**
   * Log at warn level
   */
  warn(message, data = {}) {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  /**
   * Log at error level
   */
  error(message, error = null, data = {}) {
    if (this.level <= LOG_LEVELS.error) {
      const errorData = error ? {
        ...data,
        error: {
          message: error.message,
          stack: error.stack,
          ...error,
        },
      } : data;
      
      console.error(this.formatMessage('error', message, errorData));
    }
  }

  /**
   * Log progress/status with emoji
   */
  progress(emoji, message, data = {}) {
    if (this.level <= LOG_LEVELS.info) {
      const timestamp = chalk.gray(this.getTimestamp());
      const ctx = chalk.cyan(`[${this.context}]`);
      console.log(`${timestamp} ${emoji}  ${ctx} ${message}`);
      
      if (data && Object.keys(data).length > 0) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }
  }

  /**
   * Log success message
   */
  success(message, data = {}) {
    this.progress('✅', chalk.green(message), data);
  }

  /**
   * Log failure message
   */
  failure(message, data = {}) {
    this.progress('❌', chalk.red(message), data);
  }

  /**
   * Log start of operation
   */
  start(message, data = {}) {
    this.progress('🚀', message, data);
  }

  /**
   * Log completion of operation
   */
  complete(message, data = {}) {
    this.progress('🎉', chalk.green(message), data);
  }
}

// Export default logger instance
export default new Logger();

// Export Logger class for creating child loggers
export { Logger };

