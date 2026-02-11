// ---------------------------------------------------------------------------
// events.js — Zenith Router V0
// ---------------------------------------------------------------------------
// Route change event system.
//
// Subscribers receive route change notifications.
// Returns unsubscribe function.
// No batching. No queue. Synchronous dispatch.
// ---------------------------------------------------------------------------

/** @type {Set<(detail: object) => void>} */
const _subscribers = new Set();

/**
 * Subscribe to route change events.
 *
 * @param {(detail: { path: string, params?: Record<string, string>, matched: boolean }) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onRouteChange(callback) {
    _subscribers.add(callback);

    return () => {
        _subscribers.delete(callback);
    };
}

/**
 * Dispatch a route change to all subscribers.
 *
 * @param {{ path: string, params?: Record<string, string>, matched: boolean }} detail
 */
export function _dispatchRouteChange(detail) {
    for (const cb of _subscribers) {
        cb(detail);
    }
}

/**
 * Clear all subscribers. Used for testing and teardown.
 */
export function _clearSubscribers() {
    _subscribers.clear();
}

/**
 * Get the current subscriber count. Used for leak detection.
 *
 * @returns {number}
 */
export function _getSubscriberCount() {
    return _subscribers.size;
}
