import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { Track, TrackTrims } from "../types"
import { ensureTrackAnalysis, getTrackTrims } from "../automix/silenceAnalysis"
import { ensureProTrackAnalysis, getTrackAnalysis } from "../automix/trackAnalysis"
import {
    PRO_CONFIDENCE_MIN,
    planTransition,
    type TransitionPlan,
} from "../automix/transitionPlanner"
import { trackKey } from "../utils/trackKey"

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

type Phase = "idle" | "preloading" | "fading" | "handoff"

/**
 * Page-wide latch: once a browser proves it ignores programmatic element
 * volume (iOS Safari), crossfading is impossible. Automix then leaves
 * playback entirely to the normal end-of-track behavior.
 */
let fadeUnsupported = false

export interface AutomixPluginConfig {
    name?: string
    /** Master switch. When false the plugin does nothing at all. */
    enabled?: boolean
    /**
     * Automix Pro: beat/BPM/energy analysis drives fade timing and duration.
     * Falls back to Lite behavior per track pair whenever the analysis is
     * unavailable or below the confidence threshold. Default false.
     */
    pro?: boolean
    /** Minimum normalized rhythm confidence (0..1) for Pro transitions. */
    proConfidenceMin?: number
    /** Optional bridge for React UIs that want to expose transition state. */
    onTransitionChange?: (isTransitioning: boolean) => void
}

/**
 * Automix Lite as a lifecycle plugin.
 *
 * The implementation intentionally mirrors the legacy `useAutomix` hook: the
 * main engine audio element remains deck A/source-of-truth, while this plugin
 * owns one detached deck B only around a transition.
 */
export class AutomixPlugin implements AudioPlayerPlugin {
    readonly name: string

    private context: PluginPlayerContext | null = null
    private enabled: boolean
    private readonly onTransitionChange?: (isTransitioning: boolean) => void
    private phase: Phase = "idle"
    private deck: HTMLAudioElement | null = null
    private deckAbort: AbortController | null = null
    private preloadedKey: string | null = null
    private fadeInterval: ReturnType<typeof setInterval> | null = null
    private fadeT0 = 0
    private fadeAnchor = 0
    private pendingHandoff: string | null = null
    private handoffAbort: AbortController | null = null
    private handoffTimer: ReturnType<typeof setTimeout> | null = null
    private failedPair: string | null = null
    private prevSourceKey: string | null = null
    private transitioning = false
    private pro: boolean
    private readonly proConfidenceMin: number
    private plan: TransitionPlan | null = null
    private activeFadeMs = AUTOMIX_FADE_MS

    constructor(config: AutomixPluginConfig = {}) {
        this.name = config.name ?? "automix"
        this.enabled = config.enabled ?? true
        this.pro = config.pro ?? false
        this.proConfidenceMin = config.proConfidenceMin ?? PRO_CONFIDENCE_MIN
        this.onTransitionChange = config.onTransitionChange
    }

    get isTransitioning() {
        return this.transitioning
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
        this.prevSourceKey = playerInstance.getSourceKey()
        this.analyzeCurrentTrack()
    }

    destroy() {
        this.cancel()
        this.context = null
        this.prevSourceKey = null
    }

    updateConfig(config: Pick<AutomixPluginConfig, "enabled" | "pro">) {
        const nextEnabled = config.enabled ?? this.enabled
        if (this.enabled && !nextEnabled) this.cancel()
        this.enabled = nextEnabled
        this.pro = config.pro ?? this.pro
        this.analyzeCurrentTrack()
    }

    onTrackLoad = (track: Track | null) => {
        const context = this.context
        if (!context) return
        const sourceKey = context.getSourceKey()
        if (this.prevSourceKey === null) this.prevSourceKey = sourceKey

        // Source identity changed: either it is the swap we requested (continue
        // the handoff), or the user/host navigated somewhere else (cancel).
        if (this.prevSourceKey !== sourceKey) {
            this.prevSourceKey = sourceKey
            const expected = this.pendingHandoff
            if (
                expected !== null &&
                this.phase === "handoff" &&
                track &&
                trackKey(track) === expected
            ) {
                this.attachHandoff()
            } else if (this.phase !== "idle") {
                this.cancel()
            }
        }

        if (this.enabled && track) void this.ensureAnalysis(track)
        // Pro analysis needs minutes, not the 15s preload lead: start the next
        // track's analysis as soon as the current one loads.
        if (this.enabled && this.usePro()) {
            const next = context.getNextTrack()
            if (next) void this.ensureAnalysis(next)
        }
        this.supervise()
    }

    onPlay = () => {
        this.supervise()
    }

    onPause = () => {
        this.supervise()
    }

    onSeek = () => {
        if (this.phase === "fading") this.cancel()
        else this.supervise()
    }

    onTimeUpdate = () => {
        this.supervise()
    }

    onTrackEnded = () => this.handleTrackEnded()

    /** Legacy controller bridge used by `useAutomix`. */
    handleTrackEnded(): boolean {
        if (this.phase === "fading") {
            // A ran out mid-fade (trim estimate was short). Let the host run
            // its single normal advance and treat the swap as our handoff.
            this.finalizeFade(false)
            return false
        }
        // During handoff the advance already happened; suppress the host's.
        return this.phase === "handoff"
    }

    private analyzeCurrentTrack() {
        if (!this.enabled || !this.context) return
        const track = this.context.getCurrentTrack()
        if (track) void this.ensureAnalysis(track)
        if (this.usePro()) {
            const next = this.context.getNextTrack()
            if (next) void this.ensureAnalysis(next)
        }
    }

    /** Pro behavior is pointless where fades can't run (volume-locked browsers). */
    private usePro(): boolean {
        return this.pro && !fadeUnsupported
    }

    private ensureAnalysis(track: Track): Promise<unknown> {
        return this.usePro() ? ensureProTrackAnalysis(track) : ensureTrackAnalysis(track)
    }

    /** Trims from the Pro analysis when available, else the Lite silence scan. */
    private effectiveTrims(track: Track | null): TrackTrims | null {
        if (this.usePro()) {
            const analysis = getTrackAnalysis(track)
            if (analysis) {
                return {
                    trimStartMs: analysis.trimStartMs ?? 0,
                    trimEndMs: analysis.trimEndMs ?? 0,
                }
            }
        }
        return getTrackTrims(track)
    }

    /**
     * Where deck B should be parked before the fade, in milliseconds. The
     * beat-aligned entry point applies only while a confident pair plan is
     * active; any fallback parks at the silence trim start exactly like Lite,
     * so low-confidence beat guesses never skip the next track's intro.
     */
    private deckStartMs(next: Track): number {
        if (this.usePro()) {
            if (this.plan) return this.plan.deckStartMsInB
            const analysis = getTrackAnalysis(next)
            if (analysis) return analysis.trimStartMs ?? 0
        }
        return getTrackTrims(next)?.trimStartMs ?? 0
    }

    private setTransitioning(next: boolean) {
        if (this.transitioning === next) return
        this.transitioning = next
        this.onTransitionChange?.(next)
    }

    private stopRamp() {
        if (this.fadeInterval !== null) {
            clearInterval(this.fadeInterval)
            this.fadeInterval = null
        }
    }

    private releaseDeck() {
        this.deckAbort?.abort()
        this.deckAbort = null
        this.preloadedKey = null
        this.plan = null
        this.activeFadeMs = AUTOMIX_FADE_MS
        const deck = this.deck
        this.deck = null
        if (deck) {
            try {
                deck.pause()
                deck.removeAttribute("src")
                deck.load()
            } catch {
                // Best-effort release; the element is unreferenced either way.
            }
        }
    }

    private clearHandoff() {
        this.pendingHandoff = null
        this.handoffAbort?.abort()
        this.handoffAbort = null
        if (this.handoffTimer !== null) {
            clearTimeout(this.handoffTimer)
            this.handoffTimer = null
        }
    }

    /** Abort any in-flight transition and restore normal playback audio. */
    private cancel = () => {
        const wasAudible = this.phase === "fading" || this.phase === "handoff"
        this.stopRamp()
        this.clearHandoff()
        this.releaseDeck()
        this.phase = "idle"
        this.setTransitioning(false)
        if (wasAudible && this.context) {
            const main = this.context.getAudioElement()
            const volume = this.context.getEngine().volume
            if (main) {
                try {
                    main.volume = volume
                } catch {
                    // iOS Safari: element volume is read-only; nothing to undo.
                }
            }
        }
    }

    /**
     * The fade is over (ramp completed, or A reached its natural end first).
     * Mark the upcoming source change as ours; optionally trigger it.
     */
    private finalizeFade(advance: boolean) {
        this.stopRamp()
        this.pendingHandoff = this.preloadedKey
        this.phase = "handoff"
        if (advance) this.context?.requestAdvance?.()
    }

    /** Wire deck B for the resolved next track and park it at its trim start. */
    private startPreload(next: Track) {
        if (typeof Audio === "undefined" || !this.context) return
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
            const startMs = this.deckStartMs(next)
            if (startMs <= 0) return
            if (deck.paused && deck.readyState >= 1) {
                try {
                    deck.currentTime = startMs / 1000
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
                this.failedPair = `${this.context?.getSourceKey() ?? ""}->${key}`
                if (this.phase === "fading" || this.phase === "handoff") {
                    this.cancel()
                } else if (this.phase === "preloading") {
                    this.releaseDeck()
                    this.phase = "idle"
                }
            },
            { signal: ac.signal }
        )
        try {
            deck.load()
        } catch {
            return
        }
        this.deckAbort = ac
        this.deck = deck
        this.preloadedKey = key
        this.phase = "preloading"
        void this.ensureAnalysis(next).then(applyTrimStart)
    }

    /**
     * Equal-power ramp driven by wall-clock setInterval (keeps progressing in
     * throttled background tabs, unlike rAF). Re-reads the user volume every
     * tick so a mid-fade volume change re-targets instead of fighting.
     */
    private runRamp() {
        const tick = () => {
            if (this.phase !== "fading") {
                this.stopRamp()
                return
            }
            const context = this.context
            const main = context?.getAudioElement()
            const deck = this.deck
            if (!context || !main || !deck) {
                this.cancel()
                return
            }
            const t = Math.min(
                1,
                (performance.now() - this.fadeT0) / this.activeFadeMs
            )
            const vol = context.getEngine().volume
            const mainTarget = Math.cos((t * Math.PI) / 2) * vol
            const deckTarget = Math.sin((t * Math.PI) / 2) * vol
            try {
                main.volume = mainTarget
                deck.volume = deckTarget
            } catch {
                fadeUnsupported = true
                this.cancel()
                return
            }
            if (vol > 0.1 && Math.abs(main.volume - mainTarget) > 0.05) {
                // The write didn't stick: this browser ignores programmatic
                // volume. Latch and bail out to plain end-of-track behavior.
                fadeUnsupported = true
                this.cancel()
                return
            }
            if (t >= 1) {
                this.stopRamp()
                this.finalizeFade(true)
            }
        }
        this.stopRamp()
        this.fadeInterval = setInterval(tick, 33)
    }

    private startFade() {
        const context = this.context
        const main = context?.getAudioElement()
        const deck = this.deck
        if (!context || !main || !deck) return
        if (fadeUnsupported || context.getEngine().volumeUnsupported) return
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
            this.failedPair = `${context.getSourceKey()}->${this.preloadedKey}`
            this.releaseDeck()
            this.phase = "idle"
            return
        }
        this.phase = "fading"
        this.setTransitioning(true)
        // Lock the fade length for the whole ramp, even if analyses settle
        // mid-fade and the plan would now differ.
        this.activeFadeMs = this.plan?.fadeMs ?? AUTOMIX_FADE_MS
        this.fadeT0 = performance.now()
        this.fadeAnchor = context.getEngine().currentTime
        playPromise
            .then(() => {
                if (this.phase === "fading") this.runRamp()
            })
            .catch(() => {
                // Autoplay policy (or anything else) rejected the second deck:
                // give up on this transition and let the track end normally.
                if (this.phase === "fading") {
                    this.failedPair = `${this.context?.getSourceKey() ?? ""}->${this.preloadedKey}`
                    this.cancel()
                }
            })
    }

    /**
     * After requestAdvance, the host swaps sources and the engine reloads the
     * main element with B's URL. Sync it to deck B's position and flip the
     * audible output back to the main element on its first 'playing'.
     */
    private attachHandoff() {
        this.pendingHandoff = null
        const main = this.context?.getAudioElement()
        const deck = this.deck
        if (!main || !deck) {
            this.cancel()
            return
        }
        const ac = new AbortController()
        this.handoffAbort = ac
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
                    if (Math.abs(deck.currentTime - main.currentTime) > MAX_FLIP_DRIFT_S) {
                        syncTime()
                    }
                    main.volume = this.context?.getEngine().volume ?? main.volume
                } catch {
                    // Volume restore is best-effort on volume-locked browsers.
                }
                this.clearHandoff()
                this.releaseDeck()
                this.phase = "idle"
                this.setTransitioning(false)
            },
            { signal: ac.signal, once: true }
        )
        main.addEventListener("error", this.cancel, { signal: ac.signal, once: true })
        // If playback never starts (autoplay re-blocked, network), stop the
        // deck and restore volume so the existing error/blocked UI takes over.
        this.handoffTimer = setTimeout(this.cancel, HANDOFF_TIMEOUT_MS)
    }

    private supervise() {
        if (!this.enabled || !this.context) return
        const context = this.context
        const engine = context.getEngine()
        const phase = this.phase
        const currentTrack = context.getCurrentTrack()
        const nextTrack = context.getNextTrack()
        const sourceKey = context.getSourceKey()

        if (phase === "fading") {
            if (!engine.isPlaying || engine.isSeeking || engine.hasError) {
                this.cancel()
                return
            }
            if (engine.currentTime < this.fadeAnchor - SEEK_BACK_TOLERANCE_S) {
                this.cancel()
                return
            }
            if (!nextTrack || trackKey(nextTrack) !== this.preloadedKey) {
                this.cancel()
            }
            return
        }
        if (phase === "handoff") return

        if (!currentTrack || !nextTrack) {
            if (phase === "preloading") {
                this.releaseDeck()
                this.phase = "idle"
            }
            return
        }
        if (!engine.isPlaying || engine.isSeeking || engine.hasError) return
        if (engine.duration < MIN_TRACK_S) return
        // No media element (e.g. Web Audio backend): two-deck crossfades can't
        // run, so don't preload deck B — let tracks end and advance normally.
        if (!context.getAudioElement()) return

        const nextKey = trackKey(nextTrack)
        if (this.failedPair === `${sourceKey}->${nextKey}`) return

        const trims = this.effectiveTrims(currentTrack)
        const effectiveEnd = engine.duration - (trims ? trims.trimEndMs / 1000 : 0)

        // Pro: re-plan from whatever analyses have settled by now. The plan
        // collapses to Lite values (usedPro: false) until both sides carry
        // confident rhythm data; the fade length is locked at fade start.
        let plan: TransitionPlan | null = null
        if (this.usePro()) {
            // Dedup'd to a map lookup once analysis is underway. Kept here
            // (not just onTrackLoad) because this is the only path that sees
            // a next track changed mid-playback — shuffle toggles or queue
            // edits — early enough for the multi-second Pro analysis.
            void this.ensureAnalysis(nextTrack)
            const outgoing = getTrackAnalysis(currentTrack)
            const incoming = getTrackAnalysis(nextTrack)
            if (outgoing && incoming) {
                const candidate = planTransition(
                    outgoing,
                    incoming,
                    engine.duration * 1000,
                    AUTOMIX_FADE_MS,
                    this.proConfidenceMin
                )
                if (candidate.usedPro) plan = candidate
            }
        }
        this.plan = plan

        const fadeMs = plan?.fadeMs ?? AUTOMIX_FADE_MS
        const fadeStartAt = Math.max(
            plan ? plan.fadeStartMsInA / 1000 : effectiveEnd - fadeMs / 1000,
            engine.duration * 0.5
        )

        if (phase === "idle") {
            // Long blends need a longer runway than the default lead.
            const leadS = Math.max(PRELOAD_LEAD_S, fadeMs / 1000 + 5)
            if (engine.currentTime >= effectiveEnd - leadS) {
                this.startPreload(nextTrack)
            }
            return
        }

        // preloading
        if (this.preloadedKey !== nextKey) {
            // Shuffle/repeat/queue changes resolved a different next track.
            this.releaseDeck()
            this.phase = "idle"
            return
        }
        if (engine.currentTime >= fadeStartAt) this.startFade()
    }
}

export function createAutomixPlugin(config?: AutomixPluginConfig) {
    return new AutomixPlugin(config)
}

/**
 * Automix Pro: an `AutomixPlugin` with metadata-driven transitions enabled.
 * BPM, beats, and energy steer fade timing and length; pairs without
 * trustworthy analysis fall back to Lite behavior automatically.
 */
export function createAutomixProPlugin(config?: Omit<AutomixPluginConfig, "pro">) {
    return new AutomixPlugin({ ...config, pro: true })
}
