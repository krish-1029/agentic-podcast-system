/**
 * Tool Observer
 * 
 * Lightweight pub/sub to trace tool requests and responses
 * during debugging and test runs.
 */

let observer = null;

/**
 * Set a global observer callback to receive tool events
 * 
 * @param {(event: object) => void} fn
 */
export function setToolObserver(fn) {
  observer = typeof fn === 'function' ? fn : null;
}

/**
 * Emit a tool event if an observer is registered
 * 
 * @param {object} event
 */
export function emitToolEvent(event) {
  if (!observer) return;
  try {
    observer({
      ts: new Date().toISOString(),
      ...event,
    });
  } catch {
    // best effort only
  }
}

export default {
  setToolObserver,
  emitToolEvent,
};


