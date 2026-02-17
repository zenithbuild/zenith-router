import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderRouterModule } from './template.js';
import { renderRouterModule as renderRouterModuleFromPackage } from '@zenithbuild/router/template';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const goldenPath = path.join(__dirname, 'tests', 'fixtures', 'router-template.golden.js');

const manifestJson = JSON.stringify(
    {
        entry: '/assets/runtime.11111111.js',
        css: '/assets/styles.22222222.css',
        core: '/assets/core.33333333.js',
        router: '/assets/router.44444444.js',
        hash: 'deadbeef',
        chunks: {
            '/': '/assets/index.aaaaaaa1.js',
            '/about': '/assets/about.bbbbbbb2.js'
        }
    },
    null,
    2
);

const runtimeImport = '/assets/runtime.11111111.js';
const coreImport = '/assets/core.33333333.js';
const opts = { manifestJson, runtimeImport, coreImport };

const sourceA = renderRouterModule(opts);
const sourceB = renderRouterModule(opts);

assert.equal(typeof sourceA, 'string', 'renderRouterModule() must return a string');
assert.ok(sourceA.length > 0, 'router template output must not be empty');
assert.equal(sourceA, sourceB, 'same inputs must produce byte-identical output');
assert.equal(sourceA.includes('\r'), false, 'router template must normalize line endings to \\n');

assert.ok(sourceA.includes(`from '${runtimeImport}'`), 'router template must import runtime via provided specifier');
assert.ok(sourceA.includes(`from '${coreImport}'`), 'router template must import core via provided specifier');
assert.ok(sourceA.includes('const __ZENITH_MANIFEST__ ='), 'router template must inject __ZENITH_MANIFEST__ constant');
assert.ok(sourceA.includes(manifestJson), 'router template must inline provided manifestJson string');
assert.ok(
    sourceA.includes('import(__ZENITH_MANIFEST__.chunks[route])'),
    'router template must use manifest-driven dynamic import shape'
);

const clickStart = sourceA.indexOf("document.addEventListener('click'");
assert.ok(clickStart >= 0, 'router template must register delegated click handler');

const preventDefaultIndex = sourceA.indexOf('event.preventDefault();', clickStart);
const pushStateIndex = sourceA.indexOf("history.pushState({}, '', nextPath);", clickStart);
const navigateIndex = sourceA.indexOf('navigate(nextPath, false, url)', clickStart);
assert.ok(preventDefaultIndex >= 0, 'click handler must call preventDefault');
assert.ok(pushStateIndex >= 0, 'click handler must call pushState');
assert.ok(navigateIndex >= 0, 'click handler must call navigate immediately');
assert.ok(
    preventDefaultIndex < pushStateIndex && pushStateIndex < navigateIndex,
    'click flow order must be preventDefault -> pushState -> navigate'
);

assert.ok(sourceA.includes("window.addEventListener('popstate'"), 'router template must handle popstate');
assert.ok(
    sourceA.includes('navigate(window.location.pathname, false, null)'),
    'router template must mount immediately on initial load'
);

assert.ok(
    sourceA.includes('window.location.assign(url.href);'),
    'router template must hard-fallback via location.assign on navigation failure'
);

assert.equal(sourceA.includes('fetch('), false, 'router template must not fetch manifest/runtime pages');
assert.equal(sourceA.includes('.zen'), false, 'router template must not contain .zen references');
assert.equal(sourceA.includes('zenith:'), false, 'router template must not contain zenith:* specifiers');

const sourceFromPackage = renderRouterModuleFromPackage(opts);
assert.equal(sourceFromPackage, sourceA, 'subpath export must resolve and return the same deterministic source');

const golden = readFileSync(goldenPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
assert.equal(sourceA, golden, 'router template output must match golden bytes for the fixed fixture');

console.log('template-contract.spec.js passed');
