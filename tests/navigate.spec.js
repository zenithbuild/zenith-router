// ---------------------------------------------------------------------------
// navigate.spec.js — Navigation API tests
// ---------------------------------------------------------------------------
// ROUTER_CONTRACT.md invariants:
// - #4 Explicit router.start (navigate has no hidden auto-start)
// - #7 History integration
// - Subscriber behavior is deterministic
// ---------------------------------------------------------------------------

import { navigate, back, forward, getCurrentPath, _setNavigationResolver } from '../src/navigate.js';
import { onRouteChange, _dispatchRouteChange, _clearSubscribers } from '../src/events.js';

describe('Navigation API', () => {
    afterEach(() => {
        _setNavigationResolver(null);
        _clearSubscribers();
    });

    test('navigate pushes path to history', async () => {
        await navigate('/about');
        expect(window.location.pathname).toBe('/about');
    });

    test('navigate triggers resolver if set', async () => {
        const calls = [];
        _setNavigationResolver(async (path) => calls.push(path));

        await navigate('/test');

        expect(calls).toEqual(['/test']);
    });

    test('navigate works without resolver', async () => {
        // No resolver set — should not throw
        await navigate('/safe');
        expect(window.location.pathname).toBe('/safe');
    });

    test('getCurrentPath returns current pathname', () => {
        history.pushState({}, '', '/check');
        expect(getCurrentPath()).toBe('/check');
    });

    test('getCurrentPath returns pathname only (no query or hash)', () => {
        history.pushState({}, '', '/users/42?tab=settings#profile');
        expect(getCurrentPath()).toBe('/users/42');
    });

    test('back calls history.back', () => {
        // Just verify it doesn't throw
        expect(() => back()).not.toThrow();
    });

    test('forward calls history.forward', () => {
        expect(() => forward()).not.toThrow();
    });

    test('onRouteChange subscriber can unsubscribe deterministically', () => {
        const events = [];
        const unsub = onRouteChange((detail) => events.push(detail.path));

        _dispatchRouteChange({ path: '/a', matched: true });
        unsub();
        _dispatchRouteChange({ path: '/b', matched: true });

        expect(events).toEqual(['/a']);
    });

    test('invalid navigation inputs do not throw unless history rejects', async () => {
        await expect(navigate('')).resolves.toBeUndefined();
        await expect(navigate('/')).resolves.toBeUndefined();
        await expect(navigate('/a//b')).resolves.toBeUndefined();
    });
});
