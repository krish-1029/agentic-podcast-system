/**
 * Retry Logic with Exponential Backoff
 * 
 * Automatically retries failed operations with increasing delays
 * between attempts to handle transient failures gracefully.
 */

import logger from './logger.js';

/**
 * Retry an async operation with exponential backoff
 * 
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry configuration
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Initial delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {Function} options.onRetry - Callback function called before each retry
 * @param {string} options.context - Context string for logging
 * @returns {Promise} Result of successful operation
 */
export async function retry(operation, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry = null,
    context = 'Operation',
  } = options;

  const log = logger.child('Retry');
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 0) {
        log.success(`${context} succeeded on attempt ${attempt + 1}/${maxRetries}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry if this was the last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      log.warn(`${context} failed (attempt ${attempt + 1}/${maxRetries})`, {
        error: error.message,
        nextRetryIn: `${delay}ms`,
      });

      // Call onRetry callback if provided
      if (onRetry) {
        try {
          await onRetry(attempt + 1, error);
        } catch (callbackError) {
          log.warn('onRetry callback failed', { error: callbackError.message });
        }
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  log.error(`${context} failed after ${maxRetries} attempts`, lastError);
  throw lastError;
}

/**
 * Retry with custom conditions
 * 
 * @param {Function} operation - Async function to retry
 * @param {Function} shouldRetry - Function that determines if error should be retried
 * @param {Object} options - Retry configuration
 * @returns {Promise} Result of successful operation
 */
export async function retryIf(operation, shouldRetry, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    context = 'Operation',
  } = options;

  const log = logger.child('RetryIf');
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 0) {
        log.success(`${context} succeeded on attempt ${attempt + 1}/${maxRetries}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      const shouldRetryError = await shouldRetry(error, attempt);
      
      if (!shouldRetryError || attempt === maxRetries - 1) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      log.warn(`${context} failed, retrying`, {
        attempt: attempt + 1,
        maxRetries,
        error: error.message,
        delay: `${delay}ms`,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Common retry predicates
 */
export const retryPredicates = {
  /**
   * Retry on network errors
   */
  isNetworkError: (error) => {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.message.includes('network') ||
      error.message.includes('fetch')
    );
  },

  /**
   * Retry on rate limit errors (HTTP 429)
   */
  isRateLimitError: (error) => {
    return error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED';
  },

  /**
   * Retry on server errors (HTTP 5xx)
   */
  isServerError: (error) => {
    return error.status >= 500 && error.status < 600;
  },

  /**
   * Retry on transient errors (network, rate limit, or server errors)
   */
  isTransientError: (error) => {
    return (
      retryPredicates.isNetworkError(error) ||
      retryPredicates.isRateLimitError(error) ||
      retryPredicates.isServerError(error)
    );
  },
};

export default retry;

