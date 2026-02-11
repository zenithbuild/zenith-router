// ---------------------------------------------------------------------------
// match.spec.js — Path matching tests
// ---------------------------------------------------------------------------

import { matchPath, matchRoute } from '../src/match.js';

describe('matchPath', () => {
    test('exact root match', () => {
        const result = matchPath('/', '/');
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({});
    });

    test('exact static path match', () => {
        const result = matchPath('/about', '/about');
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({});
    });

    test('exact nested static path match', () => {
        const result = matchPath('/docs/api/reference', '/docs/api/reference');
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({});
    });

    test('no match on different segment', () => {
        const result = matchPath('/about', '/contact');
        expect(result.matched).toBe(false);
    });

    test('no match on different segment count', () => {
        const result = matchPath('/users/:id', '/users');
        expect(result.matched).toBe(false);
    });

    test('no match on extra trailing segment', () => {
        const result = matchPath('/users', '/users/123');
        expect(result.matched).toBe(false);
    });

    test('single param extraction', () => {
        const result = matchPath('/users/:id', '/users/42');
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ id: '42' });
    });

    test('multiple param extraction', () => {
        const result = matchPath('/users/:userId/posts/:postId', '/users/7/posts/99');
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ userId: '7', postId: '99' });
    });

    test('params are always strings', () => {
        const result = matchPath('/items/:id', '/items/123');
        expect(result.matched).toBe(true);
        expect(typeof result.params.id).toBe('string');
    });

    test('param with special characters in value', () => {
        const result = matchPath('/search/:query', '/search/hello%20world');
        expect(result.matched).toBe(true);
        expect(result.params).toEqual({ query: 'hello%20world' });
    });

    test('trailing slash normalization', () => {
        const result = matchPath('/about/', '/about');
        expect(result.matched).toBe(true);
    });

    test('empty path segments are filtered', () => {
        const result = matchPath('//about//', '/about');
        expect(result.matched).toBe(true);
    });
});

describe('matchRoute', () => {
    const routes = [
        { path: '/', load: () => { } },
        { path: '/about', load: () => { } },
        { path: '/users/new', load: () => { } },
        { path: '/users/:id', load: () => { } },
        { path: '/posts/:id/comments/:commentId', load: () => { } }
    ];

    test('matches root route', () => {
        const result = matchRoute(routes, '/');
        expect(result).not.toBeNull();
        expect(result.route.path).toBe('/');
        expect(result.params).toEqual({});
    });

    test('matches static route', () => {
        const result = matchRoute(routes, '/about');
        expect(result).not.toBeNull();
        expect(result.route.path).toBe('/about');
    });

    test('static route beats dynamic (ordering)', () => {
        const result = matchRoute(routes, '/users/new');
        expect(result).not.toBeNull();
        expect(result.route.path).toBe('/users/new');
        expect(result.params).toEqual({});
    });

    test('dynamic route extracts params', () => {
        const result = matchRoute(routes, '/users/42');
        expect(result).not.toBeNull();
        expect(result.route.path).toBe('/users/:id');
        expect(result.params).toEqual({ id: '42' });
    });

    test('nested params extraction', () => {
        const result = matchRoute(routes, '/posts/5/comments/12');
        expect(result).not.toBeNull();
        expect(result.params).toEqual({ id: '5', commentId: '12' });
    });

    test('returns null for unmatched path', () => {
        const result = matchRoute(routes, '/nonexistent');
        expect(result).toBeNull();
    });

    test('returns null for empty routes array', () => {
        const result = matchRoute([], '/anything');
        expect(result).toBeNull();
    });

    test('first-match-wins determinism', () => {
        const ambiguous = [
            { path: '/a/:x', load: () => { } },
            { path: '/a/:y', load: () => { } }
        ];
        const result = matchRoute(ambiguous, '/a/1');
        expect(result).not.toBeNull();
        expect(result.route.path).toBe('/a/:x');
        expect(result.params).toEqual({ x: '1' });
    });
});
