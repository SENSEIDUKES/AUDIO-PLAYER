import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
    AudioPlayerEngine,
    BufferedRange,
    Track,
    TrackSource,
    UseAudioPlayerOptions,
} from "./types"
import type { AudioBackend } from "./core/audio/AudioBackend"
import { createAudioBackend } from "./core/audio/AudioBackendFactory"
import {
    shouldEnterBuffering,
    createBufferingDebounce,
    type BufferingDebounce,
} from "./utils/buffering"
import { getTrackSources } from "./utils/sources"

type ActiveSourceState = {
    sourceKey: string
    signature: string
    index: number
}

function normalizeSource(source: TrackSource): TrackSource | null {
    const url = source.url?.trim() ?? ""
    if (!url) return null
    const type = source.type?.trim()
    return type ? { url, type } : { url }
}

function dedupeSources(sourceList: readonly TrackSource[]): TrackSource[] {
    const seen = new Set<string>()
    const next: TrackSource[] = []
    for (const source of sourceList) {
        const normalized = normalizeSource(source)
        if (!normalized || seen.has(normalized.url)) continue
        seen.add(normalized.url)
        next.push(normalized)
    }
    return next
}

function resolveEngineSources(
    src: string,
    sources?: readonly TrackSource[],
    fallbackSources?: readonly string[]
): TrackSource[] {
    const declaredSources = dedupeSources(sources ?? [])
    if (declaredSources.length > 0) return declaredSources

    return dedupeSources([
        { url: src },
        ...(fallbackSources ?? []).map((url) => ({ url })),
    ])
}

function sourceListSignature(sources: readonly TrackSource[]): string {
    return JSON.stringify(sources.map((source) => [source.url, source.type ?? ""]))
}

/**
 * Headless audio engine. Owns a playback backend (HTML5 `<audio>` element by
 * default, Web Audio API on request) and is the sole source of truth for
 * playback state. UI components read state and call actions; they never touch
 * the backend directly.
 *
 * Notable behavior:
 * - `currentTime` is driven by a single rAF loop while playing, and set
 *   explicitly on seek / pause / metadata. There is no second update path.
 * - When `src` changes, playback continues automatically if it was playing
 *   (track-change UX). The very first load only plays when `autoPlay` is set.
 * - Browsers block audible autoplay without a user gesture; `autoPlay` is a
 *   best-effort attempt, not a guarantee. When blocked, the engine exposes an
 *   `autoplayBlocked` flag so the UI can prompt the user for a tap.
 * - A monotonic `playbackToken` is bumped on every source / play-attempt
 *   boundary. Async callbacks captured before the swap check the token and
 *   no-op if it has changed, which removes the rapid-track-skip race.
 * - The backend is fixed at mount; remount (e.g. via `key`) to switch.
 */
export function useAudioPlayer(
    options: UseAudioPlayerOptions
): AudioPlayerEngine {
    const {
        src,
        fallbackSources,
        sources,
        sourceKey = src,
        autoPlay = false,
        loop = false,
        onEnded,
        onFallbackSource,
        audioBackend = "html5",
    } = options

    const resolvedSources = useMemo(
        () => resolveEngineSources(src, sources, fallbackSources),
        [fallbackSources, sources, src]
    )
    const sourcesSignature = useMemo(
        () => sourceListSignature(resolvedSources),
        [resolvedSources]
    )
    const [activeSourceState, setActiveSourceState] = useState<ActiveSourceState>(
        () => ({ sourceKey, signature: sourcesSignature, index: 0 })
    )
    const sourceStateMatches =
        activeSourceState.sourceKey === sourceKey &&
        activeSourceState.signature === sourcesSignature
    const currentSourceIndex = sourceStateMatches
        ? Math.max(
              0,
              Math.min(activeSourceState.index, resolvedSources.length - 1)
          )
        : 0
    const currentSource = resolvedSources[currentSourceIndex] ?? null
    const currentSrc = currentSource?.url ?? ""

    const audioRef = useRef<HTMLAudioElement>(null)
    const backendRef = useRef<AudioBackend | null>(null)
    if (backendRef.current === null) {
        backendRef.current = createAudioBackend(audioBackend, { audioRef })
    }
    const backendChangeWarnedRef = useRef(false)
    if (
        backendRef.current.getInfo().requested !== audioBackend &&
        !backendChangeWarnedRef.current
    ) {
        backendChangeWarnedRef.current = true
        console.warn(
            "[AudioPlayer] audioBackend changed after mount; the backend is " +
                "fixed at mount. Remount the player (e.g. with a key) to switch."
        )
    }

    const currentTimeRef = useRef(0)
    const isSeekingRef = useRef(false)
    const isPlayingRef = useRef(false)
    const playPromiseRef = useRef<Promise<void> | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const fadeFrameRef = useRef<number | null>(null)
    // Debounce for the buffering spinner. A `waiting`/`stalled` arms it; it
    // flips `isBuffering` true only if the stall outlasts the threshold. Cleared
    // by every buffering reset so a stale timer can never strand the spinner
    // after playback resumes.
    const bufferingDebounceRef = useRef<BufferingDebounce | null>(null)
    if (bufferingDebounceRef.current === null) {
        bufferingDebounceRef.current = createBufferingDebounce()
    }
    const isFirstLoadRef = useRef(true)
    const previousVolumeRef = useRef(1)
    const pendingSeekRef = useRef<number | null>(null)
    const onEndedRef = useRef(onEnded)
    onEndedRef.current = onEnded
    const onFallbackSourceRef = useRef(onFallbackSource)
    onFallbackSourceRef.current = onFallbackSource
    const sourceListRef = useRef(resolvedSources)
    const sourceKeyRef = useRef(sourceKey)
    const sourcesSignatureRef = useRef(sourcesSignature)
    const currentSourceIndexRef = useRef(currentSourceIndex)
    const currentSrcRef = useRef(currentSrc)
    const fallbackShouldPlayRef = useRef<boolean | null>(null)
    sourceListRef.current = resolvedSources
    sourceKeyRef.current = sourceKey
    sourcesSignatureRef.current = sourcesSignature
    currentSourceIndexRef.current = currentSourceIndex
    currentSrcRef.current = currentSrc
    /**
     * Bumped on any operation that should invalidate in-flight async audio
     * callbacks (src change, retry, loadAndPlay). Comparing the captured token
     * to the latest token is how we keep stale `play().then/.catch` from
     * clobbering state after a fast track skip.
     */
    const playbackTokenRef = useRef(0)
    /**
     * Stores the last token for which we already raised the autoplay-blocked
     * affordance, so we don't spam a state update for every rejected promise.
     */
    const lastAutoplayBlockedTokenRef = useRef(-1)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [buffered, setBuffered] = useState(0)
    const [bufferedRanges, setBufferedRanges] = useState<BufferedRange[]>([])
    const [volume, setVolumeState] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isSeeking, setIsSeekingState] = useState(false)
    const [isBuffering, setIsBuffering] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")
    const [autoplayBlocked, setAutoplayBlocked] = useState(false)
    const volumeUnsupportedRef = useRef(false)
    const [volumeUnsupported, setVolumeUnsupported] = useState(false)

    const hasAudio = currentSrc.trim().length > 0

    const bumpToken = useCallback(() => {
        playbackTokenRef.current += 1
        return playbackTokenRef.current
    }, [])

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

    // Cancel a pending debounced-spinner flip so it can't fire after the stall
    // has already resolved. Always paired with a buffering reset
    // (pause/ended/error/source-reset/canplay).
    const clearBufferingTimer = useCallback(() => {
        bufferingDebounceRef.current?.cancel()
    }, [])

    const tryFallbackSource = useCallback(
        (
            failedSource: string,
            error: string | null | undefined,
            shouldPlayAfterSwitch: boolean
        ): boolean => {
            const sourceList = sourceListRef.current
            const failedUrl = failedSource.trim()
            const previousActiveSource = currentSrcRef.current
            const activeIndex = currentSourceIndexRef.current
            const failedIndex = failedUrl
                ? sourceList.findIndex((source) => source.url === failedUrl)
                : -1
            const nextIndex = (failedIndex >= 0 ? failedIndex : activeIndex) + 1

            // If a stale error from a previous URL arrives after we've already
            // moved to its fallback, suppress it without advancing again.
            if (nextIndex <= activeIndex) return true
            if (nextIndex >= sourceList.length) return false

            const nextSource = sourceList[nextIndex]
            if (!nextSource?.url) return false

            bumpToken()
            clearPendingPlay()
            stopLoop()
            backendRef.current?.pause()
            if (fadeFrameRef.current !== null) {
                cancelAnimationFrame(fadeFrameRef.current)
                fadeFrameRef.current = null
            }

            fallbackShouldPlayRef.current = shouldPlayAfterSwitch
            currentSourceIndexRef.current = nextIndex
            currentSrcRef.current = nextSource.url
            setHasError(false)
            setErrorMessage("")
            setAutoplayBlocked(false)
            clearBufferingTimer()
            setIsBuffering(shouldPlayAfterSwitch)
            setActiveSourceState({
                sourceKey: sourceKeyRef.current,
                signature: sourcesSignatureRef.current,
                index: nextIndex,
            })

            onFallbackSourceRef.current?.({
                failedSource: failedUrl || previousActiveSource,
                nextSource: nextSource.url,
                nextSourceType: nextSource.type,
                sourceIndex: nextIndex,
                sourceCount: sourceList.length,
                error: error ?? null,
            })

            return true
        },
        [bumpToken, clearPendingPlay, stopLoop, clearBufferingTimer]
    )

    const setSeeking = useCallback((active: boolean) => {
        isSeekingRef.current = active
        setIsSeekingState(active)
    }, [])

    const play = useCallback(
        (reportError = true) => {
            const backend = backendRef.current!
            if (!backend.isAttached() || !hasAudio) return

            const token = bumpToken()
            clearPendingPlay()
            setHasError(false)
            setErrorMessage("")

            let playPromise: Promise<void>
            try {
                playPromise = backend.play()
            } catch (error: unknown) {
                if (playbackTokenRef.current !== token) return
                const name = error instanceof Error ? error.name : ""
                if (tryFallbackSource(currentSrcRef.current, name || "unknown", true)) {
                    return
                }
                if (reportError) {
                    setHasError(true)
                    setErrorMessage("Playback failed. Please try again.")
                }
                return
            }
            playPromiseRef.current = playPromise

            playPromise
                .then(() => {
                    if (playbackTokenRef.current !== token) return
                    if (playPromiseRef.current === playPromise) {
                        playPromiseRef.current = null
                    }
                })
                .catch((error: unknown) => {
                    if (playbackTokenRef.current !== token) return
                    if (playPromiseRef.current === playPromise) {
                        playPromiseRef.current = null
                    }
                    const name = error instanceof Error ? error.name : ""
                    if (name === "AbortError") return

                    // Browsers throw NotAllowedError when autoplay is blocked.
                    // Surface this through a dedicated UI flag rather than the
                    // generic error banner.
                    if (name === "NotAllowedError") {
                        if (lastAutoplayBlockedTokenRef.current !== token) {
                            lastAutoplayBlockedTokenRef.current = token
                            setAutoplayBlocked(true)
                        }
                        setIsPlaying(false)
                        clearBufferingTimer()
                        setIsBuffering(false)
                        return
                    }

                    if (
                        tryFallbackSource(
                            backend.getMediaElement()?.currentSrc || currentSrcRef.current,
                            name || backend.getError() || "unknown",
                            true
                        )
                    ) {
                        return
                    }

                    setIsPlaying(false)
                    clearBufferingTimer()
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
        [bumpToken, clearPendingPlay, hasAudio, tryFallbackSource, clearBufferingTimer]
    )

    const pause = useCallback(() => {
        const backend = backendRef.current!
        if (!backend.isAttached()) return

        const pending = playPromiseRef.current
        if (pending) {
            // Bump the token so the in-flight play() does not flip state back
            // to "playing" once the browser finally resolves it.
            bumpToken()
            pending
                .catch(() => {})
                .finally(() => {
                    if (playPromiseRef.current === pending) {
                        playPromiseRef.current = null
                    }
                    backend.pause()
                })
            return
        }
        backend.pause()
    }, [bumpToken])

    const toggle = useCallback(() => {
        if (!hasAudio) return
        // Haptic feedback for play/pause toggle on touch devices that support it.
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
                navigator.vibrate(10)
            } catch (err) {
                // Ignore vibration failures (e.g. blocked by permissions policy)
            }
        }
        if (isPlayingRef.current) pause()
        else play(true)
    }, [hasAudio, pause, play])

    const seek = useCallback(
        (time: number) => {
            const backend = backendRef.current!
            if (!backend.isAttached() || !hasAudio) return
            if (duration <= 0) {
                pendingSeekRef.current = time
                return
            }
            pendingSeekRef.current = null
            const next = Math.max(0, Math.min(duration, time))
            backend.setCurrentTime(next)
            currentTimeRef.current = next
            setCurrentTime(next)
        },
        [duration, hasAudio]
    )

    const seekBy = useCallback(
        (delta: number) => {
            const backend = backendRef.current!
            if (!backend.isAttached()) return
            seek(backend.getCurrentTime() + delta)
        },
        [seek]
    )

    const setVolume = useCallback((value: number) => {
        if (fadeFrameRef.current !== null) {
            cancelAnimationFrame(fadeFrameRef.current)
            fadeFrameRef.current = null
        }
        const backend = backendRef.current!
        const next = Math.max(0, Math.min(1, value))
        previousVolumeRef.current = next > 0 ? next : previousVolumeRef.current
        setVolumeState(next)
        if (backend.isAttached()) {
            if (!volumeUnsupportedRef.current && next !== 0) {
                // iOS Safari (and a few other mobile browsers) ignore
                // programmatic volume. Detect this once and surface it to the
                // UI rather than silently letting the slider appear to work.
                backend.setVolume(next)
                if (Math.abs(backend.getVolume() - next) > 0.001) {
                    volumeUnsupportedRef.current = true
                    setVolumeUnsupported(true)
                }
            } else {
                backend.setVolume(next)
            }
            // Dragging the slider above zero implicitly unmutes.
            if (next > 0 && backend.isMuted()) {
                backend.setMuted(false)
                setIsMuted(false)
            }
        }
    }, [])

    const toggleMute = useCallback(() => {
        if (fadeFrameRef.current !== null) {
            cancelAnimationFrame(fadeFrameRef.current)
            fadeFrameRef.current = null
        }
        const backend = backendRef.current!
        if (!backend.isAttached()) return
        const nextMuted = !backend.isMuted()
        backend.setMuted(nextMuted)
        setIsMuted(nextMuted)
        // Restore an audible level if unmuting while volume sits at zero.
        if (!nextMuted && backend.getVolume() === 0) {
            const restored = previousVolumeRef.current || 1
            backend.setVolume(restored)
            setVolumeState(restored)
        }
    }, [])

    const retry = useCallback(() => {
        const backend = backendRef.current!
        if (!backend.isAttached() || !hasAudio) return
        bumpToken()
        clearPendingPlay()
        setHasError(false)
        setErrorMessage("")
        setAutoplayBlocked(false)
        clearBufferingTimer()
        setIsBuffering(true)
        backend.load()
        play(true)
    }, [bumpToken, clearPendingPlay, clearBufferingTimer, hasAudio, play])

    const loadAndPlay = useCallback(() => {
        const backend = backendRef.current!
        if (!backend.isAttached() || !hasAudio) return
        bumpToken()
        backend.load()
        play(true)
    }, [bumpToken, hasAudio, play])

    const dismissAutoplayBlocked = useCallback(() => {
        setAutoplayBlocked(false)
    }, [])

    const preload = useCallback((track: Track) => {
        for (const source of getTrackSources(track)) {
            backendRef.current!.preload(source.url)
        }
    }, [])

    const unload = useCallback(() => {
        const backend = backendRef.current!
        if (!backend.isAttached()) return
        bumpToken()
        clearPendingPlay()
        stopLoop()
        backend.pause()
        backend.clearSource()
        currentTimeRef.current = 0
        setCurrentTime(0)
        setDuration(0)
        setBuffered(0)
        setBufferedRanges([])
        setIsPlaying(false)
        isPlayingRef.current = false
        setHasError(false)
        setErrorMessage("")
        clearBufferingTimer()
        setIsBuffering(false)
        setAutoplayBlocked(false)
        pendingSeekRef.current = null
        if (fadeFrameRef.current !== null) {
            cancelAnimationFrame(fadeFrameRef.current)
            fadeFrameRef.current = null
        }
        backend.releasePreload()
    }, [bumpToken, clearPendingPlay, stopLoop, clearBufferingTimer])

    const fade = useCallback((to: number, durationMs: number) => {
        const backend = backendRef.current!
        if (!backend.isAttached()) return
        const target = Math.max(0, Math.min(1, to))
        if (durationMs <= 0) {
            if (fadeFrameRef.current !== null) {
                cancelAnimationFrame(fadeFrameRef.current)
                fadeFrameRef.current = null
            }
            backend.setVolume(target)
            setVolumeState(target)
            return
        }
        const startVolume = backend.getVolume()
        const startTime = performance.now()
        if (fadeFrameRef.current !== null) {
            cancelAnimationFrame(fadeFrameRef.current)
        }
        const step = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(1, elapsed / durationMs)
            const next = startVolume + (target - startVolume) * progress
            const clamped = Math.max(0, Math.min(1, next))
            backend.setVolume(clamped)
            setVolumeState(clamped)
            if (progress < 1) {
                fadeFrameRef.current = requestAnimationFrame(step)
            } else {
                fadeFrameRef.current = null
            }
        }
        fadeFrameRef.current = requestAnimationFrame(step)
    }, [])

    // Wire up all backend events. Single rAF loop owns currentTime while playing.
    //
    // Mount contract: hosts render the <audio> element in the same commit as
    // this hook call (AudioPlayer/AudioSessionProvider both do), so for the
    // html5 backend the ref is populated before effects run; the webaudio
    // backend is always attached. A host that mounts the element in a LATER
    // commit would never get listeners attached — same as the pre-backend
    // behavior, and intentionally not supported.
    useEffect(() => {
        const backend = backendRef.current!
        if (!backend.isAttached()) return

        let lastUpdate = 0

        const readBuffered = () => {
            try {
                const ranges = backend.getBufferedRanges()
                if (ranges.length > 0) {
                    // Collect all ranges so the UI can render multi-segment
                    // buffers (e.g. after seeks that leave gaps).
                    let furthest = 0
                    for (const range of ranges) {
                        if (range.end > furthest) furthest = range.end
                    }
                    setBufferedRanges(ranges)
                    setBuffered(furthest)
                } else {
                    setBufferedRanges([])
                    setBuffered(0)
                }
            } catch {
                // buffered can throw before any data is loaded; ignore.
            }
        }

        const loop = (timestamp: number) => {
            if (!isSeekingRef.current) {
                currentTimeRef.current = backend.getCurrentTime()
                // Update state once per ~16ms (one frame). The previous 100ms
                // throttle caused visible stutter on 120Hz displays; the audio
                // element's `timeupdate` event still fires at 4Hz on most
                // browsers, so we drive smooth UI from rAF instead.
                if (timestamp - lastUpdate >= 16) {
                    setCurrentTime(backend.getCurrentTime())
                    lastUpdate = timestamp
                }
            }
            if (!backend.isPaused() && !backend.isEnded()) {
                animationFrameRef.current = requestAnimationFrame(loop)
            } else {
                animationFrameRef.current = null
            }
        }

        const handlePlay = () => {
            isPlayingRef.current = true
            setIsPlaying(true)
            clearBufferingTimer()
            setIsBuffering(false)
            setAutoplayBlocked(false)
            if (animationFrameRef.current === null) {
                animationFrameRef.current = requestAnimationFrame(loop)
            }
        }
        const handlePause = () => {
            isPlayingRef.current = false
            setIsPlaying(false)
            // Pausing ends any active playback wait; never leave the spinner
            // armed (or about to arm) once playback has stopped.
            clearBufferingTimer()
            setIsBuffering(false)
            stopLoop()
            // Snap to the exact paused position (the throttled loop may lag).
            currentTimeRef.current = backend.getCurrentTime()
            setCurrentTime(backend.getCurrentTime())
        }
        const handleEnded = () => {
            isPlayingRef.current = false
            setIsPlaying(false)
            clearBufferingTimer()
            setIsBuffering(false)
            stopLoop()
            // Snap to exact duration so the progress bar reaches 100% even when
            // the rAF loop's throttle left it a frame short.
            setCurrentTime(backend.getDuration() || backend.getCurrentTime())
            onEndedRef.current?.()
        }
        const handleLoadedMetadata = () => {
            const rawDuration = backend.getDuration()
            const loadedDuration = Number.isFinite(rawDuration) ? rawDuration : 0
            setDuration(loadedDuration)
            const pending = pendingSeekRef.current
            if (pending !== null && loadedDuration > 0) {
                pendingSeekRef.current = null
                const clamped = Math.max(0, Math.min(loadedDuration, pending))
                backend.setCurrentTime(clamped)
                currentTimeRef.current = clamped
                setCurrentTime(clamped)
            }
        }
        const handleWaiting = () => {
            // `waiting`/`stalled` also fire during passive preload while paused;
            // only treat them as buffering when playback is actually active or a
            // play attempt is pending, otherwise the spinner appears at idle/0:00.
            if (
                !shouldEnterBuffering({
                    isPlaying: isPlayingRef.current,
                    isPaused: backend.isPaused(),
                    hasPendingPlay: playPromiseRef.current !== null,
                })
            ) {
                return
            }
            // Debounce: routine mid-playback blips and track-to-track handoffs
            // also fire `waiting`. Only surface the spinner once the stall has
            // outlasted the threshold; a resolution (`playing`/`canplay`/pause/
            // ended/error/source-reset) cancels this pending flip first.
            bufferingDebounceRef.current?.schedule(() => setIsBuffering(true))
        }
        const clearBuffering = () => {
            clearBufferingTimer()
            setIsBuffering(false)
        }
        const handleError = () => {
            const error = backend.getError()
            const failedSource = currentSrcRef.current
            const shouldPlayFallback =
                isPlayingRef.current || playPromiseRef.current !== null
            if (tryFallbackSource(failedSource, error, shouldPlayFallback)) {
                return
            }

            clearBufferingTimer()
            setIsBuffering(false)
            isPlayingRef.current = false
            setIsPlaying(false)
            setHasError(true)
            switch (error) {
                case "aborted":
                    setErrorMessage("Playback was aborted. Please try again.")
                    break
                case "network":
                    setErrorMessage(
                        "Network error. Check your connection and try again."
                    )
                    break
                case "decode":
                    setErrorMessage("Audio file is corrupted or unsupported.")
                    break
                case "src-not-supported":
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

        backend.addEventListener("play", handlePlay)
        backend.addEventListener("pause", handlePause)
        backend.addEventListener("ended", handleEnded)
        backend.addEventListener("loadedmetadata", handleLoadedMetadata)
        backend.addEventListener("waiting", handleWaiting)
        backend.addEventListener("stalled", handleWaiting)
        backend.addEventListener("canplay", clearBuffering)
        backend.addEventListener("canplaythrough", clearBuffering)
        backend.addEventListener("playing", clearBuffering)
        backend.addEventListener("progress", readBuffered)
        backend.addEventListener("timeupdate", readBuffered)
        backend.addEventListener("error", handleError)
        backend.addEventListener("loadstart", handleLoadStart)

        // If the source was already cached the loadedmetadata event fires before
        // the effect runs. Catch that case by reading the metadata synchronously.
        if (backend.hasMetadata()) {
            handleLoadedMetadata()
            readBuffered()
        }

        return () => {
            stopLoop()
            clearBufferingTimer()
            if (fadeFrameRef.current !== null) {
                cancelAnimationFrame(fadeFrameRef.current)
                fadeFrameRef.current = null
            }
            backend.removeEventListener("play", handlePlay)
            backend.removeEventListener("pause", handlePause)
            backend.removeEventListener("ended", handleEnded)
            backend.removeEventListener("loadedmetadata", handleLoadedMetadata)
            backend.removeEventListener("waiting", handleWaiting)
            backend.removeEventListener("stalled", handleWaiting)
            backend.removeEventListener("canplay", clearBuffering)
            backend.removeEventListener("canplaythrough", clearBuffering)
            backend.removeEventListener("playing", clearBuffering)
            backend.removeEventListener("progress", readBuffered)
            backend.removeEventListener("timeupdate", readBuffered)
            backend.removeEventListener("error", handleError)
            backend.removeEventListener("loadstart", handleLoadStart)
        }
    }, [stopLoop, tryFallbackSource, clearBufferingTimer])

    // Reset + load whenever the source changes. Continues playing across track
    // changes; the initial load only plays when autoPlay is requested.
    useEffect(() => {
        const backend = backendRef.current!
        if (!backend.isAttached()) return

        const isFallbackSwitch = fallbackShouldPlayRef.current !== null
        const isFirstLoad = isFirstLoadRef.current
        isFirstLoadRef.current = false
        const wasPlaying = isPlayingRef.current
        const shouldPlay = isFallbackSwitch
            ? fallbackShouldPlayRef.current === true
            : isFirstLoad
              ? autoPlay
              : wasPlaying
        fallbackShouldPlayRef.current = null

        // Bump the token up front so any in-flight play() / error handlers
        // from the previous source become no-ops.
        const token = bumpToken()
        clearPendingPlay()
        stopLoop()
        backend.pause()
        if (fadeFrameRef.current !== null) {
            cancelAnimationFrame(fadeFrameRef.current)
            fadeFrameRef.current = null
        }

        // On the first mount, don't reset state or call load() when the source
        // is already loaded/loading from a cache hit. Resetting would discard
        // the browser's preloaded data and make the hasMetadata() synchronous
        // check in the event-listener effect useless.
        if (!isFirstLoad) {
            backend.setCurrentTime(0)
            currentTimeRef.current = 0
            setSeeking(false)
            setCurrentTime(0)
            setDuration(0)
            setBuffered(0)
            setBufferedRanges([])
            setIsPlaying(false)
            setHasError(false)
            setErrorMessage("")
            clearBufferingTimer()
            setIsBuffering(false)
            setAutoplayBlocked(false)
            pendingSeekRef.current = null
        }

        if (!hasAudio) {
            backend.clearSource()
            return
        }

        // No-op for html5 (the host JSX owns the src attribute); arms the URL
        // for the webaudio backend.
        backend.setSource(currentSrc)
        if (!isFirstLoad) {
            backend.load()
        }
        if (shouldPlay) {
            // Don't surface an error toast for autoplay blocked on first load;
            // the autoplay-blocked affordance handles that case.
            if (isFirstLoad) {
                let playPromise: Promise<void> | null
                try {
                    playPromise = backend.play()
                } catch {
                    return
                }
                if (playPromise) {
                    playPromiseRef.current = playPromise
                    playPromise
                        .then(() => {
                            if (playbackTokenRef.current !== token) return
                            if (playPromiseRef.current === playPromise) {
                                playPromiseRef.current = null
                            }
                        })
                        .catch((error: unknown) => {
                            if (playbackTokenRef.current !== token) return
                            if (playPromiseRef.current === playPromise) {
                                playPromiseRef.current = null
                            }
                            const name =
                                error instanceof Error ? error.name : ""
                            if (name === "AbortError") return
                            if (name === "NotAllowedError") {
                                if (
                                    lastAutoplayBlockedTokenRef.current !==
                                    token
                                ) {
                                    lastAutoplayBlockedTokenRef.current =
                                        token
                                    setAutoplayBlocked(true)
                                }
                                setIsPlaying(false)
                                clearBufferingTimer()
                                setIsBuffering(false)
                                return
                            }
                            setHasError(true)
                            setErrorMessage(
                                name === "NotSupportedError"
                                    ? "Audio file not found or format not supported."
                                    : "Playback failed. Please try again."
                            )
                        })
                }
            } else {
                play(!isFirstLoad)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSrc, sourceKey, sourcesSignature])

    // Keep the backend's volume/loop in sync with state on mount + changes.
    useEffect(() => {
        const backend = backendRef.current!
        if (backend.isAttached()) backend.setVolume(volume)
    }, [volume])

    useEffect(() => {
        const backend = backendRef.current!
        if (backend.isAttached()) backend.setLoop(loop)
    }, [loop])

    // Release backend resources on unmount. destroy() is revivable, so React
    // StrictMode's unmount/remount cycle recreates what it needs lazily.
    useEffect(() => {
        return () => {
            backendRef.current?.destroy()
        }
    }, [])

    const getBackendInfo = useCallback(() => backendRef.current!.getInfo(), [])
    const getDecodedData = useCallback(
        () => backendRef.current!.getDecodedData(),
        []
    )

    return {
        audioRef,
        isPlaying,
        currentTime,
        duration,
        buffered,
        bufferedRanges,
        volume,
        isMuted,
        isBuffering,
        isSeeking,
        hasError,
        errorMessage,
        hasAudio,
        currentSrc,
        currentSourceIndex,
        sourceCount: resolvedSources.length,
        volumeUnsupported,
        autoplayBlocked,
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
        dismissAutoplayBlocked,
        preload,
        unload,
        fade,
        getBackendInfo,
        getDecodedData,
    }
}
