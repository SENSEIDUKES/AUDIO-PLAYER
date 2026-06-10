import type { Track, TrackTrims } from "../types"
import { trackKey } from "../utils/trackKey"

/**
 * Conservative silence trimming for Automix Lite.
 *
 * Downloads a track, decodes it, and RMS-scans the first/last seconds for
 * near-silence so crossfades don't run through dead air. This is deliberately
 * simple amplitude analysis — no BPM, beat grids, or song-structure detection.
 *
 * Every failure mode (no Web Audio, CORS-blocked fetch, decode error, file too
 * large, timeout) resolves to `null`, which callers treat as "no trims": the
 * track plays from its natural start to its natural end exactly as it would
 * with Automix off.
 */

/** RMS scan window. */
const WINDOW_MS = 50
/** Amplitude floor treated as silence (~ -40 dBFS). */
const RMS_THRESHOLD = 0.01
/** Never trim more than this from the head of a track. */
const MAX_TRIM_START_MS = 12_000
/** Never trim more than this from the tail of a track. */
const MAX_TRIM_END_MS = 20_000
/** Skip analysis for files larger than this (decode memory + bandwidth). */
const MAX_FILE_BYTES = 30 * 1024 * 1024
/** Skip analysis for tracks longer than this. */
const MAX_DURATION_S = 15 * 60
/** If trims would leave less audio than this, distrust them entirely. */
const MIN_REMAINING_S = 10
const FETCH_TIMEOUT_MS = 10_000

const NO_TRIMS: TrackTrims = { trimStartMs: 0, trimEndMs: 0 }

/** In-flight + settled analysis per trackKey, so a track is analyzed once. */
const pending = new Map<string, Promise<TrackTrims | null>>()
/** Settled results for synchronous reads from the playback hot path. */
const settled = new Map<string, TrackTrims | null>()
/** Serializes analyses so at most one decode is in memory at a time. */
let lastJob: Promise<unknown> = Promise.resolve()

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

function scanEdges(buffer: AudioBuffer): TrackTrims {
    const win = Math.max(1, Math.round((WINDOW_MS / 1000) * buffer.sampleRate))
    const length = buffer.length
    const channels: Float32Array[] = []
    for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) {
        channels.push(buffer.getChannelData(c))
    }
    if (channels.length === 0 || length < win) return NO_TRIMS

    const windowRms = (start: number): number => {
        const end = Math.min(length, start + win)
        let loudest = 0
        for (const data of channels) {
            let sum = 0
            for (let i = start; i < end; i++) {
                const v = data[i]
                sum += v * v
            }
            const rms = Math.sqrt(sum / (end - start))
            if (rms > loudest) loudest = rms
        }
        return loudest
    }

    const totalWindows = Math.floor(length / win)

    let trimStartMs = 0
    const headWindows = Math.min(totalWindows, Math.ceil(MAX_TRIM_START_MS / WINDOW_MS))
    for (let w = 0; w < headWindows; w++) {
        if (windowRms(w * win) >= RMS_THRESHOLD) {
            trimStartMs = w * WINDOW_MS
            break
        }
        trimStartMs = (w + 1) * WINDOW_MS
    }
    trimStartMs = Math.min(trimStartMs, MAX_TRIM_START_MS)

    let trimEndMs = 0
    const tailWindows = Math.min(totalWindows, Math.ceil(MAX_TRIM_END_MS / WINDOW_MS))
    for (let w = 0; w < tailWindows; w++) {
        const start = length - (w + 1) * win
        if (start < 0) break
        if (windowRms(start) >= RMS_THRESHOLD) {
            trimEndMs = w * WINDOW_MS
            break
        }
        trimEndMs = (w + 1) * WINDOW_MS
    }
    trimEndMs = Math.min(trimEndMs, MAX_TRIM_END_MS)

    const durationMs = buffer.duration * 1000
    if (durationMs - trimStartMs - trimEndMs < MIN_REMAINING_S * 1000) {
        return NO_TRIMS
    }
    return { trimStartMs, trimEndMs }
}

async function analyze(url: string): Promise<TrackTrims | null> {
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
        return scanEdges(buffer)
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Kick off (or join) silence analysis for a track. Results are cached for the
 * lifetime of the page; analyses run one at a time. Resolves to `null` when
 * analysis is unavailable or unreliable — callers must fall back to the
 * track's natural start/end.
 */
export function ensureTrackAnalysis(track: Track): Promise<TrackTrims | null> {
    const key = trackKey(track)
    const url = track.audioFile?.trim()
    if (!key || !url) return Promise.resolve(null)
    const existing = pending.get(key)
    if (existing) return existing
    const job = lastJob
        .catch(() => {})
        .then(() => analyze(url))
        .then(
            (trims) => {
                settled.set(key, trims)
                return trims
            },
            () => {
                settled.set(key, null)
                return null
            }
        )
    lastJob = job
    pending.set(key, job)
    return job
}

/**
 * Synchronous read of a finished analysis. Returns `null` while analysis is
 * pending, failed, or was never requested.
 */
export function getTrackTrims(track: Track | null): TrackTrims | null {
    if (!track) return null
    return settled.get(trackKey(track)) ?? null
}
