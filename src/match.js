// ---------------------------------------------------------------------------
// match.js — Zenith Router V0
// ---------------------------------------------------------------------------
// Deterministic path matching engine.
//
// Algorithm:
//   1. Split pathname and route path by '/'
//   2. If segment counts differ → no match
//   3. Walk segments:
//      - ':param' → extract value into params object
//      - literal  → exact string comparison
//   4. First-match-wins (caller iterates in order)
//
// No regex. No wildcards. No optional segments.
// ---------------------------------------------------------------------------

/**
 * @typedef {{ path: string, load: Function }} RouteEntry
 * @typedef {{ route: RouteEntry, params: Record<string, string> }} MatchResult
 */

/**
 * Match a pathname against a single route definition.
 *
 * @param {string} routePath - The route pattern (e.g. '/users/:id')
 * @param {string} pathname  - The actual URL path (e.g. '/users/42')
 * @returns {{ matched: boolean, params: Record<string, string> }}
 */
export function matchPath(routePath, pathname) {
    const routeSegments = _splitPath(routePath);
    const pathSegments = _splitPath(pathname);

    // Segment count must match exactly
    if (routeSegments.length !== pathSegments.length) {
        return { matched: false, params: {} };
    }

    const params = {};
    const seenParamNames = new Set();

    for (let i = 0; i < routeSegments.length; i++) {
        const routeSeg = routeSegments[i];
        const pathSeg = pathSegments[i];

        if (routeSeg.startsWith(':')) {
            // Dynamic param — extract value as string
            const paramName = routeSeg.slice(1);
            if (!_isValidParamName(paramName)) {
                return { matched: false, params: {} };
            }
            if (seenParamNames.has(paramName)) {
                return { matched: false, params: {} };
            }
            seenParamNames.add(paramName);
            params[paramName] = pathSeg;
        } else if (routeSeg !== pathSeg) {
            // Literal mismatch
            return { matched: false, params: {} };
        }
    }

    return { matched: true, params };
}

/**
 * Match a pathname against an ordered array of route definitions.
 * Returns the first match (deterministic, first-match-wins).
 *
 * @param {RouteEntry[]} routes - Ordered route manifest
 * @param {string} pathname     - The URL path to match
 * @returns {MatchResult | null}
 */
export function matchRoute(routes, pathname) {
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const result = matchPath(route.path, pathname);

        if (result.matched) {
            return { route, params: result.params };
        }
    }

    return null;
}

/**
 * Split a path string into non-empty segments.
 *
 * @param {string} path
 * @returns {string[]}
 */
function _splitPath(path) {
    return path.split('/').filter(Boolean);
}

/**
 * Validate a dynamic segment param name.
 *
 * V0 constraints:
 * - ASCII identifier style only
 * - no optional marker '?'
 * - no wildcard or regex syntax
 *
 * @param {string} name
 * @returns {boolean}
 */
function _isValidParamName(name) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
