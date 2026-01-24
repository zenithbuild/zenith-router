/**
 * Zenith Router Types
 * 
 * Re-exports types from the native Rust implementation.
 */

import {
    RouteRecord as NativeRouteRecord,
    RouteState as NativeRouteState,
    RouteManifest as NativeRouteManifest,
    SegmentType as NativeSegmentType,
    ParsedSegment as NativeParsedSegment
} from "../index.js"

export { NativeSegmentType as SegmentType }

export interface RouteRecord extends Omit<NativeRouteRecord, 'regex'> {
    regex: RegExp
}

export interface RouteState extends Omit<NativeRouteState, 'matched'> {
    matched?: RouteRecord
}

export interface RouteManifest extends Omit<NativeRouteManifest, 'routes'> {
    routes: RouteRecord[]
}

export interface ParsedSegment extends NativeParsedSegment { }

export interface PageModule {
    html: string
    scripts: string[]
    styles: string[]
    meta?: PageMeta
}

export interface PageMeta {
    title?: string
    description?: string
    [key: string]: string | undefined
}

export interface NavigateOptions {
    replace?: boolean
    scrollToTop?: boolean
    state?: Record<string, unknown>
}

export interface RouteDefinition extends RouteRecord { }

export interface RuntimeRouteRecord extends RouteRecord {
    module?: PageModule | null;
    load?: () => Promise<PageModule>;
}

export type RouteListener = (route: RouteState, prevRoute: RouteState) => void;

export interface Router {
    readonly route: RouteState
    navigate(to: string, options?: NavigateOptions): Promise<void>
    resolve(path: string): { record: RouteRecord; params: Record<string, string> } | null
}
