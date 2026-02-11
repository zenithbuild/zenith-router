#!/usr/bin/env node
// ---------------------------------------------------------------------------
// playwright-validation.mjs — Real Browser Validation Harness
// ---------------------------------------------------------------------------
// Validates ROUTER_CONTRACT.md behavior in Chromium + WebKit with real DOM:
// - deterministic route resolution
// - params remain strings
// - history back/forward via popstate
// - unmatched navigation reports matched:false without crash
// - rapid swaps + mount/cleanup lifecycle consistency
// ---------------------------------------------------------------------------

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function contentType(filePath) {
    if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    return 'text/plain; charset=utf-8';
}

function harnessHtml() {
    return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Zenith Router Harness</title></head>
  <body>
    <div id="app"></div>
    <script type="module">
      import { createRouter, navigate, back, forward, onRouteChange, getCurrentPath } from '/src/index.js';

      const state = {
        mountCount: 0,
        cleanupCount: 0,
        events: [],
        counters: { home: 0, user: 0, about: 0 }
      };

      const routes = [
        {
          path: '/',
          load: async () => {
            state.counters.home += 1;
            return { __html: '<h1>Home ' + state.counters.home + '</h1>' };
          }
        },
        {
          path: '/users/:id',
          load: async (params) => {
            state.counters.user += 1;
            return { __html: '<h1>User ' + params.id + ' #' + state.counters.user + '</h1>' };
          }
        },
        {
          path: '/about',
          load: async () => {
            state.counters.about += 1;
            return { __html: '<h1>About ' + state.counters.about + '</h1>' };
          }
        }
      ];

      const container = document.getElementById('app');
      const mount = (el, pageModule) => {
        state.mountCount += 1;
        el.innerHTML = pageModule.__html || '';
      };
      const cleanup = () => {
        state.cleanupCount += 1;
        container.innerHTML = '';
      };

      history.replaceState({}, '', '/');
      const router = createRouter({ routes, container, mount, cleanup });
      onRouteChange((detail) => state.events.push(detail));
      await router.start();

      window.__routerHarness = {
        state,
        navigate,
        back,
        forward,
        getCurrentPath,
        getHTML: () => container.innerHTML,
        destroy: () => router.destroy()
      };
    </script>
  </body>
</html>`;
}

async function startServer() {
    const server = http.createServer((req, res) => {
        const requestPath = new URL(req.url, 'http://localhost').pathname;
        if (requestPath === '/harness') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            res.end(harnessHtml());
            return;
        }

        const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
        const fsPath = path.join(repoRoot, safePath);

        if (!fsPath.startsWith(repoRoot) || !fs.existsSync(fsPath) || fs.statSync(fsPath).isDirectory()) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        res.writeHead(200, { 'content-type': contentType(fsPath) });
        fs.createReadStream(fsPath).pipe(res);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    return { server, origin };
}

async function runSuite(browserName, launch) {
    const browser = await launch.launch({ headless: true });
    const page = await browser.newPage();
    const { server, origin } = await startServer();

    try {
        await page.goto(`${origin}/harness`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => Boolean(window.__routerHarness));

        const initialHTML = await page.evaluate(() => window.__routerHarness.getHTML());
        assert.equal(initialHTML, '<h1>Home 1</h1>', `[${browserName}] initial mount mismatch`);

        await page.evaluate(() => window.__routerHarness.navigate('/users/42'));
        await page.waitForFunction(() => window.__routerHarness.getCurrentPath() === '/users/42');
        const userHTML = await page.evaluate(() => window.__routerHarness.getHTML());
        assert.equal(userHTML, '<h1>User 42 #1</h1>', `[${browserName}] user route mount mismatch`);

        const paramType = await page.evaluate(() => {
            const last = window.__routerHarness.state.events[window.__routerHarness.state.events.length - 1];
            return typeof last.params.id;
        });
        assert.equal(paramType, 'string', `[${browserName}] param was not a string`);

        await page.evaluate(() => window.__routerHarness.navigate('/about'));
        await page.waitForFunction(() => window.__routerHarness.getCurrentPath() === '/about');
        assert.equal(await page.evaluate(() => window.__routerHarness.getHTML()), '<h1>About 1</h1>');

        await page.evaluate(() => window.__routerHarness.navigate('/missing'));
        await page.waitForFunction(() => window.__routerHarness.getCurrentPath() === '/missing');
        const unmatched = await page.evaluate(() => {
            const events = window.__routerHarness.state.events;
            return events[events.length - 1];
        });
        assert.equal(unmatched.matched, false, `[${browserName}] unmatched route did not report matched:false`);
        assert.equal(await page.evaluate(() => window.__routerHarness.getHTML()), '<h1>About 1</h1>');

        await page.evaluate(async () => {
            for (let i = 1; i <= 90; i++) {
                await window.__routerHarness.navigate('/users/' + i);
            }
        });
        await page.waitForFunction(() => window.__routerHarness.getCurrentPath() === '/users/90');
        assert.equal(await page.evaluate(() => window.__routerHarness.getHTML()), '<h1>User 90 #91</h1>');

        await page.goBack();
        await page.waitForFunction(() => window.__routerHarness.getCurrentPath() === '/users/89');
        assert.equal(await page.evaluate(() => window.__routerHarness.getHTML()), '<h1>User 89 #92</h1>');

        await page.goForward();
        await page.waitForFunction(() => window.__routerHarness.getCurrentPath() === '/users/90');
        assert.equal(await page.evaluate(() => window.__routerHarness.getHTML()), '<h1>User 90 #93</h1>');

        const counts = await page.evaluate(() => ({
            mount: window.__routerHarness.state.mountCount,
            cleanup: window.__routerHarness.state.cleanupCount
        }));
        assert.equal(counts.cleanup, counts.mount - 1, `[${browserName}] cleanup/mount counts drifted`);

        await page.evaluate(() => window.__routerHarness.destroy());
        console.log(`[${browserName}] validation passed`);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

async function main() {
    await runSuite('chromium', chromium);
    await runSuite('webkit', webkit);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
