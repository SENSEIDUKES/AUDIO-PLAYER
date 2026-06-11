/**
 * Waveform peak extraction. Produces the `peaks` arrays wavesurfer.js accepts
 * (per-channel 0–1 amplitudes) from decoded PCM, plus a fetch+decode fallback
 * for backends that stream and never hold decoded data.
 */

/** Fixed bucket count: render cost stays constant regardless of track length. */
const DEFAULT_BUCKETS = 1024

/**
 * Reduce an AudioBuffer to a single merged-mono peaks channel: the abs-max
 * sample per bucket across up to two channels. wavesurfer renders a single
 * channel as a symmetric waveform, and `normalize: true` handles scaling.
 */
export function extractPeaks(
    buffer: AudioBuffer,
    buckets: number = DEFAULT_BUCKETS
): number[][] {
    const length = buffer.length
    if (length === 0 || buckets <= 0) return [[]]
    const bucketCount = Math.min(buckets, length)
    const step = length / bucketCount
    const channels: Float32Array[] = []
    for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) {
        channels.push(buffer.getChannelData(c))
    }
    const merged = new Array<number>(bucketCount)
    for (let i = 0; i < bucketCount; i++) {
        const start = Math.floor(i * step)
        const end = Math.min(length, Math.floor((i + 1) * step) || start + 1)
        let max = 0
        for (const data of channels) {
            for (let j = start; j < end; j++) {
                const value = Math.abs(data[j])
                if (value > max) max = value
            }
        }
        merged[i] = max
    }
    return [merged]
}

export interface ComputedPeaks {
    peaks: number[][]
    duration: number
}

/**
 * Decoded-peaks LRU keyed by URL so StrictMode remounts, track revisits, and
 * retries never re-download or re-decode. Stores only the reduced peaks
 * (~8KB each), not the PCM.
 */
const peaksCache = new Map<string, ComputedPeaks>()
const PEAKS_CACHE_LIMIT = 10
const inFlight = new Map<string, Promise<ComputedPeaks>>()

function cachePut(url: string, value: ComputedPeaks): void {
    peaksCache.delete(url)
    peaksCache.set(url, value)
    while (peaksCache.size > PEAKS_CACHE_LIMIT) {
        const oldest = peaksCache.keys().next().value
        if (oldest === undefined) break
        peaksCache.delete(oldest)
    }
}

/**
 * Fetch and decode an audio URL into waveform peaks. Used as the fallback for
 * the html5 backend, where no decoded data exists — note this downloads the
 * file a second time and requires CORS on remote sources.
 *
 * Decodes through a throwaway OfflineAudioContext so it never consumes the
 * shared playback AudioContext.
 */
export async function computePeaksFromUrl(
    url: string,
    signal?: AbortSignal
): Promise<ComputedPeaks> {
    const cached = peaksCache.get(url)
    if (cached) {
        cachePut(url, cached)
        return cached
    }
    const pending = inFlight.get(url)
    if (pending) return pending

    const run = (async (): Promise<ComputedPeaks> => {
        try {
            const response = await fetch(url, { signal })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} fetching ${url}`)
            }
            const data = await response.arrayBuffer()
            const ctx = new OfflineAudioContext(1, 1, 44100)
            const buffer = await ctx.decodeAudioData(data)
            const result: ComputedPeaks = {
                peaks: extractPeaks(buffer),
                duration: buffer.duration,
            }
            cachePut(url, result)
            return result
        } finally {
            // Safe unconditionally: while this promise is in flight, callers
            // reuse it — the entry is never replaced by a different one.
            inFlight.delete(url)
        }
    })()
    inFlight.set(url, run)
    return run
}
