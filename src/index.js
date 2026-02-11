// ---------------------------------------------------------------------------
// index.js — Zenith Router V0 Public API
// ---------------------------------------------------------------------------
// Seven exports. No more.
// ---------------------------------------------------------------------------

export { createRouter } from './router.js';
export { navigate, back, forward, getCurrentPath } from './navigate.js';
export { onRouteChange } from './events.js';
export { matchRoute } from './match.js';
