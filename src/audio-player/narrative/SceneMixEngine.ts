import type { FallbackSourceEvent, Track, TrackSource, TrackTrims } from "../types"
import { trackKey } from "../utils/trackKey"
import { getTrackSources } from "../utils/sources"
import { ensureSourceAnalysis } from "../automix/silenceAnalysis"
import { UnlockedAudioPool } from "./mediaRouting"
import type { MediaGainSink, MediaGainSinkFactory } from "./mediaRouting"

/**
 * Default crossfade length for scene switches. Shorter than the music-player
 * `AUTOMIX_FADE_MS`: a narrative cue ("the boss appears") wants the score to
 * turn over in a couple of seconds, not a DJ-length blend.
 */
export const SCENE_FADE_MS = 2000

/** Ramp tick interval — wall-clock so throttled background tabs keep fading. */
const TICK_MS = 33

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
}

type Deck = {
    el: HTMLAudioElement
    /** Web Audio gain for this element, when the host routes it; else null. */
    sink: MediaGainSink | null
    key: string
    request: SceneRequest
    source: TrackSource
    sourceIndex: number
    /** Equal-power curve position, 0..1 — multiplied by the engine level. */
    curveGain: number
    /** Ramp in flight: when the ramp started and where it's going. */
    rampT0: number
    rampFromGain: number
    rampToGain: number
    rampMs: number
    /** Fully faded-out decks are released on the next tick. */
    retiring: boolean
    abort: AbortController
    /** A positive host trim waits for metadata before the first play attempt. */
    waitForMetadataBeforePlay: boolean
    playStarted: boolean
    trimStartMs: number
}

type PendingTransition = {
    request: SceneRequest
    incoming: Deck | null
}

type SceneRequest = {
    key: string
    /** The original call, replayed when a request is deferred by pause(). */
    track: Track
    options: SceneCrossfadeOptions
    sources: readonly TrackSource[]
    fadeMs: number
    analysisPolicy: SceneMixAnalysisPolicy
    /** Null means no host-provided trim; zero is an explicit natural start. */
    trimStartMs: number | null
}

/** Silence-analysis behavior for SceneMix source candidates. */
export type SceneMixAnalysisPolicy = "automatic" | "off"

export interface SceneMixEngineOptions {
    /** Loop every scene track. Defaults to true — scores are beds, not songs. */
    loop?: boolean
    /** Default crossfade length in ms. Defaults to {@link SCENE_FADE_MS}. */
    fadeMs?: number
    /**
     * `crossOrigin` attribute for the deck `Audio` elements. Leave unset (the
     * default) unless the host needs CORS-clean element data (e.g. piping decks
     * through Web Audio). Forcing `"anonymous"` makes the media request require
     * `Access-Control-Allow-Origin` from the file host — scores served from a
     * plain storage bucket/CDN without CORS headers then fail to load at all,
     * while a bare `<audio>` element would have played them fine.
     */
    crossOrigin?: "anonymous" | "use-credentials"
    /**
     * Silence-trim analysis for selected scene sources. Defaults to
     * `"automatic"`; `"off"` performs no analysis fetch or decode.
     */
    analysisPolicy?: SceneMixAnalysisPolicy
    /** Fired once whenever a failed source advances to the next candidate. */
    onFallbackSource?: (event: FallbackSourceEvent) => void
    /**
     * Route each deck's gain somewhere other than `HTMLMediaElement.volume`,
     * typically a Web Audio `GainNode`. Called once per deck element before
     * its `src` is set. Routing a cross-origin element through Web Audio needs
     * CORS (set `crossOrigin` too), or the browser plays silence.
     */
    createGainSink?: MediaGainSinkFactory
    /**
     * Spare elements {@link SceneMixEngine.unlock} prepares for later
     * non-gesture scene switches. Defaults to 2.
     */
    unlockPoolSize?: number
}

/** User gestures that can unlock media playback after an autoplay rejection. */
const UNLOCK_GESTURES = ["pointerdown", "keydown", "touchend"] as const

export interface SceneCrossfadeOptions {
    /** Crossfade length for this switch only. */
    fadeMs?: number
    /**
     * Precomputed start trim in milliseconds. Supplying this (including zero)
     * skips silence analysis for the requested track.
     */
    trimStartMs?: number
}

export type SceneMixTransitionState =
    "idle" | "loading" | "autoplay-blocked" | "playing" | "stopped" | "failed"

export type SceneMixFailureReason = "playback-failed" | "media-error"

export interface SceneMixFailure {
    /** Stable reason suitable for retry and UI decisions. */
    readonly reason: SceneMixFailureReason
    /** Safe diagnostic detail with a stable fallback when none was provided. */
    readonly message: string
}

export interface SceneMixStatusSnapshot {
    readonly state: SceneMixTransitionState
    /** Newest requested track, including a candidate that has not started. */
    readonly requestedTrackKey: string | null
    /** Track that currently owns the audible mix. */
    readonly audibleTrackKey: string | null
    readonly failure: SceneMixFailure | null
}

export type SceneMixStatusListener = (snapshot: SceneMixStatusSnapshot) => void

const INITIAL_STATUS: SceneMixStatusSnapshot = Object.freeze({
    state: "idle",
    requestedTrackKey: null,
    audibleTrackKey: null,
    failure: null,
})

const MEDIA_ERROR_MESSAGES: Readonly<Record<number, string>> = Object.freeze({
    1: "Audio playback aborted. (MediaError code 1)",
    2: "Network error caused audio download to fail. (MediaError code 2)",
    3: "Audio decoding failed. (MediaError code 3)",
    4: "Audio format not supported. (MediaError code 4)",
})

/**
 * Cue-driven two-deck crossfader for scene scores (reader BGM, ambient beds).
 *
 * `AutomixPlugin` blends playlist tracks at their natural *end*; a narrative
 * host instead needs "switch to this track *now*" mid-track, whenever the
 * story's mood changes. This engine reuses the same building blocks — an
 * equal-power cos/sin ramp on a wall-clock interval, deck parking at the
 * silence-trim start via the shared Automix Lite analysis, autoplay-rejection
 * and volume-locked-browser fallbacks — behind one imperative call:
 *
 * ```ts
 * const mix = createSceneMixEngine()
 * mix.setLevel(0.4)
 * mix.crossfadeTo({ id: "BOSS_1", title: "Boss 1", audioFile: url })
 * ```
 *
 * Headless by design: it renders nothing and owns detached `Audio` elements,
 * so a host can keep its existing UI untouched. Level/mute changes re-target
 * live (including mid-fade), matching how the Automix ramp re-reads the user
 * volume every tick.
 */
export class SceneMixEngine {
    private decks: Deck[] = []
    private active: Deck | null = null
    private level = 1
    private muted = false
    /** Latched per engine so independent narrative layers cannot poison each other. */
    private volumeWritesUnsupported = false
    private loop: boolean
    private defaultFadeMs: number
    private crossOrigin?: "anonymous" | "use-credentials"
    private analysisPolicy: SceneMixAnalysisPolicy
    private onFallbackSource?: (event: FallbackSourceEvent) => void
    private tickTimer: ReturnType<typeof setInterval> | null = null
    private disposed = false
    /** Replacement being prepared. It does not own or alter the audible mix yet. */
    private pendingTransition: PendingTransition | null = null
    /** Removes the armed unlock-gesture listeners, when armed. */
    private disarmGestureRetry: (() => void) | null = null
    /** Removes the armed resume() retry after an autoplay rejection, when armed. */
    private disarmResumeRetry: (() => void) | null = null
    /** Every retry waiting for the next user gesture; one gesture runs them all. */
    private readonly gestureActions = new Set<() => void>()
    private removeGestureListeners: (() => void) | null = null
    private statusSnapshot = INITIAL_STATUS
    private statusListeners = new Set<SceneMixStatusListener>()
    private createGainSink?: MediaGainSinkFactory
    private unlockPool: UnlockedAudioPool
    private paused = false
    /** Newest crossfadeTo() received or interrupted while paused. */
    private deferredRequest: { track: Track; options: SceneCrossfadeOptions } | null = null

    constructor(options: SceneMixEngineOptions = {}) {
        this.loop = options.loop ?? true
        this.defaultFadeMs = Math.max(0, options.fadeMs ?? SCENE_FADE_MS)
        this.crossOrigin = options.crossOrigin
        this.analysisPolicy = options.analysisPolicy ?? "automatic"
        this.onFallbackSource = options.onFallbackSource
        this.createGainSink = options.createGainSink
        this.unlockPool = new UnlockedAudioPool(
            Math.max(0, Math.floor(options.unlockPoolSize ?? 2))
        )
    }

    /**
     * Key of the track currently owning the mix (fading in or steady).
     * Loading and autoplay-blocked candidates are intentionally excluded until
     * playback starts; use `getStatusSnapshot()` to also inspect the request.
     */
    getCurrentTrackKey(): string | null {
        return this.active?.key ?? null
    }

    /** Immutable current transition status. */
    getStatusSnapshot(): SceneMixStatusSnapshot {
        return this.statusSnapshot
    }

    /**
     * Subscribe to ordered status snapshots. The current snapshot is replayed
     * once immediately; the returned function removes the listener.
     */
    subscribeStatus(listener: SceneMixStatusListener): () => void {
        if (this.disposed) {
            this.notifyStatusListener(listener, this.statusSnapshot)
            return () => {}
        }

        this.statusListeners.add(listener)
        this.notifyStatusListener(listener, this.statusSnapshot)
        let subscribed = true
        return () => {
            if (!subscribed) return
            subscribed = false
            this.statusListeners.delete(listener)
        }
    }

    /**
     * Set the effective output level (0..1) for the whole scene layer. The
     * host owns any composition (user volume × intensity × layer share) and
     * hands the result here; mid-fade changes re-target on the next tick.
     */
    setLevel(value: number): void {
        this.level = clamp01(value)
        this.applyGains()
    }

    getLevel(): number {
        return this.level
    }

    /** Mute/unmute without losing playback position or fade state. */
    setMuted(muted: boolean): void {
        this.muted = muted
        for (const deck of this.decks) deck.el.muted = muted
        this.applyGains()
    }

    getMuted(): boolean {
        return this.muted
    }

    /** Whether this engine has detected ignored or rejected element-volume writes. */
    getVolumeWritesUnsupported(): boolean {
        return this.volumeWritesUnsupported
    }

    /**
     * Crossfade the scene score to `track`. The incoming deck parks at the
     * selected source's silence-trim start (when enabled and available) so the
     * fade never runs through dead air. Calling again mid-fade retires every
     * audible deck toward silence and hands the mix to the newest track; a
     * repeat call for the already-active track is a no-op. Replacements and
     * their ordered fallback sources are transactional: the current mix is not
     * retired until one candidate's `play()` confirms that it started.
     */
    crossfadeTo(track: Track, options: SceneCrossfadeOptions = {}): void {
        if (this.disposed || typeof Audio === "undefined") return
        const sources = getTrackSources(track)
        if (sources.length === 0) return
        const key = trackKey(track)
        if (this.paused) {
            this.deferWhilePaused(track, options, key)
            return
        }
        if (this.pendingTransition?.request.key === key) return
        if (this.active && this.active.key === key && !this.active.retiring) {
            if (this.pendingTransition) {
                this.rollbackTransition(this.pendingTransition)
            }
            this.publishStatus("playing", key, key)
            return
        }

        if (this.pendingTransition) {
            this.rollbackTransition(this.pendingTransition)
        }

        const fadeMs = Math.max(0, options.fadeMs ?? this.defaultFadeMs)
        const request: SceneRequest = {
            key,
            track,
            options,
            sources,
            fadeMs,
            analysisPolicy: this.analysisPolicy,
            trimStartMs: this.sanitizeProvidedTrimStart(options.trimStartMs),
        }
        const transition: PendingTransition = {
            request,
            incoming: null,
        }

        this.pendingTransition = transition
        this.publishStatus("loading", key, this.active?.key ?? null)
        if (this.pendingTransition !== transition || this.disposed) return
        this.startSourceAttempt(transition, 0)
    }

    /** Install and start one concrete source candidate for a logical request. */
    private startSourceAttempt(transition: PendingTransition, sourceIndex: number): void {
        if (this.disposed || this.pendingTransition !== transition) return
        const source = transition.request.sources[sourceIndex]
        if (!source) return

        const el = this.unlockPool.take()
        el.loop = this.loop
        el.preload = "auto"
        // Only tag the request as CORS when the host asked for it: a forced
        // crossOrigin turns "no ACAO header on the file host" into a hard media
        // error, silencing scores a bare <audio> would play.
        if (this.crossOrigin) el.crossOrigin = this.crossOrigin
        el.muted = this.muted
        const sink = this.makeGainSink(el)
        // On volume-locked browsers the fade degrades to a hard swap that
        // relies on the element keeping its default full volume — so the
        // fade-in's zero start must not be written once the latch is known.
        // A routed deck never touches element volume: its sink fades instead.
        if (sink) {
            this.writeSinkGain(sink, 0)
        } else if (!this.volumeWritesUnsupported) {
            try {
                el.volume = 0
            } catch {
                this.markVolumeWritesUnsupported()
            }
        }

        const abort = new AbortController()
        const deck: Deck = {
            el,
            sink,
            key: transition.request.key,
            request: transition.request,
            source,
            sourceIndex,
            curveGain: 0,
            rampT0: performance.now(),
            rampFromGain: 0,
            rampToGain: 1,
            rampMs: this.rampLength(sink, transition.request.fadeMs),
            retiring: false,
            abort,
            waitForMetadataBeforePlay:
                transition.request.trimStartMs !== null && transition.request.trimStartMs > 0,
            playStarted: false,
            trimStartMs: transition.request.trimStartMs ?? 0,
        }

        transition.incoming = deck
        this.decks.push(deck)

        el.addEventListener(
            "loadedmetadata",
            () => this.handleCandidateMetadata(transition, deck),
            { signal: abort.signal }
        )
        el.addEventListener(
            "error",
            () => {
                this.handleDeckFailure(deck, transition)
            },
            { signal: abort.signal }
        )

        if (
            transition.request.trimStartMs === null &&
            transition.request.analysisPolicy === "automatic"
        ) {
            // Preserve SceneMix's streaming behavior: analysis may improve the
            // start when it settles before playback, but never gates play(). An
            // uncached/slow analysis therefore falls back to the natural start.
            void ensureSourceAnalysis(source.url).then((trims) => {
                this.handleCandidateAnalysis(transition, deck, trims)
            })
        }

        // Src is assigned after the listeners and ownership record so
        // cache-instant metadata/error events cannot slip past either.
        el.src = source.url
        if (!this.isCurrentCandidate(transition, deck)) return
        // Verify the silent preparation write now. If element-volume writes
        // are locked, the engine latches its hard-swap fallback before commit.
        this.applyDeckGain(deck)
        if (deck.waitForMetadataBeforePlay) {
            try {
                el.load()
            } catch (error) {
                this.advanceSourceOrFail(transition, deck, "media-error", error)
                return
            }
            if (!this.isCurrentCandidate(transition, deck)) return
            if (el.readyState >= 1) this.handleCandidateMetadata(transition, deck)
            return
        }
        this.attemptPlayback(transition, deck, true)
    }

    /** Fade the whole scene layer to silence and release every deck. */
    stop(fadeMs: number = this.defaultFadeMs): void {
        this.deferredRequest = null
        if (this.pendingTransition) {
            this.rollbackTransition(this.pendingTransition)
        }
        if (this.paused) {
            // Nothing is audible while paused, so there is no fade to run.
            for (const deck of [...this.decks]) this.releaseDeck(deck)
            this.active = null
            this.publishStatus("stopped", null, null)
            return
        }
        for (const deck of this.decks) this.retire(deck, fadeMs)
        this.active = null
        this.startTicking()
        this.publishStatus("stopped", null, null)
    }

    /**
     * Prepare spare deck elements for later scene switches. Call from inside
     * a user-gesture handler: on browsers that unlock audio per element (iOS
     * Safari), a switch that happens later without a tap — a battle starting
     * mid-chapter — can then start immediately instead of waiting for one.
     */
    unlock(): void {
        if (this.disposed) return
        this.unlockPool.prime()
    }

    /** Whether {@link pause} is in effect. */
    isPaused(): boolean {
        return this.paused
    }

    /**
     * Pause the scene layer in place (for example while the page is hidden).
     * Any fade in flight completes instantly, the audible deck keeps its
     * position, and a switch requested while paused waits for
     * {@link resume}. Status snapshots are unchanged.
     */
    pause(): void {
        if (this.disposed || this.paused) return
        this.paused = true
        this.stopTicking()
        const pending = this.pendingTransition
        if (pending) {
            this.deferredRequest = {
                track: pending.request.track,
                options: pending.request.options,
            }
            this.rollbackTransition(pending)
        }
        this.disarmGestureRetry?.()
        this.disarmResumeRetry?.()
        for (const deck of [...this.decks]) {
            if (deck.retiring) {
                this.releaseDeck(deck)
                continue
            }
            deck.curveGain = deck.rampToGain
            deck.rampFromGain = deck.rampToGain
            deck.rampMs = 0
            this.applyDeckGain(deck)
            try {
                deck.el.pause()
            } catch {
                // Best effort: an element that cannot pause is released later.
            }
        }
    }

    /**
     * Resume after {@link pause}: the audible deck continues where it was and
     * the newest deferred switch, if any, starts. When the browser blocks the
     * resume, the status reports `autoplay-blocked` and the next user gesture
     * retries it.
     */
    resume(): void {
        if (this.disposed || !this.paused) return
        this.paused = false
        const deferred = this.deferredRequest
        this.deferredRequest = null
        const active = this.active
        if (active) this.resumeDeck(active)
        if (deferred) this.crossfadeTo(deferred.track, deferred.options)
    }

    dispose(): void {
        this.disposed = true
        this.deferredRequest = null
        this.unlockPool.clear()
        this.stopTicking()
        this.disarmGestureRetry?.()
        this.disarmResumeRetry?.()
        this.gestureActions.clear()
        this.removeGestureListeners?.()
        this.pendingTransition = null
        for (const deck of [...this.decks]) this.releaseDeck(deck)
        this.active = null
        this.publishStatus("stopped", null, null)
        this.statusListeners.clear()
    }

    /** Record the newest switch requested while paused, or drop a no-op. */
    private deferWhilePaused(track: Track, options: SceneCrossfadeOptions, key: string): void {
        if (this.active && this.active.key === key && !this.active.retiring) {
            this.deferredRequest = null
            return
        }
        this.deferredRequest = { track, options }
        this.publishStatus("loading", key, this.active?.key ?? null)
    }

    private resumeDeck(deck: Deck): void {
        let playPromise: Promise<void>
        try {
            playPromise = deck.el.play()
        } catch {
            // A media error event, if any, drives the normal recovery path.
            return
        }
        Promise.resolve(playPromise).then(
            () => {
                if (this.disposed || this.paused || this.active !== deck) return
                if (this.statusSnapshot.state === "autoplay-blocked" && !this.pendingTransition) {
                    this.publishStatus("playing", deck.key, deck.key)
                }
            },
            (error: unknown) => {
                if (this.disposed || this.paused || this.active !== deck) return
                if (!this.isAutoplayPolicyError(error)) return
                this.publishStatus(
                    "autoplay-blocked",
                    this.pendingTransition?.request.key ?? deck.key,
                    deck.key
                )
                this.armResumeRetry(deck)
            }
        )
    }

    private handleCandidateMetadata(transition: PendingTransition, deck: Deck): void {
        if (!this.isCurrentCandidate(transition, deck)) return
        this.applyCandidateTrim(deck)
        if (deck.waitForMetadataBeforePlay && !deck.playStarted) {
            this.attemptPlayback(transition, deck, false)
        }
    }

    private handleCandidateAnalysis(
        transition: PendingTransition,
        deck: Deck,
        trims: TrackTrims | null
    ): void {
        if (!this.isCurrentCandidate(transition, deck)) return
        deck.trimStartMs = this.sanitizeAnalysisTrimStart(trims?.trimStartMs)
        this.applyCandidateTrim(deck)
    }

    /** Apply a selected candidate's trim only while it is still silent/pending. */
    private applyCandidateTrim(deck: Deck): void {
        if (deck.trimStartMs <= 0 || deck.el.readyState < 1) return
        const startSeconds = deck.trimStartMs / 1000
        const duration = deck.el.duration
        if (Number.isFinite(duration) && duration > 0 && startSeconds >= duration) return
        try {
            deck.el.currentTime = startSeconds
        } catch {
            // Natural start is fine.
        }
    }

    /** Attempt or retry playback without changing ownership of the current mix. */
    private attemptPlayback(transition: PendingTransition, deck: Deck, shouldLoad: boolean): void {
        if (!this.isCurrentCandidate(transition, deck)) return
        if (this.paused) {
            // A source fallback reached while paused waits for resume().
            this.deferredRequest = {
                track: transition.request.track,
                options: transition.request.options,
            }
            this.rollbackTransition(transition)
            return
        }

        let playPromise: Promise<void>
        try {
            if (shouldLoad) {
                deck.el.load()
                if (!this.isCurrentCandidate(transition, deck)) return
            }
            deck.playStarted = true
            playPromise = deck.el.play()
        } catch (error) {
            this.handlePlaybackFailure(transition, deck, error)
            return
        }

        Promise.resolve(playPromise).then(
            () => this.commitTransition(transition, deck),
            (error: unknown) => this.handlePlaybackFailure(transition, deck, error)
        )
    }

    /** Commit exactly once, only while this is still the newest replacement. */
    private commitTransition(transition: PendingTransition, deck: Deck): void {
        if (!this.isCurrentCandidate(transition, deck)) return

        this.pendingTransition = null
        this.disarmGestureRetry?.()
        for (const otherDeck of this.decks) {
            if (otherDeck !== transition.incoming) {
                this.retire(otherDeck, transition.request.fadeMs)
            }
        }

        const incoming = deck
        incoming.retiring = false
        incoming.rampT0 = performance.now()
        incoming.rampFromGain = incoming.curveGain
        incoming.rampToGain = 1
        incoming.rampMs = this.rampLength(incoming.sink, transition.request.fadeMs)
        this.active = incoming
        this.publishStatus("playing", incoming.key, incoming.key)
        this.applyGains()
        this.startTicking()
    }

    private handlePlaybackFailure(transition: PendingTransition, deck: Deck, error: unknown): void {
        if (!this.isCurrentCandidate(transition, deck)) return
        if (this.isAutoplayPolicyError(error)) {
            this.publishStatus("autoplay-blocked", transition.request.key, this.active?.key ?? null)
            if (!this.isCurrentCandidate(transition, deck)) return
            this.armGestureRetry(transition, deck)
            return
        }
        this.advanceSourceOrFail(transition, deck, "playback-failed", error)
    }

    /**
     * Roll back every pre-commit failure path. Since preparation never retires
     * the existing mix, rollback only has to release the failed candidate.
     */
    private rollbackTransition(transition: PendingTransition): void {
        if (this.pendingTransition !== transition) return
        this.pendingTransition = null
        this.disarmGestureRetry?.()
        const incoming = transition.incoming
        transition.incoming = null
        if (incoming) this.releaseDeck(incoming)
    }

    private failTransition(
        transition: PendingTransition,
        reason: SceneMixFailureReason,
        error: unknown
    ): void {
        if (this.pendingTransition !== transition) return
        const requestedTrackKey = transition.request.key
        this.rollbackTransition(transition)
        this.publishStatus(
            "failed",
            requestedTrackKey,
            this.active?.key ?? null,
            this.normalizeFailure(reason, error)
        )
    }

    /** Media errors share rollback with play failures and never revive stale decks. */
    private handleDeckFailure(deck: Deck, transition: PendingTransition): void {
        if (!this.decks.includes(deck)) return
        if (this.isCurrentCandidate(transition, deck)) {
            this.advanceSourceOrFail(transition, deck, "media-error", deck.el.error)
            return
        }

        const mediaError = deck.el.error
        const wasActive = this.active === deck
        if (!wasActive) {
            this.releaseDeck(deck)
            return
        }

        // A post-commit media failure can still recover the newest outgoing
        // deck while it exists. A stale retiring deck can never displace a
        // newer active owner.
        const pendingIncoming = this.pendingTransition?.incoming ?? null
        const recoverableSurvivor = [...this.decks]
            .reverse()
            .find((candidate) => candidate !== pendingIncoming && candidate !== deck)
        if (recoverableSurvivor) {
            this.unretire(recoverableSurvivor, deck.request.fadeMs)
            this.active = recoverableSurvivor
        } else {
            this.active = null
        }

        if (!this.pendingTransition) {
            const fallbackTransition: PendingTransition = {
                request: deck.request,
                incoming: deck,
            }
            this.pendingTransition = fallbackTransition
            this.advanceSourceOrFail(fallbackTransition, deck, "media-error", mediaError)
            return
        }

        this.releaseDeck(deck)

        if (this.pendingTransition) {
            const pendingState =
                this.statusSnapshot.state === "autoplay-blocked" ? "autoplay-blocked" : "loading"
            this.publishStatus(
                pendingState,
                this.pendingTransition.request.key,
                this.active?.key ?? null
            )
        }
    }

    /**
     * Invalidate one failed candidate, then either install the next source or
     * publish the logical request's single terminal failure.
     */
    private advanceSourceOrFail(
        transition: PendingTransition,
        deck: Deck,
        reason: SceneMixFailureReason,
        error: unknown
    ): void {
        if (!this.isCurrentCandidate(transition, deck)) return

        const failedSource = deck.source
        const nextIndex = deck.sourceIndex + 1
        const nextSource = transition.request.sources[nextIndex]
        this.disarmGestureRetry?.()
        transition.incoming = null
        this.releaseDeck(deck)

        if (!nextSource) {
            this.failTransition(transition, reason, error)
            return
        }

        this.publishStatus("loading", transition.request.key, this.active?.key ?? null)
        if (this.pendingTransition !== transition || this.disposed) return

        this.notifyFallbackSource({
            failedSource: failedSource.url,
            nextSource: nextSource.url,
            nextSourceType: nextSource.type,
            sourceIndex: nextIndex,
            sourceCount: transition.request.sources.length,
            error: this.normalizeFallbackError(reason, error),
        })
        if (this.pendingTransition !== transition || this.disposed) return
        this.startSourceAttempt(transition, nextIndex)
    }

    private isCurrentCandidate(transition: PendingTransition, deck: Deck): boolean {
        return (
            !this.disposed &&
            this.pendingTransition === transition &&
            transition.incoming === deck &&
            !deck.abort.signal.aborted &&
            this.decks.includes(deck)
        )
    }

    private sanitizeProvidedTrimStart(value: number | undefined): number | null {
        if (value === undefined) return null
        if (!Number.isFinite(value) || value <= 0) return 0
        return value
    }

    private sanitizeAnalysisTrimStart(value: number | undefined): number {
        if (!Number.isFinite(value) || !value || value <= 0) return 0
        return value
    }

    private isAutoplayPolicyError(error: unknown): boolean {
        try {
            return (error as { name?: unknown } | null)?.name === "NotAllowedError"
        } catch {
            return false
        }
    }

    private normalizeFallbackError(
        reason: SceneMixFailureReason,
        error: unknown
    ): FallbackSourceEvent["error"] {
        try {
            if (reason === "media-error" && error && typeof error === "object") {
                const code = "code" in error ? (error as { code?: unknown }).code : undefined
                if (code === 1) return "aborted"
                if (code === 2) return "network"
                if (code === 3) return "decode"
                if (code === 4) return "src-not-supported"
            }

            if (typeof error === "string" && error.trim()) return error.trim()
            if (error && typeof error === "object" && "name" in error) {
                const name = (error as { name?: unknown }).name
                if (name === "AbortError") return "aborted"
                if (name === "NetworkError") return "network"
                if (name === "EncodingError") return "decode"
                if (name === "NotSupportedError") return "src-not-supported"
                if (typeof name === "string" && name.trim() && name !== "Error") {
                    return name.trim()
                }
            }
        } catch {
            // Host-provided errors can have throwing getters.
        }
        return "unknown"
    }

    private notifyFallbackSource(event: FallbackSourceEvent): void {
        try {
            this.onFallbackSource?.(Object.freeze(event))
        } catch {
            // Host callbacks cannot break source ownership or media lifecycle.
        }
    }

    private normalizeFailure(reason: SceneMixFailureReason, error: unknown): SceneMixFailure {
        const fallback =
            reason === "media-error"
                ? "Scene audio failed to load or decode."
                : "Scene audio playback failed."
        let message = fallback
        try {
            if (typeof error === "string" && error.trim()) {
                message = error.trim()
            } else if (error && typeof error === "object") {
                const candidate =
                    "message" in error ? (error as { message?: unknown }).message : undefined
                if (typeof candidate === "string" && candidate.trim()) {
                    message = candidate.trim()
                } else if ("code" in error) {
                    const code = (error as { code?: unknown }).code
                    if (typeof code === "number" && MEDIA_ERROR_MESSAGES[code]) {
                        message = MEDIA_ERROR_MESSAGES[code]
                    }
                }
            }
        } catch {
            // Host-provided errors can have throwing getters; use the fallback.
        }
        return Object.freeze({ reason, message })
    }

    private publishStatus(
        state: SceneMixTransitionState,
        requestedTrackKey: string | null,
        audibleTrackKey: string | null,
        failure: SceneMixFailure | null = null
    ): void {
        const previous = this.statusSnapshot
        if (
            previous.state === state &&
            previous.requestedTrackKey === requestedTrackKey &&
            previous.audibleTrackKey === audibleTrackKey &&
            previous.failure?.reason === failure?.reason &&
            previous.failure?.message === failure?.message
        ) {
            return
        }

        const snapshot: SceneMixStatusSnapshot = Object.freeze({
            state,
            requestedTrackKey,
            audibleTrackKey,
            failure,
        })
        this.statusSnapshot = snapshot
        for (const listener of [...this.statusListeners]) {
            this.notifyStatusListener(listener, snapshot)
        }
    }

    private notifyStatusListener(
        listener: SceneMixStatusListener,
        snapshot: SceneMixStatusSnapshot
    ): void {
        try {
            listener(snapshot)
        } catch {
            // Status observers cannot break media lifecycle callbacks.
        }
    }

    /**
     * Arm a one-shot retry of the prepared deck on the next user gesture.
     * Autoplay policies reject `play()` until the user interacts with the
     * page; without this, a scene score started from lifecycle code (scene
     * change, chapter load) would stay silent forever.
     */
    private armGestureRetry(transition: PendingTransition, deck: Deck): void {
        if (this.disarmGestureRetry) return
        if (!this.isCurrentCandidate(transition, deck)) return
        const remove = this.armGesture(() => {
            this.disarmGestureRetry = null
            this.attemptPlayback(transition, deck, false)
        })
        this.disarmGestureRetry = () => {
            this.disarmGestureRetry = null
            remove()
        }
    }

    /** Retry a blocked resume() of the audible deck on the next user gesture. */
    private armResumeRetry(deck: Deck): void {
        if (this.disarmResumeRetry) return
        const remove = this.armGesture(() => {
            this.disarmResumeRetry = null
            this.resumeDeck(deck)
        })
        this.disarmResumeRetry = () => {
            this.disarmResumeRetry = null
            remove()
        }
    }

    /**
     * Run `action` once on the next user gesture, alongside every other armed
     * retry, so one tap restarts a blocked resume and a blocked switch
     * together. Returns a function that cancels this action only.
     */
    private armGesture(action: () => void): () => void {
        if (this.disposed || typeof document === "undefined") return () => {}
        this.gestureActions.add(action)
        if (!this.removeGestureListeners) {
            const onGesture = () => {
                const actions = [...this.gestureActions]
                this.gestureActions.clear()
                this.removeGestureListeners?.()
                for (const pending of actions) pending()
            }
            for (const type of UNLOCK_GESTURES) {
                document.addEventListener(type, onGesture, {
                    capture: true,
                    passive: true,
                })
            }
            this.removeGestureListeners = () => {
                this.removeGestureListeners = null
                for (const type of UNLOCK_GESTURES) {
                    document.removeEventListener(type, onGesture, true)
                }
            }
        }
        return () => {
            this.gestureActions.delete(action)
            if (this.gestureActions.size === 0) this.removeGestureListeners?.()
        }
    }

    private retire(deck: Deck, fadeMs: number): void {
        if (deck.retiring) return
        deck.retiring = true
        deck.rampT0 = performance.now()
        deck.rampFromGain = deck.curveGain
        deck.rampToGain = 0
        deck.rampMs = this.rampLength(deck.sink, fadeMs)
        if (this.active === deck) this.active = null
    }

    /** Bring a retiring deck back (the switch that displaced it fell through). */
    private unretire(deck: Deck, fadeMs: number): void {
        deck.retiring = false
        deck.rampT0 = performance.now()
        deck.rampFromGain = deck.curveGain
        deck.rampToGain = 1
        deck.rampMs = this.rampLength(deck.sink, fadeMs)
        this.startTicking()
    }

    /**
     * Advance every in-flight ramp along the equal-power curve and write the
     * composed gain to each element. Mirrors `AutomixPlugin.runRamp`: fade-in
     * follows sin(t·π/2), fade-out follows g₀·cos(t·π/2), and the write is
     * verified so volume-locked browsers latch the hard-swap fallback instead
     * of fading silently into nothing.
     */
    private tick = (): void => {
        const now = performance.now()
        let anyRamping = false
        for (const deck of [...this.decks]) {
            if (this.pendingTransition?.incoming === deck) {
                this.applyDeckGain(deck)
                continue
            }
            const t = deck.rampMs <= 0 ? 1 : Math.min(1, (now - deck.rampT0) / deck.rampMs)
            if (deck.rampToGain > deck.rampFromGain) {
                const span = deck.rampToGain - deck.rampFromGain
                deck.curveGain = deck.rampFromGain + span * Math.sin((t * Math.PI) / 2)
            } else if (deck.rampToGain < deck.rampFromGain) {
                deck.curveGain = deck.rampFromGain * Math.cos((t * Math.PI) / 2)
            } else {
                deck.curveGain = deck.rampToGain
            }
            if (t < 1) anyRamping = true
            else if (deck.retiring) {
                this.releaseDeck(deck)
                continue
            }
            this.applyDeckGain(deck)
        }
        if (!anyRamping) this.stopTicking()
    }

    private applyGains(): void {
        for (const deck of this.decks) this.applyDeckGain(deck)
    }

    private applyDeckGain(deck: Deck): void {
        if (deck.sink) {
            this.writeSinkGain(deck.sink, deck.curveGain * this.level)
            return
        }
        if (this.volumeWritesUnsupported) return
        const target = clamp01(deck.curveGain * this.level)
        try {
            deck.el.volume = target
            if (this.level > 0.1 && Math.abs(deck.el.volume - target) > 0.05) {
                this.markVolumeWritesUnsupported()
            }
        } catch {
            this.markVolumeWritesUnsupported()
        }
    }

    /**
     * Latch the capability for this engine and collapse every in-flight ramp.
     * The next tick releases retiring decks and promotes the active deck at its
     * native element volume, turning a crossfade into a safe hard swap.
     */
    private markVolumeWritesUnsupported(): void {
        if (this.volumeWritesUnsupported) return
        this.volumeWritesUnsupported = true
        for (const deck of this.decks) {
            if (!deck.sink) deck.rampMs = 0
        }
    }

    /** Routed decks always fade; element decks hard-swap once volume is locked. */
    private rampLength(sink: MediaGainSink | null, fadeMs: number): number {
        return !sink && this.volumeWritesUnsupported ? 0 : fadeMs
    }

    private makeGainSink(el: HTMLAudioElement): MediaGainSink | null {
        if (!this.createGainSink) return null
        try {
            return this.createGainSink(el) ?? null
        } catch {
            return null
        }
    }

    private writeSinkGain(sink: MediaGainSink, value: number): void {
        try {
            sink.setGain(clamp01(value))
        } catch {
            // A host sink failure cannot break the fade loop.
        }
    }

    private startTicking(): void {
        if (this.tickTimer !== null || this.disposed) return
        this.tickTimer = setInterval(this.tick, TICK_MS)
    }

    private stopTicking(): void {
        if (this.tickTimer !== null) {
            clearInterval(this.tickTimer)
            this.tickTimer = null
        }
    }

    private releaseDeck(deck: Deck): void {
        deck.abort.abort()
        this.decks = this.decks.filter((d) => d !== deck)
        if (this.active === deck) this.active = null
        if (deck.sink) {
            const sink = deck.sink
            deck.sink = null
            try {
                sink.dispose()
            } catch {
                // Host cleanup failures cannot block deck release.
            }
        }
        try {
            deck.el.pause()
            deck.el.removeAttribute("src")
            deck.el.load()
        } catch {
            // Best-effort release; the element is unreferenced either way.
        }
    }
}

export function createSceneMixEngine(options: SceneMixEngineOptions = {}): SceneMixEngine {
    return new SceneMixEngine(options)
}
