/**
 * @zenith/router
 * 
 * File-based SPA router for Zenith framework.
 * Includes routing, navigation, and ZenLink components.
 * 
 * Features:
 * - Deterministic, compile-time route resolution
 * - File-based routing (pages/ directory → routes)
 * - SPA navigation with prefetching
 * - ZenLink component for declarative links
 * - Type-safe route parameters
 * - Hydration-safe, no runtime hacks
 * 
 * @example
 * ```ts
 * import { navigate, isActive, prefetch } from '@zenith/router'
 * 
 * // Navigate programmatically
 * navigate('/about')
 * 
 * // Check active state
 * if (isActive('/blog')) {
 *   console.log('On blog section')
 * }
 * ```
 * 
 * @example
 * ```ts
 * // Build-time manifest generation
 * import { generateRouteManifest, discoverPages } from '@zenith/router/manifest'
 * 
 * const manifest = generateRouteManifest('./src/pages')
 * ```
 */

// ============================================
// Core Types
// ============================================

export * from "./types"

// ============================================
// Build-time Manifest Generation
// ============================================

export {
    generateRouteManifest,
    generateRouteManifestCode
} from "./manifest"

// ============================================
// Runtime Router
// ============================================

export {
    initRouter,
    resolveRoute,
    navigate,
    getRoute,
    onRouteChange,
    isActive,
    prefetch,
    isPrefetched,
    generateRuntimeRouterCode
} from "./runtime"

// ============================================
// Navigation Utilities
// ============================================

export {
    // Navigation API (zen* prefixed names)
    zenNavigate,
    zenBack,
    zenForward,
    zenGo,
    zenIsActive,
    zenPrefetch,
    zenIsPrefetched,
    zenGetRoute,
    zenGetParam,
    zenGetQuery,
    createZenLink,
    zenLink,
    // Additional navigation utilities
    back,
    forward,
    go,
    getParam,
    getQuery,
    isExternalUrl,
    shouldUseSPANavigation,
    normalizePath,
    setGlobalTransition,
    getGlobalTransition,
    createTransitionContext
} from "./navigation/index"

// ============================================
// Navigation Types
// ============================================

export type {
    ZenLinkProps,
    TransitionContext,
    TransitionHandler
} from "./navigation/index"
