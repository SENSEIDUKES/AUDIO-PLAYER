import { useCallback, useEffect, useRef, useState } from "react"
import type { AudioPlayerEngine, Track } from "../types"
import { trackKey } from "../utils/trackKey"
import { ensureTrackAnalysis, getTrackTrims } from "./silenceAnalysis"

/**
 * Automix Lite: opt-in two-deck crossfade transitions between queued tracks.
 *
 * The hook deliberately does NOT touch the engine's internals. The engine's
 * single <audio> element ("deck A") stays the source of truth; this hook owns
 * one detached, never-rendered second element ("deck B") that only exists
 * around a transition. The lifecycle is:
 *
 *   idle ──(near end of A)──▶ preloading: deck B loads the next track and is
 *        parked at its silence-trimmed start; silence analysis runs.
 *   preloading ──(fade window)──▶ fading: deck B plays while an equal-power
 *        ramp swaps the audible balance from A to B over AUTOMIX_FADE_MS.
 *   fading ──(ramp done / A ended)──▶ handoff: the host advances its queue
 *        exactly like a normal end-of-track advance, the engine reloads the
 *        main element with B's URL (HTTP-cached — deck B just fetched it),
 *        the hook time-syncs the main element to deck B and, on its first
 *        'playing', flips the audio back to the main element and releases the
 *        deck. From here on, playback is indistinguishable from normal mode.
 *
 * Anything unexpected — pause, seek away, manual next/previous, queue edits,
 * deck errors, blocked play(), unsupported programmatic volume (iOS Safari) —
 * cancels the transition, restores the engine volume, and falls back to the
 * existing end-of-track behavior. With `enabled` false the hook is inert.
 */

/** Crossfade duration. Conservative fixed value for V1. */
export const AUTOMIX_FADE_MS = 5500
/** How far before the (trimmed) end of A deck B starts preloading. */
const PRELOAD_LEAD_S = 15
/** Tracks shorter than this never automix. */
const MIN_TRACK_S = 25
/** Backward currentTime jump beyond this cancels an active fade. */
const SEEK_BACK_TOLERANCE_S = 0.75
/** Give up on a handoff if the main element never reaches 'playing'. */
const HANDOFF_TIMEOUT_MS = 6000
/** Re-sync the main element at flip time if it drifted past this. */
const MAX_FLIP_DRIFT_S = 0.35

export interface UseAutomixOptions {
    engine: AudioPlayerEngine
    /** Master switch. When false the hook does nothing at all. */
    enabled: boolean
    /** The host's source identity key (its `sourceKey`). */
    sourceKey: string
    currentTrack: Track | null
    /**
     * The track that would play after the current one, already resolved by the
     * host through its own shuffle/repeat order. Pass `null` when there is no
     * automixable next track (single-track mode, repeat-one, end of queue, or
     * the next index equals the current one).
     */
    nextTrack: Track | null
    /**
     * Advance the queue to the next track using the host's normal end-of-track
     * path (deferred play + index change). Must NOT route back through the
     * host's `onEnded` guard, or the advance would suppress itself.
     */
    requestAdvance: () => void
}

export interface AutomixController {
    /** True while a crossfade or handoff is in progress. */
    isTransitioning: boolean
    /**
     * Must be called first inside the host's end-of-track advance handler.
     * Returns true when automix already advanced (or is advancing) the queue,
     * in which case the host must skip its own advance.
     */
    handleTrackEnded: () => boolean
}

type Phase = "idle" | "preloading" | "fading" | "handoff"

/**
 * Page-wide latch: once a browser proves it ignores programmatic element
 * volume (iOS Safari), crossfading is impossible. Automix then leaves
 * playback entirely to the normal end-of-track behavior.
 */
let fadeUnsupported = false

export function useAutomix(options: UseAutomixOptions): AutomixController {
    const { engine, enabled, sourceKey, currentTrack, nextTrack } = options

    const optionsRef = useRef(options)
    optionsRef.current = options
    const volumeRef = useRef(engine.volume)
    volumeRef.current = engine.volume

    const phaseRef = useRef<Phase>("idle")
    const deckRef = useRef<HTMLAudioElement | null>(null)
    const deckAbortRef = useRef<AbortController | null>(null)
    const preloadedKeyRef = useRef<string | null>(null)
    const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const fadeT0Ref = useRef(0)
    const fadeAnchorRef = useRef(0)
    const pendingHandoffRef = useRef<string | null>(null)
    const handoffAbortRef = useRef<AbortController | null>(null)
    const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    /** `${sourceKey}->${nextKey}` pairs that errored; never retried. */
    const failedPairRef = useRef<string | null>(null)
    const prevSourceKeyRef = useRef(sourceKey)

    const [isTransitioning, setIsTransitioning] = useState(false)

    const stopRamp = useCallback(() => {
        if (fadeIntervalRef.current !== null) {
            clearInterval(fadeIntervalRef.current)
            fadeIntervalRef.current = null
        }
    }, [])

    const releaseDeck = useCallback(() => {
        deckAbortRef.current?.abort()
        deckAbortRef.current = null
        preloadedKeyRef.current = null
        const deck = deckRef.current
        deckRef.current = null
        if (deck) {
            try {
                deck.pause()
                deck.removeAttribute("src")
                deck.load()
            } catch {
                // Best-effort release; the element is unreferenced either way.
            }
        }
    }, [])

    const clearHandoff = useCallback(() => {
        pendingHandoffRef.current = null
        handoffAbortRef.current?.abort()
        handoffAbortRef.current = null
        if (handoffTimerRef.current !== null) {
            clearTimeout(handoffTimerRef.current)
            handoffTimerRef.current = null
        }
    }, [])

    /** Abort any in-flight transition and restore normal playback audio. */
    const cancel = useCallback(() => {
        const wasAudible =
            phaseRef.current === "fading" || phaseRef.current === "handoff"
        stopRamp()
        clearHandoff()
        releaseDeck()
        phaseRef.current = "idle"
        setIsTransitioning(false)
        if (wasAudible) {
            const main = optionsRef.current.engine.audioRef.current
            if (main) {
                try {
                    main.volume = volumeRef.current
                } catch {
                    // iOS Safari: element volume is read-only; nothing to undo.
                }
            }
        }
    }, [clearHandoff, releaseDeck, stopRamp])

    /**
     * The fade is over (ramp completed, or A reached its natural end first).
     * Mark the upcoming source change as ours; optionally trigger it.
     */
    const finalizeFade = useCallback(
        (advance: boolean) => {
            stopRamp()
            pendingHandoffRef.current = preloadedKeyRef.current
            phaseRef.current = "handoff"
            if (advance) optionsRef.current.requestAdvance()
        },
        [stopRamp]
    )

    const handleTrackEnded = useCallback((): boolean => {
        if (phaseRef.current === "fading") {
            // A ran out mid-fade (trim estimate was short). Let the host run
            // its single normal advance and treat the swap as our handoff.
            finalizeFade(false)
            return false
        }
        // During handoff the advance already happened; suppress the host's.
        return phaseRef.current === "handoff"
    }, [finalizeFade])

    /** Wire deck B for the resolved next track and park it at its trim start. */
    const startPreload = useCallback(
        (next: Track) => {
            if (typeof Audio === "undefined") return
            const src = next.audioFile?.trim()
            if (!src) return
            const key = trackKey(next)
            const deck = new Audio()
            deck.preload = "auto"
            try {
                deck.volume = 0
            } catch {
                // Checked again (with fallback) before the fade starts.
            }
            deck.src = src
            const ac = new AbortController()
            const applyTrimStart = () => {
                const trims = getTrackTrims(next)
                if (!trims || trims.trimStartMs <= 0) return
                if (deck.paused && deck.readyState >= 1) {
                    try {
                        deck.currentTime = trims.trimStartMs / 1000
                    } catch {
                        // Falls back to the natural track start.
                    }
                }
            }
            deck.addEventListener("loadedmetadata", applyTrimStart, {
                signal: ac.signal,
            })
            deck.addEventListener(
                "error",
                () => {
                    failedPairRef.current = `${optionsRef.current.sourceKey}->${key}`
                    if (
                        phaseRef.current === "fading" ||
                        phaseRef.current === "handoff"
                    ) {
                        cancel()
                    } else if (phaseRef.current === "preloading") {
                        releaseDeck()
                        phaseRef.current = "idle"
                    }
                },
                { signal: ac.signal }
            )
            try {
                deck.load()
            } catch {
                return
            }
            deckAbortRef.current = ac
            deckRef.current = deck
            preloadedKeyRef.current = key
            phaseRef.current = "preloading"
            void ensureTrackAnalysis(next).then(applyTrimStart)
        },
        [cancel, releaseDeck]
    )

    /**
     * Equal-power ramp driven by wall-clock setInterval (keeps progressing in
     * throttled background tabs, unlike rAF). Re-reads the user volume every
     * tick so a mid-fade volume change re-targets instead of fighting.
     */
    const runRamp = useCallback(() => {
        const tick = () => {
            if (phaseRef.current !== "fading") {
                stopRamp()
                return
            }
            const main = optionsRef.current.engine.audioRef.current
            const deck = deckRef.current
            if (!main || !deck) {
                cancel()
                return
            }
            const t = Math.min(
                1,
                (performance.now() - fadeT0Ref.current) / AUTOMIX_FADE_MS
            )
            const vol = volumeRef.current
            const mainTarget = Math.cos((t * Math.PI) / 2) * vol
            const deckTarget = Math.sin((t * Math.PI) / 2) * vol
            try {
                main.volume = mainTarget
                deck.volume = deckTarget
            } catch {
                fadeUnsupported = true
                cancel()
                return
            }
            if (vol > 0.1 && Math.abs(main.volume - mainTarget) > 0.05) {
                // The write didn't stick: this browser ignores programmatic
                // volume. Latch and bail out to plain end-of-track behavior.
                fadeUnsupported = true
                cancel()
                return
            }
            if (t >= 1) {
                stopRamp()
                finalizeFade(true)
            }
        }
        stopRamp()
        fadeIntervalRef.current = setInterval(tick, 33)
    }, [cancel, finalizeFade, stopRamp])

    const startFade = useCallback(() => {
        const opts = optionsRef.current
        const main = opts.engine.audioRef.current
        const deck = deckRef.current
        if (!main || !deck) return
        if (fadeUnsupported || opts.engine.volumeUnsupported) return
        // Wait for enough deck data; retried every tick until A actually ends.
        if (deck.readyState < 2) return
        try {
            deck.volume = 0
            if (deck.volume > 0.001) {
                fadeUnsupported = true
                return
            }
            deck.muted = main.muted
        } catch {
            fadeUnsupported = true
            return
        }
        let playPromise: Promise<void>
        try {
            playPromise = deck.play()
        } catch {
            failedPairRef.current = `${opts.sourceKey}->${preloadedKeyRef.current}`
            releaseDeck()
            phaseRef.current = "idle"
            return
        }
        phaseRef.current = "fading"
        setIsTransitioning(true)
        fadeT0Ref.current = performance.now()
        fadeAnchorRef.current = opts.engine.currentTime
        playPromise
            .then(() => {
                if (phaseRef.current === "fading") runRamp()
            })
            .catch(() => {
                // Autoplay policy (or anything else) rejected the second deck:
                // give up on this transition and let the track end normally.
                if (phaseRef.current === "fading") {
                    failedPairRef.current = `${optionsRef.current.sourceKey}->${preloadedKeyRef.current}`
                    cancel()
                }
            })
    }, [cancel, releaseDeck, runRamp])

    /**
     * After our requestAdvance, the host swaps sources and the engine reloads
     * the main element with B's URL. Sync it to deck B's position and flip the
     * audible output back to the main element on its first 'playing'.
     */
    const attachHandoff = useCallback(() => {
        pendingHandoffRef.current = null
        const main = optionsRef.current.engine.audioRef.current
        const deck = deckRef.current
        if (!main || !deck) {
            cancel()
            return
        }
        const ac = new AbortController()
        handoffAbortRef.current = ac
        const syncTime = () => {
            try {
                main.currentTime = deck.currentTime
            } catch {
                // Engine state is still consistent; B just starts from 0.
            }
        }
        if (main.readyState >= 1) syncTime()
        else {
            main.addEventListener("loadedmetadata", syncTime, {
                signal: ac.signal,
                once: true,
            })
        }
        main.addEventListener(
            "playing",
            () => {
                try {
                    if (
                        Math.abs(deck.currentTime - main.currentTime) >
                        MAX_FLIP_DRIFT_S
                    ) {
                        syncTime()
                    }
                    main.volume = volumeRef.current
                } catch {
                    // Volume restore is best-effort on volume-locked browsers.
                }
                clearHandoff()
                releaseDeck()
                phaseRef.current = "idle"
                setIsTransitioning(false)
            },
            { signal: ac.signal, once: true }
        )
        main.addEventListener("error", cancel, { signal: ac.signal, once: true })
        // If playback never starts (autoplay re-blocked, network), stop the
        // deck and restore volume so the existing error/blocked UI takes over.
        handoffTimerRef.current = setTimeout(cancel, HANDOFF_TIMEOUT_MS)
    }, [cancel, clearHandoff, releaseDeck])

    // Source identity changed: either it's the swap we requested (continue the
    // handoff against the reloaded main element) or the user/host navigated
    // somewhere else (cancel anything in flight).
    useEffect(() => {
        if (prevSourceKeyRef.current === sourceKey) return
        prevSourceKeyRef.current = sourceKey
        const expected = pendingHandoffRef.current
        const current = optionsRef.current.currentTrack
        if (
            expected !== null &&
            phaseRef.current === "handoff" &&
            current &&
            trackKey(current) === expected
        ) {
            attachHandoff()
            return
        }
        if (phaseRef.current !== "idle") cancel()
    }, [sourceKey, attachHandoff, cancel])

    // Analyze the active track ahead of time so its tail trim is known before
    // the transition window opens. Analysis only ever runs while enabled.
    useEffect(() => {
        if (enabled && currentTrack) void ensureTrackAnalysis(currentTrack)
    }, [enabled, currentTrack])

    useEffect(() => {
        if (!enabled && phaseRef.current !== "idle") cancel()
    }, [enabled, cancel])

    // Transition trigger/supervisor. Runs on every engine time tick while
    // playing — cheap comparisons only.
    useEffect(() => {
        if (!enabled) return
        const phase = phaseRef.current
        const { isPlaying, isSeeking, duration, currentTime, hasError } = engine

        if (phase === "fading") {
            if (!isPlaying || isSeeking || hasError) {
                cancel()
                return
            }
            if (currentTime < fadeAnchorRef.current - SEEK_BACK_TOLERANCE_S) {
                cancel()
                return
            }
            if (!nextTrack || trackKey(nextTrack) !== preloadedKeyRef.current) {
                cancel()
                return
            }
            return
        }
        if (phase === "handoff") return

        if (!currentTrack || !nextTrack) {
            if (phase === "preloading") {
                releaseDeck()
                phaseRef.current = "idle"
            }
            return
        }
        if (!isPlaying || isSeeking || hasError) return
        if (duration < MIN_TRACK_S) return

        const nextKey = trackKey(nextTrack)
        if (failedPairRef.current === `${sourceKey}->${nextKey}`) return

        const trims = getTrackTrims(currentTrack)
        const effectiveEnd = duration - (trims ? trims.trimEndMs / 1000 : 0)
        const fadeStartAt = Math.max(
            effectiveEnd - AUTOMIX_FADE_MS / 1000,
            duration * 0.5
        )

        if (phase === "idle") {
            if (currentTime >= effectiveEnd - PRELOAD_LEAD_S) {
                startPreload(nextTrack)
            }
            return
        }
        // preloading
        if (preloadedKeyRef.current !== nextKey) {
            // Shuffle/repeat/queue changes resolved a different next track.
            releaseDeck()
            phaseRef.current = "idle"
            return
        }
        if (currentTime >= fadeStartAt) startFade()
    }, [
        enabled,
        engine,
        sourceKey,
        currentTrack,
        nextTrack,
        cancel,
        releaseDeck,
        startFade,
        startPreload,
    ])

    // Tear everything down on unmount.
    useEffect(() => () => cancel(), [cancel])

    return { isTransitioning, handleTrackEnded }
}
