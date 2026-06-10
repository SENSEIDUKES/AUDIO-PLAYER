import { useEffect, useRef } from "react"
import type { AudioPlayerEngine } from "../types"

export interface UseMediaSessionObserverOptions {
    /** Track title shown on the lock screen / OS media UI. */
    title: string
    artist?: string
    album?: string
    /** Lock-screen artwork, e.g. `[{ src, sizes: "512x512", type: "image/jpeg" }]`. */
    artwork?: MediaImage[]
    /** Advance to the next track. Omit when the host has no queue. */
    onNext?: () => void
    /** Go back to the previous track. Omit when the host has no queue. */
    onPrevious?: () => void
    /**
     * Opaque key identifying the logical track. Metadata and action handlers
     * re-register when it changes. Defaults to `title`.
     */
    sourceKey?: string
    /** Seconds moved by the OS seekforward/seekbackward actions. Default 10. */
    seekStep?: number
}

/**
 * Media Session API integration (progressive enhancement) as a reusable hook,
 * so any skin — the built-in `AudioPlayer` or a custom headless one — gets
 * lock-screen metadata and OS media controls from the same engine.
 *
 * Does nothing (silently) when the browser has no `navigator.mediaSession`.
 */
export function useMediaSessionObserver(
    engine: AudioPlayerEngine,
    options: UseMediaSessionObserverOptions
): void {
    // Handlers read the latest engine/options through this ref so a single
    // registration per track never goes stale.
    const latest = useRef({ engine, options })
    latest.current = { engine, options }

    // 1. Sync metadata whenever any of the displayed fields change so the OS
    //    media UI never shows stale information (e.g. after lazy loading or
    //    localization updates while the same track is active).
    useEffect(() => {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator))
            return

        const ms = navigator.mediaSession
        ms.metadata = new MediaMetadata({
            title: options.title,
            artist: options.artist ?? "",
            album: options.album ?? "",
            artwork: options.artwork ?? [],
        })

        return () => {
            ms.metadata = null
        }
    }, [options.title, options.artist, options.album, options.artwork])

    // 2. Register action handlers once on mount. All handlers read from the
    //    `latest` ref so they never go stale without re-registering.
    useEffect(() => {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator))
            return

        const ms = navigator.mediaSession
        const actions: MediaSessionAction[] = [
            "play",
            "pause",
            "previoustrack",
            "nexttrack",
            "seekbackward",
            "seekforward",
            "stop",
        ]
        const handlers: Record<string, MediaSessionActionHandler> = {
            play: () => latest.current.engine.play(true),
            pause: () => latest.current.engine.pause(),
            previoustrack: () => latest.current.options.onPrevious?.(),
            nexttrack: () => latest.current.options.onNext?.(),
            seekbackward: () => {
                const step = latest.current.options.seekStep ?? 10
                latest.current.engine.seekBy(-step)
            },
            seekforward: () => {
                const step = latest.current.options.seekStep ?? 10
                latest.current.engine.seekBy(step)
            },
            stop: () => latest.current.engine.pause(),
        }
        for (const action of actions) {
            try {
                ms.setActionHandler(action, handlers[action])
            } catch {
                /* unsupported action type */
            }
        }

        return () => {
            for (const action of actions) {
                try {
                    ms.setActionHandler(action, null)
                } catch {
                    /* unsupported action type */
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Keep playback state in sync with the OS.
    useEffect(() => {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator))
            return
        navigator.mediaSession.playbackState = engine.isPlaying
            ? "playing"
            : "paused"
    }, [engine.isPlaying])
}
