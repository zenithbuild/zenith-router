// ---------------------------------------------------------------------------
// history.spec.js — History layer tests
// ---------------------------------------------------------------------------
// ROUTER_CONTRACT.md invariants:
// - #7 History API integration via pushState/popstate
// - Synchronous behavior (no batching/scheduler)
// ---------------------------------------------------------------------------

import { push, replace, listen, current } from '../src/history.js';
import { jest } from '@jest/globals';

describe('History Layer', () => {
    test('push updates pathname', () => {
        push('/about');
        expect(window.location.pathname).toBe('/about');
    });

    test('replace updates pathname without new entry', () => {
        push('/first');
        replace('/replaced');
        expect(window.location.pathname).toBe('/replaced');
    });

    test('current returns pathname', () => {
        push('/test-path');
        expect(current()).toBe('/test-path');
    });

    test('listen receives path on popstate', () => {
        const calls = [];
        const unlisten = listen((path) => calls.push(path));

        // Simulate popstate
        push('/page-a');
        push('/page-b');

        // JSDOM doesn't auto-fire popstate on pushState,
        // so we fire it manually
        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(calls.length).toBe(1);
        expect(calls[0]).toBe('/page-b');

        unlisten();
    });

    test('unlisten removes callback', () => {
        const calls = [];
        const unlisten = listen((path) => calls.push(path));

        unlisten();

        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(calls.length).toBe(0);
    });

    test('multiple listeners fire independently', () => {
        const callsA = [];
        const callsB = [];

        const unlistenA = listen((p) => callsA.push(p));
        const unlistenB = listen((p) => callsB.push(p));

        push('/multi');
        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(callsA.length).toBe(1);
        expect(callsB.length).toBe(1);

        unlistenA();

        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(callsA.length).toBe(1); // no more
        expect(callsB.length).toBe(2);

        unlistenB();
    });

    test('popstate listener dispatch is synchronous in the same tick', () => {
        const order = [];
        const unlisten = listen(() => {
            order.push('listener');
        });

        order.push('before-dispatch');
        window.dispatchEvent(new PopStateEvent('popstate'));
        order.push('after-dispatch');

        expect(order).toEqual(['before-dispatch', 'listener', 'after-dispatch']);
        unlisten();
    });

    test('pushState + popstate bridge has no deferred scheduler behavior', async () => {
        const calls = [];
        const unlisten = listen((path) => calls.push(path));

        push('/sync-check');
        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(calls).toEqual(['/sync-check']);

        await Promise.resolve();
        expect(calls).toEqual(['/sync-check']);

        unlisten();
    });

    test('global popstate listener is attached once and removed when empty', () => {
        const addSpy = jest.spyOn(window, 'addEventListener');
        const removeSpy = jest.spyOn(window, 'removeEventListener');

        const unlistenA = listen(() => { });
        const unlistenB = listen(() => { });

        // Only one global popstate hook should be attached.
        const popstateAdds = addSpy.mock.calls.filter(([type]) => type === 'popstate');
        expect(popstateAdds.length).toBe(1);

        unlistenA();
        const popstateRemovesBeforeLast = removeSpy.mock.calls.filter(([type]) => type === 'popstate');
        expect(popstateRemovesBeforeLast.length).toBe(0);

        unlistenB();
        const popstateRemoves = removeSpy.mock.calls.filter(([type]) => type === 'popstate');
        expect(popstateRemoves.length).toBe(1);

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
