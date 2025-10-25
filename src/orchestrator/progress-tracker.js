/**
 * Progress Tracker
 * 
 * Tracks and reports progress through the podcast generation pipeline.
 * Provides callbacks for UI updates and logging.
 */

import logger from '../utils/logger.js';

export class ProgressTracker {
  constructor() {
    this.log = logger.child('Progress');
    this.stages = [];
    this.currentStage = null;
    this.startTime = null;
    this.callbacks = [];
  }

  /**
   * Register a progress callback
   * 
   * @param {Function} callback - Callback function(stage, progress, data)
   */
  onProgress(callback) {
    this.callbacks.push(callback);
  }

  /**
   * Start tracking
   */
  start() {
    this.startTime = Date.now();
    this.stages = [];
    this.currentStage = null;
    this.emit('start', { timestamp: new Date().toISOString() });
  }

  /**
   * Begin a new stage
   * 
   * @param {string} name - Stage name
   * @param {Object} data - Additional stage data
   */
  beginStage(name, data = {}) {
    const stage = {
      name,
      status: 'in_progress',
      startTime: Date.now(),
      endTime: null,
      duration: null,
      data,
    };

    this.stages.push(stage);
    this.currentStage = stage;

    this.log.start(`Starting stage: ${name}`, data);
    this.emit('stage_start', { stage: name, ...data });
  }

  /**
   * Complete the current stage
   * 
   * @param {Object} result - Stage result data
   */
  completeStage(result = {}) {
    if (!this.currentStage) {
      this.log.warn('No active stage to complete');
      return;
    }

    this.currentStage.status = 'completed';
    this.currentStage.endTime = Date.now();
    this.currentStage.duration = this.currentStage.endTime - this.currentStage.startTime;
    this.currentStage.result = result;

    this.log.success(`Completed stage: ${this.currentStage.name}`, {
      duration: `${this.currentStage.duration}ms`,
    });

    this.emit('stage_complete', {
      stage: this.currentStage.name,
      duration: this.currentStage.duration,
      ...result,
    });

    this.currentStage = null;
  }

  /**
   * Fail the current stage
   * 
   * @param {Error} error - Error that caused the failure
   */
  failStage(error) {
    if (!this.currentStage) {
      this.log.warn('No active stage to fail');
      return;
    }

    this.currentStage.status = 'failed';
    this.currentStage.endTime = Date.now();
    this.currentStage.duration = this.currentStage.endTime - this.currentStage.startTime;
    this.currentStage.error = {
      message: error.message,
      stack: error.stack,
    };

    this.log.error(`Stage failed: ${this.currentStage.name}`, error, {
      duration: `${this.currentStage.duration}ms`,
    });

    this.emit('stage_failed', {
      stage: this.currentStage.name,
      duration: this.currentStage.duration,
      error: error.message,
    });

    this.currentStage = null;
  }

  /**
   * Update progress within a stage
   * 
   * @param {string} message - Progress message
   * @param {Object} data - Progress data
   */
  updateProgress(message, data = {}) {
    this.log.info(message, data);
    this.emit('progress', { message, ...data });
  }

  /**
   * Complete tracking
   * 
   * @param {Object} finalResult - Final results
   */
  complete(finalResult = {}) {
    const totalDuration = Date.now() - this.startTime;

    this.log.complete('Pipeline complete', {
      totalDuration: `${totalDuration}ms`,
      stages: this.stages.length,
    });

    this.emit('complete', {
      totalDuration,
      stages: this.stages.length,
      ...finalResult,
    });
  }

  /**
   * Fail tracking
   * 
   * @param {Error} error - Error that caused the failure
   */
  fail(error) {
    const totalDuration = Date.now() - this.startTime;

    this.log.error('Pipeline failed', error, {
      totalDuration: `${totalDuration}ms`,
      completedStages: this.stages.filter(s => s.status === 'completed').length,
      totalStages: this.stages.length,
    });

    this.emit('failed', {
      totalDuration,
      error: error.message,
      completedStages: this.stages.filter(s => s.status === 'completed').length,
      totalStages: this.stages.length,
    });
  }

  /**
   * Emit event to all callbacks
   * 
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    for (const callback of this.callbacks) {
      try {
        callback(event, data);
      } catch (error) {
        this.log.error('Progress callback failed', error);
      }
    }
  }

  /**
   * Get progress summary
   * 
   * @returns {Object} Progress summary
   */
  getSummary() {
    return {
      startTime: this.startTime ? new Date(this.startTime).toISOString() : null,
      currentStage: this.currentStage?.name || null,
      stages: this.stages.map(s => ({
        name: s.name,
        status: s.status,
        duration: s.duration,
      })),
      totalDuration: this.startTime ? Date.now() - this.startTime : 0,
    };
  }
}

export default ProgressTracker;

