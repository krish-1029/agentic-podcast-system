/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascade failures by tracking service health and temporarily
 * stopping requests to failing services. Implements three states:
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Service is failing, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */

import logger from './logger.js';
import config from '../config/config.js';

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.threshold = options.threshold || config.circuitBreakerThreshold;
    this.timeout = options.timeout || config.circuitBreakerTimeout;
    this.logger = logger.child(`CircuitBreaker:${serviceName}`);
    
    // State tracking
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = Date.now();
    this.successCount = 0;
  }

  /**
   * Execute operation through circuit breaker
   * 
   * @param {Function} operation - Async function to execute
   * @param {Function} fallback - Optional fallback function if circuit is open
   * @returns {Promise} Result of operation or fallback
   */
  async execute(operation, fallback = null) {
    // Check if circuit is open
    if (this.state === STATES.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.logger.warn(`Circuit OPEN, blocking request`, {
          service: this.serviceName,
          failures: this.failureCount,
          nextAttempt: new Date(this.nextAttemptTime).toISOString(),
        });
        
        if (fallback) {
          this.logger.info('Using fallback function');
          return await fallback();
        }
        
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      }
      
      // Time to test service recovery
      this.transitionToHalfOpen();
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // If we have a fallback and circuit just opened, use it
      if (fallback && this.state === STATES.OPEN) {
        this.logger.info('Circuit opened, using fallback');
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.successCount++;
    
    if (this.state === STATES.HALF_OPEN) {
      this.logger.success('Service recovered, closing circuit', {
        service: this.serviceName,
        successCount: this.successCount,
      });
      this.reset();
    } else if (this.state === STATES.CLOSED && this.failureCount > 0) {
      // Gradually reset failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed operation
   */
  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    this.logger.warn(`Operation failed`, {
      service: this.serviceName,
      failures: this.failureCount,
      threshold: this.threshold,
      error: error.message,
    });

    if (this.state === STATES.HALF_OPEN) {
      // Failed during recovery test, reopen circuit
      this.transitionToOpen();
    } else if (this.failureCount >= this.threshold) {
      // Threshold exceeded, open circuit
      this.transitionToOpen();
    }
  }

  /**
   * Transition to OPEN state
   */
  transitionToOpen() {
    this.state = STATES.OPEN;
    this.nextAttemptTime = Date.now() + this.timeout;
    
    this.logger.error(`Circuit breaker OPENED`, {
      service: this.serviceName,
      failures: this.failureCount,
      nextAttempt: new Date(this.nextAttemptTime).toISOString(),
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  transitionToHalfOpen() {
    this.state = STATES.HALF_OPEN;
    this.successCount = 0;
    
    this.logger.info(`Circuit breaker transitioning to HALF_OPEN`, {
      service: this.serviceName,
    });
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get current circuit breaker state
   */
  getState() {
    return {
      service: this.serviceName,
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailure: this.lastFailureTime 
        ? new Date(this.lastFailureTime).toISOString() 
        : null,
      nextAttempt: this.state === STATES.OPEN 
        ? new Date(this.nextAttemptTime).toISOString() 
        : null,
    };
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy() {
    return this.state === STATES.CLOSED;
  }
}

/**
 * Circuit Breaker Manager
 * 
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create circuit breaker for a service
   */
  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, options));
    }
    return this.breakers.get(serviceName);
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates() {
    const states = {};
    for (const [name, breaker] of this.breakers.entries()) {
      states[name] = breaker.getState();
    }
    return states;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Export singleton manager
export default new CircuitBreakerManager();

