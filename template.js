function normalizeManifestJson(manifestJson) {
    return manifestJson.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function sanitizeImportSpecifier(specifier) {
    return specifier
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r\n/g, '')
        .replace(/[\r\n]/g, '');
}

export function renderRouterModule(opts) {
    if (!opts || typeof opts !== 'object') {
        throw new Error('renderRouterModule(opts) requires an options object');
    }

    const { manifestJson, runtimeImport, coreImport } = opts;

    if (typeof manifestJson !== 'string' || manifestJson.length === 0) {
        throw new Error('renderRouterModule(opts) requires opts.manifestJson string');
    }
    if (typeof runtimeImport !== 'string' || runtimeImport.length === 0) {
        throw new Error('renderRouterModule(opts) requires opts.runtimeImport string');
    }
    if (typeof coreImport !== 'string' || coreImport.length === 0) {
        throw new Error('renderRouterModule(opts) requires opts.coreImport string');
    }

    const manifest = normalizeManifestJson(manifestJson);
    const runtimeSpec = sanitizeImportSpecifier(runtimeImport);
    const coreSpec = sanitizeImportSpecifier(coreImport);

    const lines = [
        `import { hydrate as __zenithHydrate } from '${runtimeSpec}';`,
        `import { zenOnMount as __zenithOnMount } from '${coreSpec}';`,
        '',
        'void __zenithHydrate;',
        'void __zenithOnMount;',
        '',
        `const __ZENITH_MANIFEST__ = ${manifest};`,
        '',
        'let activeCleanup = null;',
        'let navigationToken = 0;',
        '',
        'function splitPath(path) {',
        "  return path.split('/').filter(Boolean);",
        '}',
        '',
        'function resolveRoute(pathname) {',
        '  if (__ZENITH_MANIFEST__.chunks[pathname]) {',
        '    return { route: pathname, params: Object.freeze({}) };',
        '  }',
        '',
        '  const pathnameSegments = splitPath(pathname);',
        '  const routes = Object.keys(__ZENITH_MANIFEST__.chunks);',
        '',
        '  for (let i = 0; i < routes.length; i++) {',
        '    const route = routes[i];',
        '    const routeSegments = splitPath(route);',
        '    if (routeSegments.length !== pathnameSegments.length) continue;',
        '',
        '    const params = Object.create(null);',
        '    let matched = true;',
        '',
        '    for (let j = 0; j < routeSegments.length; j++) {',
        '      const routeSegment = routeSegments[j];',
        '      const pathnameSegment = pathnameSegments[j];',
        "      if (routeSegment.startsWith(':')) {",
        '        params[routeSegment.slice(1)] = pathnameSegment;',
        '        continue;',
        '      }',
        '      if (routeSegment !== pathnameSegment) {',
        '        matched = false;',
        '        break;',
        '      }',
        '    }',
        '',
        '    if (matched) {',
        '      return { route, params: Object.freeze({ ...params }) };',
        '    }',
        '  }',
        '',
        '  return null;',
        '}',
        '',
        'function teardownRuntime() {',
        "  if (typeof activeCleanup === 'function') {",
        '    activeCleanup();',
        '    activeCleanup = null;',
        '  }',
        '}',
        '',
        'async function mountRoute(route, params, token) {',
        '  if (token !== navigationToken) return;',
        '  teardownRuntime();',
        '  if (token !== navigationToken) return;',
        '',
        '  const pageModule = await import(__ZENITH_MANIFEST__.chunks[route]);',
        '  if (token !== navigationToken) return;',
        '',
        '  const mountFn = pageModule.__zenith_mount || pageModule.default;',
        "  if (typeof mountFn === 'function') {",
        '    const cleanup = mountFn(document, params);',
        "    activeCleanup = typeof cleanup === 'function' ? cleanup : null;",
        '  }',
        '}',
        '',
        'async function navigate(pathname, push, url) {',
        '  const next = resolveRoute(pathname);',
        '  if (!next) return false;',
        '',
        '  navigationToken += 1;',
        '  if (push) {',
        "    history.pushState({}, '', pathname);",
        '  }',
        '',
        '  await mountRoute(next.route, next.params, navigationToken);',
        '  return true;',
        '}',
        '',
        'function handleNavigationFailure(error, url) {',
        "  console.error('[Zenith Router] navigation failed', error);",
        "  if (url && typeof url.href === 'string') {",
        '    window.location.assign(url.href);',
        '  }',
        '}',
        '',
        'function isInternalLink(anchor) {',
        "  if (!anchor || anchor.target || anchor.hasAttribute('download')) return false;",
        "  const href = anchor.getAttribute('href');",
        "  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;",
        '  const url = new URL(anchor.href, window.location.href);',
        '  return url.origin === window.location.origin;',
        '}',
        '',
        'function start() {',
        "  document.addEventListener('click', function(event) {",
        "    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;",
        "    const target = event.target && event.target.closest ? event.target.closest('a[href]') : null;",
        '    if (!isInternalLink(target)) return;',
        '',
        '    const url = new URL(target.href, window.location.href);',
        '    const nextPath = url.pathname;',
        "    if (nextPath === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return;",
        '    if (!resolveRoute(nextPath)) return;',
        '',
        '    event.preventDefault();',
        "    history.pushState({}, '', nextPath);",
        '    navigate(nextPath, false, url).catch(function(error) {',
        '      handleNavigationFailure(error, url);',
        '    });',
        '  });',
        '',
        "  window.addEventListener('popstate', function() {",
        '    navigate(window.location.pathname, false, null).catch(function(error) {',
        "      console.error('[Zenith Router] popstate navigation failed', error);",
        '    });',
        '  });',
        '',
        '  navigate(window.location.pathname, false, null).catch(function(error) {',
        "    console.error('[Zenith Router] initial navigation failed', error);",
        '  });',
        '}',
        '',
        "if (document.readyState === 'loading') {",
        "  document.addEventListener('DOMContentLoaded', start, { once: true });",
        '} else {',
        '  start();',
        '}'
    ];

    return `${lines.join('\n')}\n`;
}
