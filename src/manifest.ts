import fs from "fs"
import path from "path"
import native from "../index.js"
import {
    type RouteDefinition,
    type ParsedSegment,
    SegmentType
} from "./types"

const { generateRouteManifestNative } = native

/**
 * Scoring constants for route ranking
 */
const SEGMENT_SCORES = {
    [SegmentType.Static]: 10,
    [SegmentType.Dynamic]: 5,
    [SegmentType.CatchAll]: 1,
    [SegmentType.OptionalCatchAll]: 0
} as const

/**
 * Discover all .zen files in the pages directory
 */
export function discoverPages(pagesDir: string): string[] {
    const pages: string[] = []

    function walk(dir: string): void {
        if (!fs.existsSync(dir)) return

        const entries = fs.readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
                walk(fullPath)
            } else if (entry.isFile() && entry.name.endsWith(".zen")) {
                pages.push(fullPath)
            }
        }
    }

    walk(pagesDir)
    return pages
}

/**
 * Convert a file path to a route path
 */
export function filePathToRoutePath(filePath: string, pagesDir: string): string {
    const relativePath = path.relative(pagesDir, filePath)
    const withoutExt = relativePath.replace(/\.zen$/, "")
    const segmentsList = withoutExt.split(path.sep)
    const routeSegments: string[] = []

    for (const segment of segmentsList) {
        if (segment === "index") continue

        const optionalCatchAllMatch = segment.match(/^\[\[\.\.\.(\w+)\]\]$/)
        if (optionalCatchAllMatch) {
            routeSegments.push(`*${optionalCatchAllMatch[1]}?`)
            continue
        }

        const catchAllMatch = segment.match(/^\[\.\.\.(\w+)\]$/)
        if (catchAllMatch) {
            routeSegments.push(`*${catchAllMatch[1]}`)
            continue
        }

        const dynamicMatch = segment.match(/^\[(\w+)\]$/)
        if (dynamicMatch) {
            routeSegments.push(`:${dynamicMatch[1]}`)
            continue
        }

        routeSegments.push(segment)
    }

    const routePath = "/" + routeSegments.join("/")
    return routePath === "/" ? "/" : routePath.replace(/\/$/, "")
}

/**
 * Parse a route path into segments
 */
export function parseRouteSegments(routePath: string): ParsedSegment[] {
    if (routePath === "/") return []

    const segmentsList = routePath.slice(1).split("/")
    const parsed: ParsedSegment[] = []

    for (const segment of segmentsList) {
        if (segment.startsWith("*") && segment.endsWith("?")) {
            parsed.push({ segmentType: SegmentType.OptionalCatchAll, paramName: segment.slice(1, -1), raw: segment })
            continue
        }
        if (segment.startsWith("*")) {
            parsed.push({ segmentType: SegmentType.CatchAll, paramName: segment.slice(1), raw: segment })
            continue
        }
        if (segment.startsWith(":")) {
            parsed.push({ segmentType: SegmentType.Dynamic, paramName: segment.slice(1), raw: segment })
            continue
        }
        parsed.push({ segmentType: SegmentType.Static, raw: segment })
    }

    return parsed
}

/**
 * Calculate route score
 */
export function calculateRouteScore(segments: ParsedSegment[]): number {
    if (segments.length === 0) return 100
    let score = 0
    for (const segment of segments) {
        score += SEGMENT_SCORES[segment.segmentType]
    }
    const staticCount = segments.filter(s => s.segmentType === SegmentType.Static).length
    score += staticCount * 2
    return score
}

/**
 * Extract parameter names
 */
export function extractParamNames(segments: ParsedSegment[]): string[] {
    return segments
        .filter(s => s.paramName !== undefined)
        .map(s => s.paramName!)
}

/**
 * Convert route path to regex pattern
 */
export function routePathToRegex(routePath: string): RegExp {
    if (routePath === "/") return /^\/$/

    const segmentsList = routePath.slice(1).split("/")
    const regexParts: string[] = []

    for (let i = 0; i < segmentsList.length; i++) {
        const segment = segmentsList[i]
        if (!segment) continue

        if (segment.startsWith("*") && segment.endsWith("?")) {
            regexParts.push("(?:\\/(.*))?")
            continue
        }
        if (segment.startsWith("*")) {
            regexParts.push("\\/(.+)")
            continue
        }
        if (segment.startsWith(":")) {
            regexParts.push("\\/([^/]+)")
            continue
        }
        const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        regexParts.push(`\\/${escaped}`)
    }

    return new RegExp(`^${regexParts.join("")}\\/?$`)
}

/**
 * Generate a route definition from a file path
 */
export function generateRouteDefinition(filePath: string, pagesDir: string): RouteDefinition {
    const routePath = filePathToRoutePath(filePath, pagesDir)
    const segments = parseRouteSegments(routePath)
    const paramNames = extractParamNames(segments)
    const score = calculateRouteScore(segments)

    // Note: RouteDefinition extends RouteRecord, which no longer has segments
    return {
        path: routePath,
        paramNames,
        score,
        filePath,
        regex: routePathToRegex(routePath)
    }
}

export function generateRouteManifest(pagesDir: string): RouteDefinition[] {
    // Optional: use native generator if available, but for now we keep the TS one for build-time safety
    const pages = discoverPages(pagesDir)
    const definitions = pages.map(filePath => generateRouteDefinition(filePath, pagesDir))
    definitions.sort((a, b) => b.score - a.score)
    return definitions
}

export function generateRouteManifestCode(definitions: RouteDefinition[]): string {
    const routeEntries = definitions.map(def => {
        const regex = routePathToRegex(def.path)
        return `  {
    path: ${JSON.stringify(def.path)},
    regex: ${regex.toString()},
    paramNames: ${JSON.stringify(def.paramNames)},
    score: ${def.score},
    filePath: ${JSON.stringify(def.filePath)}
  }`
    })

    return `// Auto-generated route manifest\n// Do not edit directly\n\nexport const routeManifest = [\n${routeEntries.join(",\n")}\n];\n`
}
