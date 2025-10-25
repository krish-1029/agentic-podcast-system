/**
 * Timeout Wrapper Utilities
 * 
 * Ensures operations don't hang indefinitely by wrapping them
 * with timeout promises.
 */

import logger from './logger.js';

/**
 * Wrap an async operation with a timeout
 * 
 * @param {Function} operation - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} context - Context string for error messages
 * @returns {Promise} Result of operation or timeout error
 */
export async function withTimeout(operation, timeoutMs, context = 'Operation') {
  const log = logger.child('Timeout');

  let timeoutId;
  let didTimeout = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      const error = new Error(`${context} timed out after ${timeoutMs}ms`);
      error.code = 'TIMEOUT';
      error.timeout = timeoutMs;
      log.error(`${context} timed out`, null, { timeout: timeoutMs });
      reject(error);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      (async () => {
        const val = await operation();
        if (timeoutId && !didTimeout) {
          clearTimeout(timeoutId);
        }
        return val;
      })(),
      timeoutPromise,
    ]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Wrap an operation with timeout and fallback
 * 
 * @param {Function} operation - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Function} fallback - Fallback function if operation times out
 * @param {string} context - Context string for error messages
 * @returns {Promise} Result of operation or fallback
 */
export async function withTimeoutAndFallback(
  operation,
  timeoutMs,
  fallback,
  context = 'Operation'
) {
  const log = logger.child('Timeout');

  try {
    return await withTimeout(operation, timeoutMs, context);
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      log.warn(`${context} timed out, using fallback`, { timeout: timeoutMs });
      return await fallback();
    }
    throw error;
  }
}

/**
 * Create a timeout wrapper function with predefined timeout
 * 
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Timeout wrapper function
 */
export function createTimeoutWrapper(timeoutMs) {
  return async (operation, context = 'Operation') => {
    return withTimeout(operation, timeoutMs, context);
  };
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error) {
  return error && error.code === 'TIMEOUT';
}

export default withTimeout;

