import type {
    ResolvedTrackSource,
    Track,
    TrackSource,
    TrackSourceResolution,
} from "../types"

function getUrlBase(): string {
    if (typeof globalThis !== "undefined") {
        const location = (globalThis as { location?: Location }).location
        if (location?.href) return location.href
    }
    return "http://localhost/"
}

/**
 * Normalize a source URL once at the source-resolution boundary so playback,
 * waveform, automix, cache keys, and fallback comparisons all speak the same
 * URL language. Relative URLs become absolute in browser environments, matching
 * what HTMLMediaElement.currentSrc reports after the browser resolves `src`.
 */
export function normalizeSourceUrl(url: string): string {
    const trimmed = url.trim()
    if (!trimmed) return ""

    try {
        return new URL(trimmed, getUrlBase()).href
    } catch {
        return trimmed
    }
}

/** Match stored source URLs against browser-resolved media URLs. */
export function sourceUrlsMatch(sourceUrl: string, failedUrl: string): boolean {
    const normalizedSource = normalizeSourceUrl(sourceUrl)
    const normalizedFailed = normalizeSourceUrl(failedUrl)
    if (!normalizedSource || !normalizedFailed) return false
    if (normalizedSource === normalizedFailed) return true

    // Defensive fallback for odd embedded webviews / CDN rewrites where URL()
    // canonicalization is not enough but the browser still appends a relative
    // asset path onto an absolute origin.
    const rawSource = sourceUrl.trim()
    const rawFailed = failedUrl.trim()
    return Boolean(rawSource && rawFailed.endsWith(rawSource))
}

function normalizeSource(source: TrackSource): TrackSource | null {
    const url = normalizeSourceUrl(source.url ?? "")
    if (!url) return null
    const type = source.type?.trim()
    return type ? { url, type } : { url }
}

function dedupeSources(sources: TrackSource[]): TrackSource[] {
    const seen = new Set<string>()
    const next: TrackSource[] = []
    for (const source of sources) {
        const normalized = normalizeSource(source)
        if (!normalized || seen.has(normalized.url)) continue
        seen.add(normalized.url)
        next.push(normalized)
    }
    return next
}

/**
 * Resolve the ordered source list for a track.
 *
 * `track.sources` is authoritative when present and non-empty. Otherwise the
 * legacy `audioFile` remains the primary URL and `fallbackSources` are appended.
 */
export function getTrackSources(track: Track | null | undefined): TrackSource[] {
    if (!track) return []

    const declaredSources = dedupeSources(track.sources ?? [])
    if (declaredSources.length > 0) return declaredSources

    return dedupeSources([
        { url: track.audioFile ?? "" },
        ...(track.fallbackSources ?? []).map((url) => ({ url })),
    ])
}

/** First playable URL for a track after source normalization. */
export function getPrimaryTrackSource(track: Track | null | undefined): string {
    return getTrackSources(track)[0]?.url ?? ""
}

/** Stable signature used to detect source-list changes without storing objects. */
export function trackSourcesSignature(track: Track | null | undefined): string {
    return JSON.stringify(
        getTrackSources(track).map((source) => [source.url, source.type ?? ""])
    )
}

/** Normalize a resolver result without losing its resource-release callback. */
export function normalizeSourceResolution(
    resolution: TrackSourceResolution
): ResolvedTrackSource | null {
    const rawUrl =
        typeof resolution === "string" ? resolution : resolution?.url ?? ""
    const url = normalizeSourceUrl(rawUrl)
    if (!url) return null
    if (typeof resolution === "string" || !resolution.release) return { url }
    return { url, release: resolution.release }
}

/** Guard resolver cleanup so every lifecycle path can safely converge on it. */
export function onceSourceRelease(
    release: (() => void) | undefined
): (() => void) | null {
    if (!release) return null
    let released = false
    return () => {
        if (released) return
        released = true
        try {
            release()
        } catch (error) {
            console.warn("[AudioPlayer] Source release callback failed:", error)
        }
    }
}
