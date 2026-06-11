/**
 * Shared fetch + decode pipeline for automix track analysis.
 *
 * Extracted from the Automix Lite silence analysis so the Pro analysis can
 * reuse one download/decode per track. Every failure mode (no Web Audio,
 * CORS-blocked fetch, decode error, file too large, timeout) resolves to
 * `null`; callers treat that as "no analysis available".
 */

/** Skip analysis for files larger than this (decode memory + bandwidth). */
const MAX_FILE_BYTES = 30 * 1024 * 1024
/** Skip analysis for tracks longer than this. */
const MAX_DURATION_S = 15 * 60
const FETCH_TIMEOUT_MS = 10_000

function getDecodeContext(): OfflineAudioContext | null {
    if (typeof window === "undefined") return null
    try {
        const Ctor =
            window.OfflineAudioContext ??
            (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
                .webkitOfflineAudioContext
        if (!Ctor) return null
        // The context is only used for decodeAudioData; the 1-frame render
        // graph is never started.
        return new Ctor(1, 1, 44100)
    } catch {
        return null
    }
}

/** decodeAudioData with support for callback-only (older WebKit) signatures. */
function decode(ctx: OfflineAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise<AudioBuffer>((resolve, reject) => {
        try {
            const maybePromise = ctx.decodeAudioData(data, resolve, reject)
            if (maybePromise && typeof maybePromise.then === "function") {
                maybePromise.then(resolve, reject)
            }
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * Download and decode a track within the conservative size/duration limits.
 * Resolves to `null` on any failure.
 */
export async function fetchAndDecodeTrack(url: string): Promise<AudioBuffer | null> {
    if (typeof window === "undefined" || typeof fetch !== "function") return null
    const ctx = getDecodeContext()
    if (!ctx) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) return null
        const declared = Number(response.headers.get("content-length") ?? 0)
        if (declared > MAX_FILE_BYTES) return null
        const data = await response.arrayBuffer()
        if (data.byteLength === 0 || data.byteLength > MAX_FILE_BYTES) return null
        const buffer = await decode(ctx, data)
        if (buffer.duration > MAX_DURATION_S) return null
        return buffer
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}
