import { useEffect, useRef } from "react"
import type { AudioPlayerEngine, RepeatMode, Track } from "../types"
import { useActivityLog } from "./useActivityLog"

export interface UseActivityLogRecordingOptions {
    engine: AudioPlayerEngine
    currentTrack: Track | null
    repeatMode: RepeatMode
    shuffle: boolean
    trackLabel?: string
}

/**
 * Automatically records common lifecycle events to the activity log.
 * Must be called beneath an ActivityLogProvider because useActivityLog throws
 * when no provider is mounted.
 */
export function useActivityLogRecording({
    engine,
    currentTrack,
    repeatMode,
    shuffle,
    trackLabel,
}: UseActivityLogRecordingOptions): void {
    const log = useActivityLog()
    const prevPlayingRef = useRef(engine.isPlaying)
    const prevTrackKeyRef = useRef<string | null>(null)
    const prevVolumeRef = useRef(engine.volume)
    const prevMutedRef = useRef(engine.isMuted)
    const prevRepeatRef = useRef(repeatMode)
    const prevShuffleRef = useRef(shuffle)

    useEffect(() => {
        const prev = prevPlayingRef.current
        if (prev === engine.isPlaying) return
        prevPlayingRef.current = engine.isPlaying
        log.record({
            area: "playback",
            status: "info",
            message: engine.isPlaying
                ? trackLabel ? `Playback started — ${trackLabel}` : "Playback started"
                : "Playback paused",
            details: engine.isPlaying && currentTrack
                ? { title: currentTrack.title, artist: currentTrack.artist }
                : undefined,
        })
    }, [engine.isPlaying, log, currentTrack, trackLabel])

    useEffect(() => {
        if (!currentTrack) return
        const key = currentTrack.id ?? `${currentTrack.title}:${currentTrack.artist}`
        if (prevTrackKeyRef.current === key) return
        prevTrackKeyRef.current = key
        log.record({
            area: "playback",
            status: "info",
            message: `Now playing: ${currentTrack.title}`,
            details: { title: currentTrack.title, artist: currentTrack.artist, duration: engine.duration },
        })
    }, [currentTrack, engine.duration, log])

    useEffect(() => {
        if (!engine.hasError) return
        log.record({
            area: "playback",
            status: "error",
            message: engine.errorMessage || "Playback error",
            details: currentTrack ? { title: currentTrack.title, artist: currentTrack.artist } : undefined,
        })
    }, [engine.hasError, engine.errorMessage, log, currentTrack])

    useEffect(() => {
        const prevVol = prevVolumeRef.current
        const prevMuted = prevMutedRef.current
        prevMutedRef.current = engine.isMuted

        if (engine.isMuted && !prevMuted) {
            prevVolumeRef.current = engine.volume
            log.record({ area: "playback", status: "warn", message: "Audio muted" })
        } else if (!engine.isMuted && prevMuted) {
            prevVolumeRef.current = engine.volume
            log.record({
                area: "playback",
                status: "info",
                message: `Audio unmuted — volume ${Math.round(engine.volume * 100)}%`,
            })
        } else if (!engine.isMuted) {
            const delta = Math.abs(engine.volume - prevVol)
            if (delta > 0.05) {
                prevVolumeRef.current = engine.volume
                log.record({
                    area: "playback",
                    status: "info",
                    message: `Volume changed to ${Math.round(engine.volume * 100)}%`,
                })
            }
        }
    }, [engine.volume, engine.isMuted, log])

    useEffect(() => {
        if (prevRepeatRef.current === repeatMode) return
        prevRepeatRef.current = repeatMode
        log.record({ area: "session", status: "info", message: `Repeat mode: ${repeatMode}` })
    }, [repeatMode, log])

    useEffect(() => {
        if (prevShuffleRef.current === shuffle) return
        prevShuffleRef.current = shuffle
        log.record({ area: "session", status: "info", message: shuffle ? "Shuffle enabled" : "Shuffle disabled" })
    }, [shuffle, log])
}
