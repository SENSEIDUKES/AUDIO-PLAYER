import type { Track } from "../types"
import { trackKey } from "../utils/trackKey"
import { getPrimaryTrackSource } from "../utils/sources"
import { ensureTrackAnalysis, getTrackTrims } from "../automix/silenceAnalysis"

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

/**
 * A latched "this browser ignores programmatic volume" flag (iOS Safari).
 * Once detected, crossfades degrade to hard swaps instead of silently doing
 * nothing — the scene still changes, it just cuts.
 */
let volumeWritesUnsupported = false

type Deck = {
    el: HTMLAudioElement
    key: string
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
}

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
}

/** User gestures that can unlock media playback after an autoplay rejection. */
const UNLOCK_GESTURES = ["pointerdown", "keydown", "touchend"] as const

export interface SceneCrossfadeOptions {
    /** Crossfade length for this switch only. */
    fadeMs?: number
}

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
    private loop: boolean
    private defaultFadeMs: number
    private crossOrigin?: "anonymous" | "use-credentials"
    private tickTimer: ReturnType<typeof setInterval> | null = null
    private disposed = false
    /** Removes the armed unlock-gesture listeners, when armed. */
    private disarmGestureRetry: (() => void) | null = null

    constructor(options: SceneMixEngineOptions = {}) {
        this.loop = options.loop ?? true
        this.defaultFadeMs = Math.max(0, options.fadeMs ?? SCENE_FADE_MS)
        this.crossOrigin = options.crossOrigin
    }

    /** Key of the track currently owning the mix (fading in or steady). */
    getCurrentTrackKey(): string | null {
        return this.active?.key ?? null
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

    /**
     * Crossfade the scene score to `track`. The incoming deck parks at the
     * track's silence-trim start (when analysis is available) so the fade
     * never runs through dead air. Calling again mid-fade retires every
     * audible deck toward silence and hands the mix to the newest track; a
     * repeat call for the already-active track is a no-op.
     */
    crossfadeTo(track: Track, options: SceneCrossfadeOptions = {}): void {
        if (this.disposed || typeof Audio === "undefined") return
        const src = getPrimaryTrackSource(track)
        if (!src) return
        const key = trackKey(track)
        if (this.active && this.active.key === key && !this.active.retiring) {
            return
        }

        const fadeMs = Math.max(0, options.fadeMs ?? this.defaultFadeMs)
        const el = new Audio()
        el.loop = this.loop
        el.preload = "auto"
        // Only tag the request as CORS when the host asked for it: a forced
        // crossOrigin turns "no ACAO header on the file host" into a hard media
        // error, silencing scores a bare <audio> would play.
        if (this.crossOrigin) el.crossOrigin = this.crossOrigin
        el.muted = this.muted
        // On volume-locked browsers the fade degrades to a hard swap that
        // relies on the element keeping its default full volume — so the
        // fade-in's zero start must not be written once the latch is known.
        if (!volumeWritesUnsupported) {
            try {
                el.volume = 0
            } catch {
                volumeWritesUnsupported = true
            }
        }

        const abort = new AbortController()
        const deck: Deck = {
            el,
            key,
            curveGain: 0,
            rampT0: performance.now(),
            rampFromGain: 0,
            rampToGain: 1,
            rampMs: volumeWritesUnsupported ? 0 : fadeMs,
            retiring: false,
            abort,
        }

        // Park at the silence-trim start once metadata (and, later, analysis)
        // is in. Every failure mode falls back to the natural track start.
        const applyTrimStart = () => {
            const startMs = getTrackTrims(track)?.trimStartMs ?? 0
            if (startMs <= 0) return
            if (el.paused && el.readyState >= 1) {
                try {
                    el.currentTime = startMs / 1000
                } catch {
                    // Natural start is fine.
                }
            }
        }
        el.addEventListener("loadedmetadata", applyTrimStart, {
            signal: abort.signal,
        })
        el.addEventListener(
            "error",
            () => {
                // Bad URL / network: drop the incoming deck, keep what plays.
                this.releaseDeck(deck)
            },
            { signal: abort.signal }
        )
        void ensureTrackAnalysis(track).then(() => {
            if (!abort.signal.aborted && !deck.retiring) applyTrimStart()
        })
        // Src is assigned after the listeners so a cache-instant
        // `loadedmetadata` can't slip past the trim-start hook.
        el.src = src

        // Retire everything currently audible toward silence.
        for (const other of this.decks) this.retire(other, fadeMs)

        this.decks.push(deck)
        this.active = deck

        let playPromise: Promise<void> | undefined
        try {
            el.load()
            playPromise = el.play()
        } catch {
            this.releaseDeck(deck)
            return
        }
        playPromise?.catch((error: unknown) => {
            if (!this.decks.includes(deck)) return
            // Autoplay policy (NotAllowedError): the browser is waiting for a
            // user gesture, not rejecting the media. Keep the deck loaded and
            // parked, and retry the active deck on the first gesture — so the
            // score starts the moment the user touches the page instead of
            // staying silent for the whole session.
            if ((error as { name?: string } | null)?.name === "NotAllowedError") {
                this.armGestureRetry()
                return
            }
            // Any other failure: give up on this switch and let whatever was
            // playing keep playing. Every other deck was just marked retiring,
            // so the newest of them — the score that was audible before this
            // call — is the one to bring back. If a later crossfadeTo already
            // superseded this deck, it owns the mix; only recover a survivor
            // when the rejected deck was still the newest.
            const wasNewest = this.decks[this.decks.length - 1] === deck
            this.releaseDeck(deck)
            if (!wasNewest) return
            const survivor = this.decks[this.decks.length - 1]
            if (survivor) {
                this.unretire(survivor, fadeMs)
                this.active = survivor
            }
        })

        this.applyGains()
        this.startTicking()
    }

    /** Fade the whole scene layer to silence and release every deck. */
    stop(fadeMs: number = this.defaultFadeMs): void {
        for (const deck of this.decks) this.retire(deck, fadeMs)
        this.active = null
        this.startTicking()
    }

    dispose(): void {
        this.disposed = true
        this.stopTicking()
        this.disarmGestureRetry?.()
        for (const deck of [...this.decks]) this.releaseDeck(deck)
        this.active = null
    }

    /**
     * Arm a one-shot retry of the active deck on the next user gesture.
     * Autoplay policies reject `play()` until the user interacts with the
     * page; without this, a scene score started from lifecycle code (scene
     * change, chapter load) would stay silent forever.
     */
    private armGestureRetry(): void {
        if (this.disarmGestureRetry || this.disposed) return
        if (typeof document === "undefined") return
        const retry = () => {
            disarm()
            if (this.disposed) return
            const deck = this.active
            if (!deck || !deck.el.paused) return
            deck.el.play().catch((error: unknown) => {
                // Some browsers need a "louder" gesture (e.g. keydown on a
                // page that only counts pointer input); stay armed for the
                // next one instead of giving up.
                if (
                    (error as { name?: string } | null)?.name ===
                    "NotAllowedError"
                ) {
                    this.armGestureRetry()
                }
            })
        }
        const disarm = () => {
            this.disarmGestureRetry = null
            for (const type of UNLOCK_GESTURES) {
                document.removeEventListener(type, retry, true)
            }
        }
        this.disarmGestureRetry = disarm
        for (const type of UNLOCK_GESTURES) {
            document.addEventListener(type, retry, {
                capture: true,
                passive: true,
            })
        }
    }

    private retire(deck: Deck, fadeMs: number): void {
        if (deck.retiring) return
        deck.retiring = true
        deck.rampT0 = performance.now()
        deck.rampFromGain = deck.curveGain
        deck.rampToGain = 0
        deck.rampMs = volumeWritesUnsupported ? 0 : fadeMs
        if (this.active === deck) this.active = null
    }

    /** Bring a retiring deck back (the switch that displaced it fell through). */
    private unretire(deck: Deck, fadeMs: number): void {
        deck.retiring = false
        deck.rampT0 = performance.now()
        deck.rampFromGain = deck.curveGain
        deck.rampToGain = 1
        deck.rampMs = volumeWritesUnsupported ? 0 : fadeMs
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
            const t = deck.rampMs <= 0 ? 1 : Math.min(1, (now - deck.rampT0) / deck.rampMs)
            if (deck.rampToGain > deck.rampFromGain) {
                const span = deck.rampToGain - deck.rampFromGain
                deck.curveGain = deck.rampFromGain + span * Math.sin((t * Math.PI) / 2)
            } else {
                deck.curveGain = deck.rampFromGain * Math.cos((t * Math.PI) / 2)
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
        if (volumeWritesUnsupported) return
        const target = clamp01(deck.curveGain * this.level)
        try {
            deck.el.volume = target
            if (this.level > 0.1 && Math.abs(deck.el.volume - target) > 0.05) {
                volumeWritesUnsupported = true
            }
        } catch {
            volumeWritesUnsupported = true
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
        try {
            deck.el.pause()
            deck.el.removeAttribute("src")
            deck.el.load()
        } catch {
            // Best-effort release; the element is unreferenced either way.
        }
    }
}

export function createSceneMixEngine(
    options: SceneMixEngineOptions = {}
): SceneMixEngine {
    return new SceneMixEngine(options)
}
