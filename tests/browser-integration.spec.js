// ---------------------------------------------------------------------------
// browser-integration.spec.js — Browser-level Router Contract Tests
// ---------------------------------------------------------------------------
// ROUTER_CONTRACT.md invariants covered:
// - #1 Deterministic matching (first-match-wins)
// - #2 Params are strings (no coercion)
// - #4 Explicit startup
// - #6 Unmatched routes return null / matched:false without throw
// - #7 History + popstate integration
// - #8 Mount/unmount delegated behavior remains stable under stress
// ---------------------------------------------------------------------------

import { createRouter } from '../src/router.js';
import { navigate, back, forward } from '../src/navigate.js';
import { onRouteChange, _clearSubscribers, _getSubscriberCount } from '../src/events.js';

describe('Browser Integration', () => {
    let container;
    let mounted;
    let cleaned;

    function makeMount() {
        return (el, pageModule) => {
            mounted.push(pageModule);
            el.innerHTML = pageModule.__html || '';
        };
    }

    function makeCleanup() {
        return () => {
            cleaned++;
        };
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        mounted = [];
        cleaned = 0;
        _clearSubscribers();
        history.replaceState({}, '', '/');
    });

    afterEach(() => {
        document.body.removeChild(container);
        _clearSubscribers();
    });

    test('navigates across static + param routes deterministically', async () => {
        const loadCalls = [];
        const routes = [
            { path: '/', load: async () => ({ __html: '<h1>Home</h1>' }) },
            {
                path: '/users/new',
                load: async () => {
                    loadCalls.push('new');
                    return { __html: '<h1>New</h1>' };
                }
            },
            {
                path: '/users/:id',
                load: async (params) => {
                    loadCalls.push(params.id);
                    return { __html: `<h1>User ${params.id}</h1>` };
                }
            },
            { path: '/about', load: async () => ({ __html: '<h1>About</h1>' }) }
        ];

        const router = createRouter({
            routes,
            container,
            mount: makeMount(),
            cleanup: makeCleanup()
        });

        await router.start();
        await navigate('/users/new');
        await navigate('/users/42');
        await navigate('/about');

        expect(loadCalls).toEqual(['new', '42']);
        expect(container.innerHTML).toBe('<h1>About</h1>');
        expect(cleaned).toBe(3);

        router.destroy();
    });

    test('handles back/forward through popstate without async scheduler coupling', async () => {
        const seen = [];
        const unsub = onRouteChange((event) => seen.push(event.path));

        const routes = [
            { path: '/', load: async () => ({ __html: '<h1>Home</h1>' }) },
            { path: '/a', load: async () => ({ __html: '<h1>A</h1>' }) },
            { path: '/b', load: async () => ({ __html: '<h1>B</h1>' }) }
        ];

        const router = createRouter({
            routes,
            container,
            mount: makeMount(),
            cleanup: makeCleanup()
        });

        await router.start();
        await navigate('/a');
        await navigate('/b');

        // Simulate browser back/forward state transitions deterministically.
        back();
        history.replaceState({}, '', '/a');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await Promise.resolve();
        expect(container.innerHTML).toBe('<h1>A</h1>');

        forward();
        history.replaceState({}, '', '/b');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await Promise.resolve();
        expect(container.innerHTML).toBe('<h1>B</h1>');

        expect(seen).toEqual(['/', '/a', '/b', '/a', '/b']);

        unsub();
        router.destroy();
    });

    test('100+ route swaps do not leak subscribers or miss cleanup', async () => {
        const routes = [
            { path: '/page/:id', load: async (params) => ({ __html: `<p>${params.id}</p>` }) }
        ];

        history.replaceState({}, '', '/page/0');
        const router = createRouter({
            routes,
            container,
            mount: makeMount(),
            cleanup: makeCleanup()
        });

        await router.start();

        for (let i = 1; i <= 120; i++) {
            await navigate(`/page/${i}`);
        }

        expect(container.innerHTML).toBe('<p>120</p>');
        expect(cleaned).toBe(120);
        expect(_getSubscriberCount()).toBe(0);

        router.destroy();
    });

    test('route params remain string values in browser lifecycle', async () => {
        const seenParams = [];
        const routes = [
            {
                path: '/users/:id/posts/:postId',
                load: async (params) => {
                    seenParams.push(params);
                    return { __html: 'ok' };
                }
            }
        ];

        history.replaceState({}, '', '/users/7/posts/99');
        const router = createRouter({
            routes,
            container,
            mount: makeMount(),
            cleanup: makeCleanup()
        });

        await router.start();

        expect(typeof seenParams[0].id).toBe('string');
        expect(typeof seenParams[0].postId).toBe('string');
        expect(seenParams[0]).toEqual({ id: '7', postId: '99' });

        router.destroy();
    });

    test('unmatched navigation reports matched:false and does not throw', async () => {
        const changes = [];
        const unsub = onRouteChange((event) => changes.push(event));

        const routes = [{ path: '/', load: async () => ({ __html: '<h1>Home</h1>' }) }];
        const router = createRouter({
            routes,
            container,
            mount: makeMount(),
            cleanup: makeCleanup()
        });

        await router.start();
        await expect(navigate('/missing')).resolves.toBeUndefined();

        const last = changes[changes.length - 1];
        expect(last.matched).toBe(false);
        expect(last.path).toBe('/missing');
        expect(container.innerHTML).toBe('<h1>Home</h1>');

        unsub();
        router.destroy();
    });

    test('nested navigation does not corrupt page-local state across routes', async () => {
        const states = {
            a: { count: 0 },
            b: { count: 0 }
        };

        const routes = [
            {
                path: '/a',
                load: async () => {
                    states.a.count++;
                    return { __html: `<p>A ${states.a.count}</p>` };
                }
            },
            {
                path: '/b',
                load: async () => {
                    states.b.count++;
                    return { __html: `<p>B ${states.b.count}</p>` };
                }
            }
        ];

        history.replaceState({}, '', '/a');
        const router = createRouter({
            routes,
            container,
            mount: makeMount(),
            cleanup: makeCleanup()
        });

        await router.start();
        await navigate('/b');
        await navigate('/a');
        await navigate('/b');

        expect(states).toEqual({
            a: { count: 2 },
            b: { count: 2 }
        });
        expect(container.innerHTML).toBe('<p>B 2</p>');

        router.destroy();
    });
});
