import { useCallback, useEffect, useRef, useState } from "react"
import type { AudioPlayerEngine, UseAudioPlayerOptions } from "./types"

/**
 * Headless audio engine. Owns a single hidden <audio> element and is the sole
 * source of truth for playback state. UI components read state and call actions;
 * they never touch the <audio> element directly.
 *
 * Notable behavior:
 * - `currentTime` is driven by a single rAF loop while playing, and set
 *   explicitly on seek / pause / metadata. There is no second update path.
 * - When `src` changes, playback continues automatically if it was playing
 *   (track-change UX). The very first load only plays when `autoPlay` is set.
 * - Browsers block audible autoplay without a user gesture; `autoPlay` is a
 *   best-effort attempt, not a guarantee.
 */
export function useAudioPlayer(
    options: UseAudioPlayerOptions
): AudioPlayerEngine {
    const { src, autoPlay = false, loop = false, onEnded } = options

    const audioRef = useRef<HTMLAudioElement>(null)
    const currentTimeRef = useRef(0)
    const isSeekingRef = useRef(false)
    const isPlayingRef = useRef(false)
    const playPromiseRef = useRef<Promise<void> | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const isFirstLoadRef = useRef(true)
    const previousVolumeRef = useRef(1)
    const onEndedRef = useRef(onEnded)
    onEndedRef.current = onEnded

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [buffered, setBuffered] = useState(0)
    const [volume, setVolumeState] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isSeeking, setIsSeekingState] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    const hasAudio = src.trim().length > 0

    const clearPendingPlay = useCallback(() => {
        if (playPromiseRef.current) {
            playPromiseRef.current.catch(() => {
                // Ignore interrupted play attempts during source changes.
            })
            playPromiseRef.current = null
        }
    }, [])

    const stopLoop = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }
    }, [])

    const setSeeking = useCallback((active: boolean) => {
        isSeekingRef.current = active
        setIsSeekingState(active)
    }, [])

    const play = useCallback(
        (reportError = true) => {
            const audio = audioRef.current
            if (!audio || !hasAudio) return

            clearPendingPlay()
            setHasError(false)
            setErrorMessage("")

            const playPromise = audio.play()
            playPromiseRef.current = playPromise

            playPromise
                .then(() => {
                    if (playPromiseRef.current === playPromise) {
                        playPromiseRef.current = null
                    }
                })
                .catch((error: unknown) => {
                    if (playPromiseRef.current === playPromise) {
                        playPromiseRef.current = null
                    }
                    const name = error instanceof Error ? error.name : ""
                    if (name === "AbortError") return

                    setIsPlaying(false)
                    setIsBuffering(false)
                    if (reportError) {
                        setHasError(true)
                        setErrorMessage(
                            name === "NotSupportedError"
                                ? "Audio file not found or format not supported."
                                : "Playback failed. Please try again."
                        )
                    }
                })
        },
        [clearPendingPlay, hasAudio]
    )

    const pause = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return

        const pending = playPromiseRef.current
        if (pending) {
            pending
                .catch(() => {})
                .finally(() => {
                    audio.pause()
                    if (playPromiseRef.current === pending) {
                        playPromiseRef.current = null
                    }
                })
            return
        }
        audio.pause()
    }, [])

    const toggle = useCallback(() => {
        if (!hasAudio) return
        if (isPlayingRef.current) pause()
        else play(true)
    }, [hasAudio, pause, play])

    const seek = useCallback(
        (time: number) => {
            const audio = audioRef.current
            if (!audio || !hasAudio || duration <= 0) return
            const next = Math.max(0, Math.min(duration, time))
            audio.currentTime = next
            currentTimeRef.current = next
            setCurrentTime(next)
        },
        [duration, hasAudio]
    )

    const seekBy = useCallback(
        (delta: number) => {
            const audio = audioRef.current
            if (!audio) return
            seek(audio.currentTime + delta)
        },
        [seek]
    )

    const setVolume = useCallback((value: number) => {
        const audio = audioRef.current
        const next = Math.max(0, Math.min(1, value))
        previousVolumeRef.current = next > 0 ? next : previousVolumeRef.current
        setVolumeState(next)
        if (audio) {
            audio.volume = next
            // Dragging the slider above zero implicitly unmutes.
            if (next > 0 && audio.muted) {
                audio.muted = false
                setIsMuted(false)
            }
        }
    }, [])

    const toggleMute = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return
        const nextMuted = !audio.muted
        audio.muted = nextMuted
        setIsMuted(nextMuted)
        // Restore an audible level if unmuting while volume sits at zero.
        if (!nextMuted && audio.volume === 0) {
            const restored = previousVolumeRef.current || 1
            audio.volume = restored
            setVolumeState(restored)
        }
    }, [])

    const retry = useCallback(() => {
        const audio = audioRef.current
        if (!audio || !hasAudio) return
        clearPendingPlay()
        setHasError(false)
        setErrorMessage("")
        setIsBuffering(true)
        audio.load()
        play(true)
    }, [clearPendingPlay, hasAudio, play])

    const loadAndPlay = useCallback(() => {
        const audio = audioRef.current
        if (!audio || !hasAudio) return
        audio.load()
        play(true)
    }, [hasAudio, play])

    // Wire up all <audio> events. Single rAF loop owns currentTime while playing.
    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        let lastUpdate = 0

        const readBuffered = () => {
            try {
                if (audio.buffered.length > 0) {
                    setBuffered(audio.buffered.end(audio.buffered.length - 1))
                }
            } catch {
                // buffered can throw before any data is loaded; ignore.
            }
        }

        const loop = (timestamp: number) => {
            if (!isSeekingRef.current) {
                currentTimeRef.current = audio.currentTime
                if (timestamp - lastUpdate >= 100) {
                    setCurrentTime(audio.currentTime)
                    lastUpdate = timestamp
                }
            }
            if (!audio.paused && !audio.ended) {
                animationFrameRef.current = requestAnimationFrame(loop)
            } else {
                animationFrameRef.current = null
            }
        }

        const handlePlay = () => {
            isPlayingRef.current = true
            setIsPlaying(true)
            setIsBuffering(false)
            if (animationFrameRef.current === null) {
                animationFrameRef.current = requestAnimationFrame(loop)
            }
        }
        const handlePause = () => {
            isPlayingRef.current = false
            setIsPlaying(false)
            stopLoop()
            // Snap to the exact paused position (the throttled loop may lag).
            currentTimeRef.current = audio.currentTime
            setCurrentTime(audio.currentTime)
        }
        const handleEnded = () => {
            isPlayingRef.current = false
            setIsPlaying(false)
            stopLoop()
            onEndedRef.current?.()
        }
        const handleLoadedMetadata = () => {
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
        }
        const handleWaiting = () => setIsBuffering(true)
        const clearBuffering = () => setIsBuffering(false)
        const handleError = () => {
            setIsBuffering(false)
            isPlayingRef.current = false
            setIsPlaying(false)
            setHasError(true)
            const error = audio.error
            switch (error?.code) {
                case error?.MEDIA_ERR_ABORTED:
                    setErrorMessage("Playback was aborted. Please try again.")
                    break
                case error?.MEDIA_ERR_NETWORK:
                    setErrorMessage(
                        "Network error. Check your connection and try again."
                    )
                    break
                case error?.MEDIA_ERR_DECODE:
                    setErrorMessage("Audio file is corrupted or unsupported.")
                    break
                case error?.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    setErrorMessage(
                        "Audio file not found or format not supported."
                    )
                    break
                default:
                    setErrorMessage("Failed to load audio. Please try again.")
            }
        }
        const handleLoadStart = () => {
            setHasError(false)
            setErrorMessage("")
        }

        audio.addEventListener("play", handlePlay)
        audio.addEventListener("pause", handlePause)
        audio.addEventListener("ended", handleEnded)
        audio.addEventListener("loadedmetadata", handleLoadedMetadata)
        audio.addEventListener("waiting", handleWaiting)
        audio.addEventListener("stalled", handleWaiting)
        audio.addEventListener("canplay", clearBuffering)
        audio.addEventListener("canplaythrough", clearBuffering)
        audio.addEventListener("playing", clearBuffering)
        audio.addEventListener("progress", readBuffered)
        audio.addEventListener("timeupdate", readBuffered)
        audio.addEventListener("error", handleError)
        audio.addEventListener("loadstart", handleLoadStart)

        return () => {
            stopLoop()
            audio.removeEventListener("play", handlePlay)
            audio.removeEventListener("pause", handlePause)
            audio.removeEventListener("ended", handleEnded)
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
            audio.removeEventListener("waiting", handleWaiting)
            audio.removeEventListener("stalled", handleWaiting)
            audio.removeEventListener("canplay", clearBuffering)
            audio.removeEventListener("canplaythrough", clearBuffering)
            audio.removeEventListener("playing", clearBuffering)
            audio.removeEventListener("progress", readBuffered)
            audio.removeEventListener("timeupdate", readBuffered)
            audio.removeEventListener("error", handleError)
            audio.removeEventListener("loadstart", handleLoadStart)
        }
    }, [stopLoop])

    // Reset + load whenever the source changes. Continues playing across track
    // changes; the initial load only plays when autoPlay is requested.
    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const isFirstLoad = isFirstLoadRef.current
        isFirstLoadRef.current = false
        const wasPlaying = isPlayingRef.current
        const shouldPlay = isFirstLoad ? autoPlay : wasPlaying

        clearPendingPlay()
        stopLoop()
        audio.pause()
        audio.currentTime = 0
        currentTimeRef.current = 0
        setSeeking(false)
        setCurrentTime(0)
        setDuration(0)
        setBuffered(0)
        setIsPlaying(false)
        setHasError(false)
        setErrorMessage("")
        setIsBuffering(false)

        if (!hasAudio) {
            audio.removeAttribute("src")
            audio.load()
            return
        }

        audio.load()
        if (shouldPlay) {
            // Don't surface an error toast for autoplay blocked on first load.
            play(!isFirstLoad)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src])

    // Keep the element's volume/loop in sync with state on mount + changes.
    useEffect(() => {
        const audio = audioRef.current
        if (audio) audio.volume = volume
    }, [volume])

    useEffect(() => {
        const audio = audioRef.current
        if (audio) audio.loop = loop
    }, [loop])

    return {
        audioRef,
        isPlaying,
        currentTime,
        duration,
        buffered,
        volume,
        isMuted,
        isBuffering,
        isSeeking,
        hasError,
        errorMessage,
        hasAudio,
        play,
        pause,
        toggle,
        seek,
        seekBy,
        setSeeking,
        setVolume,
        toggleMute,
        retry,
        loadAndPlay,
    }
}
