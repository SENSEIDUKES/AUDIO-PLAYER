/**
 * useActivityLogRecording — wires lifecycle recording into an activity log
 * context. Designed to be used inside AudioSessionProvider (or any other
 * component that wants to automatically log player lifecycle events).
 *
 * Records events for:
 * - Play/pause transitions
 * - Track changes
 * - Errors
 * - Volume changes above threshold
 * - Session lifecycle (queue changes, repeat/shuffle toggles)
 *
 * Usage:
 * ```tsx
 * useActivityLogRecording(engine, currentTrack, repeatMode, shuffle)
 * ```
 *
 * This is fully optional — the activity log works without it, and callers
 * can always record manually with `log.record(...)`.
 */

import { useEffect, useRef } from "react"
import type { AudioPlayerEngine, RepeatMode, Track } from "../types"
import { useOptionalActivityLog } from "./useActivityLog"

export interface UseActivityLogRecordingOptions {
    engine: AudioPlayerEngine
    currentTrack: Track | null
    repeatMode: RepeatMode
    shuffle: boolean
    /** Optional prefix for track identifiers. */
    trackLabel?: string
}

/**
 * Automatically records common lifecycle events to the activity log. Safe to
 * call from any component; does nothing if no ActivityLogProvider is mounted.
 *
 * Designed for use inside AudioSessionProvider or a skin component.
 */
export function useActivityLogRecording({
    engine,
    currentTrack,
    repeatMode,
    shuffle,
    trackLabel,
}: UseActivityLogRecordingOptions): void {
    const log = useOptionalActivityLog()

    // Track identities for change detection
    const prevPlayingRef = useRef(engine.isPlaying)
    const prevTrackKeyRef = useRef<string | null>(null)
    const prevVolumeRef = useRef(engine.volume)
    const prevMutedRef = useRef(engine.isMuted)

    // Play/pause transitions
    useEffect(() => {
        if (!log) return

        const prev = prevPlayingRef.current
        if (prev === engine.isPlaying) return
        prevPlayingRef.current = engine.isPlaying

        if (engine.isPlaying) {
            log.record({
                area: "playback",
                status: "info",
                message: trackLabel
                    ? `Playback started — ${trackLabel}`
                    : "Playback started",
                details: currentTrack
                    ? {
                          title: currentTrack.title,
                          artist: currentTrack.artist,
                      }
                    : undefined,
            })
        } else {
            log.record({
                area: "playback",
                status: "info",
                message: "Playback paused",
            })
        }
    }, [engine.isPlaying, log, currentTrack, trackLabel])

    // Track changes
    useEffect(() => {
        if (!log || !currentTrack) return
        const key = currentTrack.id ?? `${currentTrack.title}:${currentTrack.artist}`
        if (prevTrackKeyRef.current === key) return
        prevTrackKeyRef.current = key

        log.record({
            area: "playback",
            status: "info",
            message: `Now playing: ${currentTrack.title}`,
            details: {
                title: currentTrack.title,
                artist: currentTrack.artist,
                duration: engine.duration,
            },
        })
    }, [currentTrack, engine.duration, log])

    // Errors
    useEffect(() => {
        if (!log || !engine.hasError) return
        log.record({
            area: "playback",
            status: "error",
            message: engine.errorMessage || "Playback error",
            details: currentTrack
                ? {
                      title: currentTrack.title,
                      artist: currentTrack.artist,
                  }
                : undefined,
        })
    }, [engine.hasError, engine.errorMessage, log, currentTrack])

    // Volume changes above 5% threshold
    useEffect(() => {
        if (!log) return

        const prevVol = prevVolumeRef.current
        const prevMuted = prevMutedRef.current
        prevVolumeRef.current = engine.volume
        prevMutedRef.current = engine.isMuted

        if (engine.isMuted && !prevMuted) {
            log.record({
                area: "playback",
                status: "warn",
                message: "Audio muted",
            })
        } else if (!engine.isMuted && prevMuted) {
            log.record({
                area: "playback",
                status: "info",
                message: `Audio unmuted — volume ${Math.round(engine.volume * 100)}%`,
            })
        } else if (!engine.isMuted) {
            const delta = Math.abs(engine.volume - prevVol)
            if (delta > 0.05) {
                log.record({
                    area: "playback",
                    status: "info",
                    message: `Volume changed to ${Math.round(engine.volume * 100)}%`,
                })
            }
        }
    }, [engine.volume, engine.isMuted, log])

    // Repeat/shuffle mode changes
    const prevRepeatRef = useRef(repeatMode)
    const prevShuffleRef = useRef(shuffle)

    useEffect(() => {
        if (!log) return

        if (prevRepeatRef.current !== repeatMode) {
            prevRepeatRef.current = repeatMode
            log.record({
                area: "session",
                status: "info",
                message: `Repeat mode: ${repeatMode}`,
            })
        }
    }, [repeatMode, log])

    useEffect(() => {
        if (!log) return

        if (prevShuffleRef.current !== shuffle) {
            prevShuffleRef.current = shuffle
            log.record({
                area: "session",
                status: "info",
                message: shuffle ? "Shuffle enabled" : "Shuffle disabled",
            })
        }
    }, [shuffle, log])
}