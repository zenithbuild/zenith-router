/**
 * Zenith Runtime Router (Native Bridge)
 * 
 * SPA-style client-side router with SSR support via native resolution.
 */

// @ts-ignore
import native from "../index.js"
import type {
  RouteState,
  NavigateOptions,
  RouteRecord,
  PageModule,
  RuntimeRouteRecord,
  RouteListener
} from "./types"

const { resolveRouteNative, generateRuntimeRouterNative } = native

let currentRoute: RouteState = {
  path: "/",
  params: {},
  query: {}
}

const routeListeners: Set<RouteListener> = new Set()
let routeManifest: RuntimeRouteRecord[] = []
let routerOutlet: HTMLElement | null = null

export function initRouter(
  manifest: RuntimeRouteRecord[],
  outlet?: HTMLElement | string
): void {
  routeManifest = manifest
  if (outlet) {
    routerOutlet = typeof outlet === "string" ? document.querySelector(outlet) : outlet
  }
  window.addEventListener("popstate", handlePopState)
  resolveAndRender(window.location.pathname, parseQueryString(window.location.search), false)
}

function parseQueryString(search: string): Record<string, string> {
  const query: Record<string, string> = {}
  if (!search || search === "?") return query
  const params = new URLSearchParams(search)
  params.forEach((value, key) => { query[key] = value; })
  return query
}

function handlePopState(_event: PopStateEvent): void {
  resolveAndRender(window.location.pathname, parseQueryString(window.location.search), false, false)
}

/**
 * Resolve route - uses native implementation if available (Node.js/SSR)
 * or falls back to JS implementation for the browser.
 */
export function resolveRoute(
  pathname: string
): { record: RuntimeRouteRecord; params: Record<string, string> } | null {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // SSR / Node environment
    const resolved = resolveRouteNative(pathname, routeManifest as any)
    if (!resolved) return null
    return {
      record: resolved.matched as unknown as RuntimeRouteRecord,
      params: resolved.params
    }
  }

  // Client-side fallback implementation
  const normalizedPath = pathname === "" ? "/" : pathname
  for (const route of routeManifest) {
    const match = route.regex.exec(normalizedPath)
    if (match) {
      const params: Record<string, string> = {}
      for (let i = 0; i < route.paramNames.length; i++) {
        const paramName = route.paramNames[i]
        const paramValue = match[i + 1]
        if (paramName && paramValue !== undefined) {
          params[paramName] = decodeURIComponent(paramValue)
        }
      }
      return { record: route, params }
    }
  }
  return null
}

async function resolveAndRender(
  path: string,
  query: Record<string, string>,
  updateHistory: boolean = true,
  replace: boolean = false
): Promise<void> {
  const prevRoute = { ...currentRoute }
  const resolved = resolveRoute(path)

  if (resolved) {
    currentRoute = {
      path,
      params: resolved.params,
      query,
      matched: resolved.record as unknown as RouteRecord
    }
    const pageModule = resolved.record.module || (resolved.record.load ? await resolved.record.load() : null)
    if (pageModule) await renderPage(pageModule)
  } else {
    currentRoute = { path, params: {}, query, matched: undefined }
  }

  if (updateHistory) {
    const url = path + (Object.keys(query).length > 0 ? "?" + new URLSearchParams(query).toString() : "")
    if (replace) window.history.replaceState(null, "", url)
    else window.history.pushState(null, "", url)
  }
  notifyListeners(currentRoute, prevRoute)
    ; (window as any).__zenith_route = currentRoute
}

async function renderPage(pageModule: PageModule): Promise<void> {
  if (!routerOutlet) return
  routerOutlet.innerHTML = pageModule.html
  // ... logic for styles and scripts
}

function notifyListeners(route: RouteState, prevRoute: RouteState): void {
  routeListeners.forEach(listener => { listener(route, prevRoute) })
}

export async function navigate(to: string, options: NavigateOptions = {}): Promise<void> {
  let path, query: Record<string, string> = {}
  if (to.includes("?")) {
    const [pathname, search] = to.split("?")
    path = pathname || "/"
    query = parseQueryString("?" + (search || ""))
  } else path = to

  await resolveAndRender(path, query, true, options.replace || false)
}

export function getRoute(): RouteState { return { ...currentRoute } }
export function onRouteChange(listener: RouteListener): () => void {
  routeListeners.add(listener)
  return () => { routeListeners.delete(listener) }
}

export function isActive(path: string, exact: boolean = false): boolean {
  return exact ? currentRoute.path === path : currentRoute.path.startsWith(path)
}

export async function prefetch(path: string): Promise<void> {
  const resolved = resolveRoute(path)
  if (resolved && resolved.record.load && !resolved.record.module) {
    resolved.record.module = await resolved.record.load()
  }
}

export function isPrefetched(_path: string): boolean { return false }

export function generateRuntimeRouterCode(): string {
  return generateRuntimeRouterNative()
}
