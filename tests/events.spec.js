// ---------------------------------------------------------------------------
// events.spec.js — Route change event tests
// ---------------------------------------------------------------------------

import {
    onRouteChange,
    _dispatchRouteChange,
    _clearSubscribers,
    _getSubscriberCount
} from '../src/events.js';

describe('Route Change Events', () => {
    afterEach(() => {
        _clearSubscribers();
    });

    test('subscriber receives route change notification', () => {
        const calls = [];
        onRouteChange((detail) => calls.push(detail));

        _dispatchRouteChange({ path: '/about', matched: true });

        expect(calls.length).toBe(1);
        expect(calls[0].path).toBe('/about');
        expect(calls[0].matched).toBe(true);
    });

    test('subscriber receives params on dynamic match', () => {
        const calls = [];
        onRouteChange((detail) => calls.push(detail));

        _dispatchRouteChange({ path: '/users/42', params: { id: '42' }, matched: true });

        expect(calls[0].params).toEqual({ id: '42' });
    });

    test('subscriber receives unmatched notification', () => {
        const calls = [];
        onRouteChange((detail) => calls.push(detail));

        _dispatchRouteChange({ path: '/nowhere', matched: false });

        expect(calls[0].matched).toBe(false);
    });

    test('unsubscribe removes callback', () => {
        const calls = [];
        const unsub = onRouteChange((detail) => calls.push(detail));

        unsub();

        _dispatchRouteChange({ path: '/test', matched: true });
        expect(calls.length).toBe(0);
    });

    test('multiple subscribers fire independently', () => {
        const callsA = [];
        const callsB = [];

        const unsubA = onRouteChange((d) => callsA.push(d));
        const unsubB = onRouteChange((d) => callsB.push(d));

        _dispatchRouteChange({ path: '/x', matched: true });

        expect(callsA.length).toBe(1);
        expect(callsB.length).toBe(1);

        unsubA();

        _dispatchRouteChange({ path: '/y', matched: true });
        expect(callsA.length).toBe(1);
        expect(callsB.length).toBe(2);

        unsubB();
    });

    test('subscriber count tracks correctly', () => {
        expect(_getSubscriberCount()).toBe(0);

        const unsub1 = onRouteChange(() => { });
        expect(_getSubscriberCount()).toBe(1);

        const unsub2 = onRouteChange(() => { });
        expect(_getSubscriberCount()).toBe(2);

        unsub1();
        expect(_getSubscriberCount()).toBe(1);

        unsub2();
        expect(_getSubscriberCount()).toBe(0);
    });

    test('clearSubscribers removes all', () => {
        onRouteChange(() => { });
        onRouteChange(() => { });
        expect(_getSubscriberCount()).toBe(2);

        _clearSubscribers();
        expect(_getSubscriberCount()).toBe(0);
    });
});
