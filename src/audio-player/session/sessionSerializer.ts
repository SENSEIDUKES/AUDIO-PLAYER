import type { SessionEngine, Track, RepeatMode } from "../types"

export interface SerializedSession {
    queue: Track[]
    currentIndex: number
    currentTime: number
    shuffle: boolean
    repeatMode: RepeatMode
    timestamp: number
}

export interface DeserializeOptions {
    /** Optional callback to transform track URLs, e.g., to refresh stale CDN tokens */
    urlTransformer?: (url: string) => string
    /** Maximum age in milliseconds for a session to be considered valid. Defaults to infinite. */
    maxAgeMs?: number
}

/**
 * Serializes the current session state into a plain object suitable for
 * localStorage or sharing.
 */
export function serializeSession(session: SessionEngine): SerializedSession {
    return {
        queue: [...session.queue],
        currentIndex: session.currentIndex,
        currentTime: session.currentTime,
        shuffle: session.shuffle,
        repeatMode: session.repeatMode,
        timestamp: Date.now(),
    }
}

function isValidTrack(track: any): track is Track {
    return (
        track &&
        typeof track === "object" &&
        typeof track.title === "string" &&
        typeof track.artist === "string" &&
        (typeof track.audioFile === "string" || Array.isArray(track.sources))
    )
}

function isValidRepeatMode(mode: any): mode is RepeatMode {
    return mode === "off" || mode === "all" || mode === "one"
}

function sanitizeCurrentIndex(value: unknown, queueLength: number): number {
    if (queueLength === 0) return -1
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
        return 0
    }
    return Math.min(Math.max(value, 0), queueLength - 1)
}

function sanitizeCurrentTime(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

function sanitizeTimestamp(value: unknown): number {
    if (typeof value !== "number") return Date.now()
    return Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * Deserializes a session state, validating its structure.
 * Returns the validated session, or null if the data is invalid or expired.
 */
export function deserializeSession(
    data: unknown,
    options?: DeserializeOptions
): SerializedSession | null {
    if (!data || typeof data !== "object") return null

    const session = data as Partial<SerializedSession>
    const timestamp = sanitizeTimestamp(session.timestamp)

    if (options?.maxAgeMs !== undefined && Date.now() - timestamp > options.maxAgeMs) {
        return null
    }

    if (!Array.isArray(session.queue)) return null

    const validQueue: Track[] = []

    for (const item of session.queue) {
        if (isValidTrack(item)) {
            const track = { ...item }

            if (options?.urlTransformer) {
                if (track.audioFile) {
                    track.audioFile = options.urlTransformer(track.audioFile)
                }
                if (track.fallbackSources) {
                    track.fallbackSources = track.fallbackSources.map(options.urlTransformer)
                }
                if (track.sources) {
                    track.sources = track.sources.map((s) => ({
                        ...s,
                        url: options.urlTransformer!(s.url),
                    }))
                }
            }
            validQueue.push(track)
        }
    }

    if (validQueue.length === 0 && session.queue.length > 0) {
        return null
    }

    return {
        queue: validQueue,
        currentIndex: sanitizeCurrentIndex(session.currentIndex, validQueue.length),
        currentTime: sanitizeCurrentTime(session.currentTime),
        shuffle: typeof session.shuffle === "boolean" ? session.shuffle : false,
        repeatMode: isValidRepeatMode(session.repeatMode) ? session.repeatMode : "off",
        timestamp,
    }
}
