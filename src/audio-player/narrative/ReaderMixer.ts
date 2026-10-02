import type { FallbackSourceEvent, Track, TrackSource } from "../types"
import { trackKey } from "../utils/trackKey"
import { OneShotEngine } from "./OneShotEngine"
import type { OneShotPlaybackErrorEvent } from "./OneShotEngine"
import { SCENE_FADE_MS, SceneMixEngine } from "./SceneMixEngine"
import type { SceneMixAnalysisPolicy, SceneMixStatusSnapshot } from "./SceneMixEngine"
import {
    LayerGainGraph,
    applyAudioSessionType,
    getAudioContextCtor,
    probeElementVolumeWrites,
} from "./layerGainGraph"

/* ------------------------------------------------------------------ */
/* Layers and preferences                                              */
/* ------------------------------------------------------------------ */

/**
 * The reader's three audio layers: the music score (`soundscapes`), the
 * reader-chosen ambient bed (`atmosphere`) and short one-shot effects the
 * story places on words (`cues`).
 */
export type ReaderMixerLayer = "soundscapes" | "atmosphere" | "cues"

/** The layers in display order. */
export const READER_MIXER_LAYERS: readonly ReaderMixerLayer[] = Object.freeze([
    "soundscapes",
    "atmosphere",
    "cues",
])

/** One layer's switch and level, as the reader set them. */
export interface ReaderMixerLayerPreference {
    readonly enabled: boolean
    /** 0..1. Kept when the layer or the master switch is off. */
    readonly level: number
}

/**
 * Everything the reader chose, as one plain serializable object. Hosts save
 * it per user (not per story) wherever they like and pass it back as
 * `initialPreferences`.
 */
export interface ReaderMixerPreferences {
    readonly version: 1
    readonly masterEnabled: boolean
    readonly layers: Readonly<Record<ReaderMixerLayer, ReaderMixerLayerPreference>>
    /** Id of the chosen atmosphere, or `null` for Off. */
    readonly atmosphereId: string | null
}

/** Any subset of the preferences; missing or invalid fields keep their defaults. */
export interface ReaderMixerPreferencesInput {
    version?: number
    masterEnabled?: boolean
    layers?: Partial<Record<ReaderMixerLayer, Partial<ReaderMixerLayerPreference>>>
    atmosphereId?: string | null
}

export const DEFAULT_READER_MIXER_PREFERENCES: ReaderMixerPreferences = Object.freeze({
    version: 1,
    masterEnabled: true,
    layers: Object.freeze({
        soundscapes: Object.freeze({ enabled: true, level: 0.6 }),
        atmosphere: Object.freeze({ enabled: true, level: 0.4 }),
        cues: Object.freeze({ enabled: true, level: 0.8 }),
    }),
    atmosphereId: null,
})

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Turn anything (a saved JSON blob, a partial object, garbage) into complete,
 * frozen preferences. Missing or invalid fields fall back to `base`.
 */
export function normalizeReaderMixerPreferences(
    input: unknown,
    base: ReaderMixerPreferences = DEFAULT_READER_MIXER_PREFERENCES
): ReaderMixerPreferences {
    const source = isRecord(input) ? input : {}
    const layersInput = isRecord(source.layers) ? source.layers : {}
    const layers = {} as Record<ReaderMixerLayer, ReaderMixerLayerPreference>
    for (const layer of READER_MIXER_LAYERS) {
        const raw = isRecord(layersInput[layer]) ? layersInput[layer] : {}
        const fallback = base.layers[layer]
        layers[layer] = Object.freeze({
            enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
            level:
                typeof raw.level === "number" && Number.isFinite(raw.level)
                    ? clamp01(raw.level)
                    : fallback.level,
        })
    }
    let atmosphereId = base.atmosphereId
    if (source.atmosphereId === null) atmosphereId = null
    else if (typeof source.atmosphereId === "string" && source.atmosphereId.trim()) {
        atmosphereId = source.atmosphereId.trim()
    }
    return Object.freeze({
        version: 1,
        masterEnabled:
            typeof source.masterEnabled === "boolean" ? source.masterEnabled : base.masterEnabled,
        layers: Object.freeze(layers),
        atmosphereId,
    })
}

function samePreferences(a: ReaderMixerPreferences, b: ReaderMixerPreferences): boolean {
    if (a.masterEnabled !== b.masterEnabled || a.atmosphereId !== b.atmosphereId) return false
    return READER_MIXER_LAYERS.every(
        (layer) =>
            a.layers[layer].enabled === b.layers[layer].enabled &&
            a.layers[layer].level === b.layers[layer].level
    )
}

/**
 * The gain a layer actually plays at:
 * master on/off × layer on/off × layer level × per-call volume.
 */
export function computeReaderMixerGain(
    preferences: ReaderMixerPreferences,
    layer: ReaderMixerLayer,
    volume = 1
): number {
    if (!preferences.masterEnabled) return 0
    const layerPreference = preferences.layers[layer]
    if (!layerPreference.enabled) return 0
    return clamp01(layerPreference.level) * clamp01(volume)
}

/* ------------------------------------------------------------------ */
/* Atmosphere catalog                                                  */
/* ------------------------------------------------------------------ */

/**
 * One atmosphere the reader can pick. The host owns the catalog; the mixer
 * and the mixer view only display and play what they are given.
 */
export interface ReaderAtmosphereOption {
    /** Stable id; this is what the preferences store. */
    id: string
    label: string
    /** Optional heading the picker groups by, such as "Weather" or "Places". */
    group?: string
    /** The looping bed. Give either `track` or `sources`. */
    track?: Track
    sources?: readonly TrackSource[]
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/**
 * - `idle`: nothing requested on this layer.
 * - `loading`: a track is loading.
 * - `playing`: audible (or silent only because its switch, level or the master is off).
 * - `blocked`: the browser wants a user gesture; the next tap or key press retries.
 * - `failed`: the newest track could not load or play.
 * - `paused`: paused while the page is hidden.
 */
export type ReaderMixerLayerStatus =
    "idle" | "loading" | "playing" | "blocked" | "failed" | "paused"

export interface ReaderMixerLayerState {
    readonly status: ReaderMixerLayerStatus
    /** Loops: key of the track that owns the audible output. Cues: the last cue URL. */
    readonly current: string | null
    /** Loops: the newest requested track key, including one still loading. */
    readonly requested: string | null
    readonly failure: string | null
    /** The gain this layer plays at right now (see {@link computeReaderMixerGain}). */
    readonly effectiveLevel: number
}

/**
 * How the volume sliders behave on this browser:
 * - `level`: real loudness control.
 * - `on-off`: the browser ignores element volume (iOS Safari without Web
 *   Audio routing), so a slider above zero plays at the device volume and
 *   zero silences the layer.
 */
export type ReaderMixerVolumeControl = "level" | "on-off"

/** `element`: plain media elements. `web-audio`: each layer through its own GainNode. */
export type ReaderMixerRouting = "element" | "web-audio"

export interface ReaderMixerState {
    readonly preferences: ReaderMixerPreferences
    readonly layers: Readonly<Record<ReaderMixerLayer, ReaderMixerLayerState>>
    /** The atmosphere catalog the mixer resolves ids against. */
    readonly atmosphereOptions: readonly ReaderAtmosphereOption[]
    /** Whether the atmosphere layer is meant to be sounding (started and not stopped). */
    readonly atmosphereActive: boolean
    /** Cues playing right now. */
    readonly activeCues: number
    readonly routing: ReaderMixerRouting
    readonly volumeControl: ReaderMixerVolumeControl
    /** True while the page is hidden and the loops are paused for it. */
    readonly pageHidden: boolean
    /** True when audio is waiting for a user gesture to start. */
    readonly needsGesture: boolean
    /**
     * How far Soundscapes and Atmosphere are ducked right now, 0..1 (see
     * {@link ReaderMixer.setDuck}). Already included in `effectiveLevel`.
     */
    readonly duck: number
}

export type ReaderMixerStateListener = (state: ReaderMixerState) => void
export type ReaderMixerPreferencesListener = (preferences: ReaderMixerPreferences) => void

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export interface ReaderMixerOptions {
    /** Saved preferences to start from. Partial or invalid input is filled with defaults. */
    initialPreferences?: ReaderMixerPreferencesInput | ReaderMixerPreferences | null
    /** Called after every preference change; the host decides where to save. */
    onPreferencesChange?: ReaderMixerPreferencesListener
    /** The host's atmosphere catalog, used to resolve saved ids. */
    atmospheres?: readonly ReaderAtmosphereOption[]
    /**
     * How audio reaches the speakers. Defaults to `"auto"`.
     *
     * - `"auto"`: Web Audio gain only where element volume is ignored (iOS
     *   Safari), so every slider sets real loudness; plain media elements
     *   everywhere else.
     * - `"element"`: plain media elements everywhere. Works with any file
     *   host; where element volume is ignored, sliders act as on/off.
     * - `"web-audio"`: Web Audio gain everywhere.
     *
     * The Web Audio route loads audio with `crossOrigin="anonymous"`, so the
     * file host must send `Access-Control-Allow-Origin` (the SEIHouse audio
     * hosts do); without it files fail to load. Pass `"element"` for a host
     * without CORS headers.
     */
    routing?: "element" | "auto" | "web-audio"
    /** Soundscape crossfade length. Defaults to {@link SCENE_FADE_MS}. */
    fadeMs?: number
    /** Atmosphere fade length. Defaults to {@link SCENE_FADE_MS}. */
    atmosphereFadeMs?: number
    /**
     * Silence-trim analysis for soundscapes. Defaults to `"off"`: analysis
     * downloads and decodes each score a second time (and needs CORS), which
     * is a lot of data for long scores. Pass `"automatic"` to trim leading
     * silence, or `trimStartMs` per track. The atmosphere never analyses.
     */
    analysisPolicy?: SceneMixAnalysisPolicy
    /** Maximum overlapping cues. Defaults to 6. */
    maxConcurrentCues?: number
    /**
     * Pause both loops while the page is hidden and resume when it returns.
     * Defaults to true. Cues already playing finish; new cues are not hidden-aware.
     */
    pauseWhenHidden?: boolean
    /**
     * Safari Audio Session type applied while Web Audio routing is active.
     * Defaults to `"playback"` so the iPhone silent switch does not mute the
     * mixer. Pass `null` to leave the page's session untouched.
     */
    audioSessionType?: string | null
    /** `crossOrigin` for element routing only. Leave unset unless the host needs it. */
    crossOrigin?: "anonymous" | "use-credentials"
    /** Fired when a soundscape or atmosphere source falls back to its next candidate. */
    onFallbackSource?: (event: FallbackSourceEvent & { layer: ReaderMixerLayer }) => void
}

export interface PlaySoundscapeOptions {
    /** Crossfade length for this switch only. */
    fadeMs?: number
    /** Precomputed start trim in ms; skips silence analysis for this track. */
    trimStartMs?: number
}

export interface PlayCueOptions {
    /** Per-cue volume, multiplied by the Sound Cues level. Defaults to 1. */
    volume?: number
    /** Start position in seconds. */
    startTime?: number
}

export interface ReaderMixerFadeOptions {
    fadeMs?: number
}

export interface ReaderMixerDuckOptions {
    /** Ramp length for this change. Defaults to 350 ms. */
    fadeMs?: number
}

/** Layers a duck lowers. Cues are short moments and are never ducked. */
const DUCKED_LAYERS: ReadonlySet<ReaderMixerLayer> = new Set(["soundscapes", "atmosphere"])
const DUCK_FADE_MS = 350
const DUCK_TICK_MS = 33

const UNLOCK_GESTURES = ["pointerdown", "keydown", "touchend"] as const

type LoopLayer = "soundscapes" | "atmosphere"
type CueStatus = "idle" | "blocked" | "failed"

const LOOP_STATUS: Record<SceneMixStatusSnapshot["state"], ReaderMixerLayerStatus> = {
    idle: "idle",
    loading: "loading",
    "autoplay-blocked": "blocked",
    playing: "playing",
    stopped: "idle",
    failed: "failed",
}

/* ------------------------------------------------------------------ */
/* Mixer                                                               */
/* ------------------------------------------------------------------ */

/**
 * Three-layer reader audio: Soundscapes, Atmosphere and Sound Cues, each with
 * its own switch and level under one master switch.
 *
 * Built from the existing engines: two looping {@link SceneMixEngine}s
 * (soundscape crossfades, atmosphere bed) and one {@link OneShotEngine}
 * (overlapping cues that never pause or duck the loops). Headless and
 * framework-free; `ReaderMixerProvider` shares one instance across a React
 * app.
 *
 * ```ts
 * const mixer = createReaderMixer({ initialPreferences: saved, onPreferencesChange: save })
 * mixer.playSoundscape(chapterScore)  // a chapter opens
 * mixer.setAtmosphere(rainOption)     // the reader picks rain
 * mixer.playCue(growlUrl)             // the text reaches a cue
 * ```
 */
export class ReaderMixer {
    private prefs: ReaderMixerPreferences
    private readonly soundscapes: SceneMixEngine
    private readonly atmosphere: SceneMixEngine
    private readonly cues: OneShotEngine
    private readonly graph: LayerGainGraph<ReaderMixerLayer> | null
    private readonly fadeMs: number
    private readonly atmosphereFadeMs: number
    private readonly elementVolumeWorks: boolean
    private readonly onPreferencesChange?: ReaderMixerPreferencesListener
    private atmosphereOptions: readonly ReaderAtmosphereOption[]
    private atmosphereActive = false
    private loopStatus: Record<LoopLayer, SceneMixStatusSnapshot>
    private cueStatus: CueStatus = "idle"
    private cueFailure: string | null = null
    private lastCue: string | null = null
    private activeCues = 0
    private pageHidden = false
    /** Duck applied to the engines right now (ramps toward duckTarget). */
    private duckLevel = 0
    private duckTarget = 0
    private duckTimer: ReturnType<typeof setInterval> | null = null
    private state: ReaderMixerState
    private readonly stateListeners = new Set<ReaderMixerStateListener>()
    private readonly preferenceListeners = new Set<ReaderMixerPreferencesListener>()
    private readonly cleanups: Array<() => void> = []
    private ready = false
    private disposed = false

    constructor(options: ReaderMixerOptions = {}) {
        this.prefs = normalizeReaderMixerPreferences(options.initialPreferences)
        this.onPreferencesChange = options.onPreferencesChange
        this.atmosphereOptions = Object.freeze([...(options.atmospheres ?? [])])
        this.fadeMs = Math.max(0, options.fadeMs ?? SCENE_FADE_MS)
        this.atmosphereFadeMs = Math.max(0, options.atmosphereFadeMs ?? SCENE_FADE_MS)
        this.elementVolumeWorks = probeElementVolumeWrites()

        this.graph = this.createGraph(options.routing ?? "auto")
        const crossOrigin = this.graph ? "anonymous" : options.crossOrigin
        if (this.graph) {
            this.cleanups.push(applyAudioSessionType(options.audioSessionType ?? "playback"))
            this.cleanups.push(this.graph.onStateChange(() => this.refresh()))
        }

        const fallback =
            (layer: ReaderMixerLayer) =>
            (event: FallbackSourceEvent): void => {
                try {
                    options.onFallbackSource?.({ ...event, layer })
                } catch {
                    // Host callbacks cannot break playback.
                }
            }
        this.soundscapes = new SceneMixEngine({
            loop: true,
            fadeMs: this.fadeMs,
            crossOrigin,
            analysisPolicy: options.analysisPolicy ?? "off",
            onFallbackSource: fallback("soundscapes"),
            createGainSink: this.graph?.sinkFactory("soundscapes"),
        })
        this.atmosphere = new SceneMixEngine({
            loop: true,
            fadeMs: this.atmosphereFadeMs,
            crossOrigin,
            analysisPolicy: "off",
            onFallbackSource: fallback("atmosphere"),
            createGainSink: this.graph?.sinkFactory("atmosphere"),
        })
        this.cues = new OneShotEngine({
            crossOrigin,
            maxConcurrent: options.maxConcurrentCues ?? 6,
            createGainSink: this.graph?.sinkFactory("cues"),
            onPlaybackError: (event) => this.handleCueError(event),
            onActiveCountChange: (count) => {
                this.activeCues = count
                this.refresh()
            },
        })

        this.loopStatus = {
            soundscapes: this.soundscapes.getStatusSnapshot(),
            atmosphere: this.atmosphere.getStatusSnapshot(),
        }
        for (const layer of ["soundscapes", "atmosphere"] as const) {
            this.cleanups.push(
                this[layer].subscribeStatus((snapshot) => {
                    this.loopStatus = { ...this.loopStatus, [layer]: snapshot }
                    this.refresh()
                })
            )
        }

        this.applyLevels()
        this.armGestures()
        if (options.pauseWhenHidden ?? true) this.followVisibility()

        this.ready = true
        this.state = this.buildState()
    }

    /* ---------------------------- Soundscapes --------------------------- */

    /**
     * Crossfade the music score to `track` (about 2 s by default). Repeating
     * the track that is already playing or loading does nothing.
     */
    playSoundscape(track: Track, options: PlaySoundscapeOptions = {}): void {
        if (this.disposed) return
        this.soundscapes.crossfadeTo(track, {
            fadeMs: options.fadeMs ?? this.fadeMs,
            ...(options.trimStartMs !== undefined ? { trimStartMs: options.trimStartMs } : {}),
        })
    }

    /** Fade the music out. */
    stopSoundscape(options: ReaderMixerFadeOptions = {}): void {
        if (this.disposed) return
        this.soundscapes.stop(options.fadeMs ?? this.fadeMs)
    }

    /* ----------------------------- Atmosphere --------------------------- */

    /**
     * Choose the reader's atmosphere and play it: an option from the catalog,
     * its id, or a plain track. `null` turns it off and fades it out. The
     * choice is saved in the preferences.
     */
    setAtmosphere(
        atmosphere: ReaderAtmosphereOption | Track | string | null,
        options: ReaderMixerFadeOptions = {}
    ): void {
        if (this.disposed) return
        const fadeMs = options.fadeMs ?? this.atmosphereFadeMs
        if (atmosphere === null) {
            this.atmosphereActive = false
            this.updatePreferences({ ...this.prefs, atmosphereId: null })
            this.atmosphere.stop(fadeMs)
            this.refresh()
            return
        }
        const resolved = this.resolveAtmosphere(atmosphere)
        if (!resolved) return
        this.atmosphereActive = true
        this.updatePreferences({ ...this.prefs, atmosphereId: resolved.id })
        this.atmosphere.crossfadeTo(resolved.track, { fadeMs })
        this.refresh()
    }

    /**
     * Start the saved atmosphere (for example when the reader opens a story).
     * Does nothing when the preference is Off. If the saved id is not in the
     * catalog yet, it starts once {@link setAtmosphereOptions} provides it.
     */
    startAtmosphere(options: ReaderMixerFadeOptions = {}): void {
        if (this.disposed) return
        this.atmosphereActive = true
        const id = this.prefs.atmosphereId
        const resolved = id ? this.resolveAtmosphere(id) : null
        const fadeMs = options.fadeMs ?? this.atmosphereFadeMs
        if (resolved) {
            this.atmosphere.crossfadeTo(resolved.track, { fadeMs })
        } else {
            // Never keep playing a bed the reader did not choose.
            this.atmosphere.stop(fadeMs)
        }
        this.refresh()
    }

    /** Fade the atmosphere out without changing the reader's choice (leaving the reader). */
    stopAtmosphere(options: ReaderMixerFadeOptions = {}): void {
        if (this.disposed) return
        this.atmosphereActive = false
        this.atmosphere.stop(options.fadeMs ?? this.atmosphereFadeMs)
        this.refresh()
    }

    /** Replace the atmosphere catalog. Starts a pending saved choice that it now resolves. */
    setAtmosphereOptions(atmospheres: readonly ReaderAtmosphereOption[]): void {
        if (this.disposed) return
        this.atmosphereOptions = Object.freeze([...atmospheres])
        this.refresh()
        if (this.atmosphereActive && this.loopStatus.atmosphere.requestedTrackKey === null) {
            this.startAtmosphere()
        }
    }

    getAtmosphereOptions(): readonly ReaderAtmosphereOption[] {
        return this.atmosphereOptions
    }

    /* -------------------------------- Cues ------------------------------ */

    /**
     * Play a one-shot over the loops. Cues overlap (up to the concurrency
     * cap) and never pause or duck the other layers. Returns false when the
     * cue was skipped: Sound Cues or the master is off, the cap is reached,
     * or audio is unavailable.
     */
    playCue(url: string, options: PlayCueOptions = {}): boolean {
        if (this.disposed) return false
        if (computeReaderMixerGain(this.prefs, "cues") <= 0) return false
        const element = this.cues.playOneShot(url, {
            volume: options.volume,
            startTime: options.startTime,
        })
        if (!element) return false
        this.lastCue = url.trim()
        if (this.cueStatus === "failed") {
            this.cueStatus = "idle"
            this.cueFailure = null
        }
        this.refresh()
        return true
    }

    /** Fade out both loops without changing any preference. Cues finish on their own. */
    stopAll(options: ReaderMixerFadeOptions = {}): void {
        this.stopSoundscape(options)
        this.stopAtmosphere(options)
    }

    /* ------------------------------- Levels ----------------------------- */

    setLayerLevel(layer: ReaderMixerLayer, level: number): void {
        if (this.disposed || !READER_MIXER_LAYERS.includes(layer)) return
        this.updateLayer(layer, { level: clamp01(level) })
    }

    setLayerEnabled(layer: ReaderMixerLayer, enabled: boolean): void {
        if (this.disposed || !READER_MIXER_LAYERS.includes(layer)) return
        this.updateLayer(layer, { enabled: Boolean(enabled) })
    }

    /** Silence or restore everything without touching the layers' own settings. */
    setMasterEnabled(enabled: boolean): void {
        if (this.disposed) return
        this.updatePreferences({ ...this.prefs, masterEnabled: Boolean(enabled) })
    }

    /* ----------------------------- Preferences -------------------------- */

    /* -------------------------------- Duck ------------------------------ */

    /**
     * Temporarily lower Soundscapes and Atmosphere, for example under
     * narration: each plays at its normal level × (1 − amount). Cues are not
     * ducked, and the reader's preferences never change. `setDuck(0)` restores
     * the full levels. Ramps over `fadeMs` (default 350 ms).
     *
     * Ducking needs real volume control: on the element route where the
     * browser ignores element volume (`volumeControl: "on-off"`), only a full
     * duck (1) has an audible effect.
     */
    setDuck(amount: number, options: ReaderMixerDuckOptions = {}): void {
        if (this.disposed) return
        const target = clamp01(amount)
        if (target === this.duckTarget) return
        this.duckTarget = target
        this.stopDuckRamp()
        const fadeMs = Math.max(0, options.fadeMs ?? DUCK_FADE_MS)
        const from = this.duckLevel
        if (fadeMs === 0 || typeof setInterval === "undefined") {
            this.duckLevel = target
            this.applyLevels()
        } else {
            const startedAt = Date.now()
            this.duckTimer = setInterval(() => {
                const t = Math.max(0, Math.min(1, (Date.now() - startedAt) / fadeMs))
                this.duckLevel = from + (target - from) * t
                this.applyLevels()
                if (t >= 1) this.stopDuckRamp()
            }, DUCK_TICK_MS)
        }
        this.refresh()
    }

    /** The duck the mixer is heading to (see {@link setDuck}). */
    getDuck(): number {
        return this.duckTarget
    }

    getPreferences(): ReaderMixerPreferences {
        return this.prefs
    }

    /**
     * Replace the preferences (for example after loading them from a server).
     * A different atmosphere id switches the bed when the atmosphere is active.
     */
    setPreferences(preferences: ReaderMixerPreferencesInput | ReaderMixerPreferences): void {
        if (this.disposed) return
        const previousId = this.prefs.atmosphereId
        this.updatePreferences(normalizeReaderMixerPreferences(preferences, this.prefs))
        const nextId = this.prefs.atmosphereId
        if (nextId === previousId || !this.atmosphereActive) return
        if (nextId === null) this.atmosphere.stop(this.atmosphereFadeMs)
        else this.startAtmosphere()
    }

    /** Subscribe to preference changes. Returns an unsubscribe function. */
    subscribePreferences(listener: ReaderMixerPreferencesListener): () => void {
        if (this.disposed) return () => {}
        this.preferenceListeners.add(listener)
        return () => {
            this.preferenceListeners.delete(listener)
        }
    }

    /* -------------------------------- State ----------------------------- */

    /** Immutable snapshot; a new object only when something changed. */
    getState(): ReaderMixerState {
        return this.state
    }

    /**
     * Subscribe to state snapshots. The listener is not called immediately
     * (read {@link getState} first), which fits React's `useSyncExternalStore`.
     */
    subscribe(listener: ReaderMixerStateListener): () => void {
        if (this.disposed) return () => {}
        this.stateListeners.add(listener)
        return () => {
            this.stateListeners.delete(listener)
        }
    }

    /* ----------------------------- Lifecycle ---------------------------- */

    /**
     * Unlock audio for all three layers. The mixer already calls this on
     * every tap, click and key press; call it yourself from the handler of
     * the control that turns audio on, so that tap counts too.
     */
    unlock(): void {
        if (this.disposed) return
        this.graph?.resume()
        this.soundscapes.unlock()
        this.atmosphere.unlock()
        this.cues.unlock()
        if (this.cueStatus === "blocked") {
            this.cueStatus = "idle"
            this.cueFailure = null
        }
        this.refresh()
    }

    isDisposed(): boolean {
        return this.disposed
    }

    /** Stop everything and release every element, listener and audio node. */
    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        this.stopDuckRamp()
        for (const cleanup of this.cleanups.splice(0)) {
            try {
                cleanup()
            } catch {
                // Keep releasing the rest.
            }
        }
        this.soundscapes.dispose()
        this.atmosphere.dispose()
        this.cues.dispose()
        this.graph?.close()
        this.stateListeners.clear()
        this.preferenceListeners.clear()
    }

    /* ------------------------------ Internals --------------------------- */

    private createGraph(
        routing: NonNullable<ReaderMixerOptions["routing"]>
    ): LayerGainGraph<ReaderMixerLayer> | null {
        if (routing === "element") return null
        if (routing === "auto" && this.elementVolumeWorks) return null
        const Ctor = getAudioContextCtor()
        if (!Ctor) return null
        try {
            return new LayerGainGraph(Ctor, READER_MIXER_LAYERS)
        } catch {
            return null
        }
    }

    private engineFor(layer: ReaderMixerLayer): SceneMixEngine | OneShotEngine {
        if (layer === "soundscapes") return this.soundscapes
        if (layer === "atmosphere") return this.atmosphere
        return this.cues
    }

    private resolveAtmosphere(
        input: ReaderAtmosphereOption | Track | string
    ): { id: string; track: Track } | null {
        if (typeof input === "string") {
            const option = this.atmosphereOptions.find((candidate) => candidate.id === input)
            return option ? this.resolveOption(option) : null
        }
        if (typeof (input as ReaderAtmosphereOption).label === "string") {
            return this.resolveOption(input as ReaderAtmosphereOption)
        }
        const track = input as Track
        return { id: track.id ?? trackKey(track), track }
    }

    private resolveOption(option: ReaderAtmosphereOption): { id: string; track: Track } | null {
        if (!option.id) return null
        if (option.track) return { id: option.id, track: option.track }
        if (!option.sources?.length) return null
        return {
            id: option.id,
            track: {
                id: `atmosphere:${option.id}`,
                title: option.label,
                artist: option.group ?? "",
                sources: [...option.sources],
            },
        }
    }

    private updateLayer(layer: ReaderMixerLayer, patch: Partial<ReaderMixerLayerPreference>): void {
        this.updatePreferences({
            ...this.prefs,
            layers: { ...this.prefs.layers, [layer]: { ...this.prefs.layers[layer], ...patch } },
        })
    }

    private updatePreferences(next: ReaderMixerPreferences): void {
        const normalized = normalizeReaderMixerPreferences(next, this.prefs)
        if (samePreferences(normalized, this.prefs)) return
        this.prefs = normalized
        this.applyLevels()
        for (const listener of [this.onPreferencesChange, ...this.preferenceListeners]) {
            try {
                listener?.(normalized)
            } catch {
                // Host persistence cannot break playback.
            }
        }
        this.refresh()
    }

    /** Push each layer's effective gain into its engine (or its Web Audio bus). */
    private stopDuckRamp(): void {
        if (this.duckTimer === null) return
        clearInterval(this.duckTimer)
        this.duckTimer = null
    }

    /** A layer's gain including a duck (the ramping one, or the target for state). */
    private layerGain(layer: ReaderMixerLayer, duck = this.duckLevel): number {
        const gain = computeReaderMixerGain(this.prefs, layer)
        return DUCKED_LAYERS.has(layer) ? gain * (1 - duck) : gain
    }

    private applyLevels(): void {
        for (const layer of READER_MIXER_LAYERS) {
            const gain = this.layerGain(layer)
            const engine = this.engineFor(layer)
            if (this.graph) {
                this.graph.setLayerGain(layer, gain)
                engine.setLevel(1)
            } else {
                engine.setLevel(gain)
            }
            // Muting is what silences a layer where element volume is ignored.
            engine.setMuted(gain <= 0)
        }
    }

    private handleCueError(event: OneShotPlaybackErrorEvent): void {
        if (event.reason === "autoplay-blocked") {
            this.cueStatus = "blocked"
            this.cueFailure = null
        } else {
            this.cueStatus = "failed"
            this.cueFailure = `Sound cue failed to load: ${event.url}`
        }
        this.refresh()
    }

    private armGestures(): void {
        if (typeof document === "undefined") return
        const onGesture = () => this.unlock()
        for (const type of UNLOCK_GESTURES) {
            document.addEventListener(type, onGesture, { capture: true, passive: true })
        }
        this.cleanups.push(() => {
            for (const type of UNLOCK_GESTURES) {
                document.removeEventListener(type, onGesture, true)
            }
        })
    }

    private followVisibility(): void {
        if (typeof document === "undefined") return
        const sync = () => {
            const hidden = document.visibilityState === "hidden"
            if (hidden === this.pageHidden) return
            this.pageHidden = hidden
            if (hidden) {
                this.soundscapes.pause()
                this.atmosphere.pause()
            } else {
                this.soundscapes.resume()
                this.atmosphere.resume()
            }
            this.refresh()
        }
        document.addEventListener("visibilitychange", sync)
        this.cleanups.push(() => document.removeEventListener("visibilitychange", sync))
        sync()
    }

    private volumeControl(): ReaderMixerVolumeControl {
        if (this.graph) return "level"
        const locked =
            !this.elementVolumeWorks ||
            this.soundscapes.getVolumeWritesUnsupported() ||
            this.atmosphere.getVolumeWritesUnsupported() ||
            this.cues.getVolumeWritesUnsupported()
        return locked ? "on-off" : "level"
    }

    private loopLayerState(layer: LoopLayer): ReaderMixerLayerState {
        const snapshot = this.loopStatus[layer]
        let status = LOOP_STATUS[snapshot.state]
        if (this.pageHidden && (status === "playing" || status === "loading")) status = "paused"
        return Object.freeze({
            status,
            current: snapshot.audibleTrackKey,
            requested: snapshot.requestedTrackKey,
            failure: snapshot.failure?.message ?? null,
            effectiveLevel: this.layerGain(layer, this.duckTarget),
        })
    }

    private buildState(): ReaderMixerState {
        const cueStatus: ReaderMixerLayerStatus =
            this.cueStatus === "idle" && this.activeCues > 0 ? "playing" : this.cueStatus
        const layers = Object.freeze({
            soundscapes: this.loopLayerState("soundscapes"),
            atmosphere: this.loopLayerState("atmosphere"),
            cues: Object.freeze({
                status: cueStatus,
                current: this.lastCue,
                requested: this.lastCue,
                failure: this.cueFailure,
                effectiveLevel: computeReaderMixerGain(this.prefs, "cues"),
            }),
        })
        const loopsRequested =
            this.loopStatus.soundscapes.requestedTrackKey !== null ||
            this.loopStatus.atmosphere.requestedTrackKey !== null
        const needsGesture =
            READER_MIXER_LAYERS.some((layer) => layers[layer].status === "blocked") ||
            (this.graph?.state === "suspended" && loopsRequested && !this.pageHidden)
        return Object.freeze({
            preferences: this.prefs,
            layers,
            atmosphereOptions: this.atmosphereOptions,
            atmosphereActive: this.atmosphereActive,
            activeCues: this.activeCues,
            routing: this.graph ? "web-audio" : "element",
            volumeControl: this.volumeControl(),
            pageHidden: this.pageHidden,
            needsGesture,
            duck: this.duckTarget,
        })
    }

    private refresh(): void {
        if (!this.ready || this.disposed) return
        const next = this.buildState()
        if (sameState(next, this.state)) return
        this.state = next
        for (const listener of [...this.stateListeners]) {
            try {
                listener(next)
            } catch {
                // State observers cannot break playback.
            }
        }
    }
}

function sameState(a: ReaderMixerState, b: ReaderMixerState): boolean {
    if (a.preferences !== b.preferences || a.atmosphereOptions !== b.atmosphereOptions) return false
    const rest = (state: ReaderMixerState) =>
        JSON.stringify({ ...state, preferences: null, atmosphereOptions: null })
    return rest(a) === rest(b)
}

export function createReaderMixer(options: ReaderMixerOptions = {}): ReaderMixer {
    return new ReaderMixer(options)
}

/* ------------------------------------------------------------------ */
/* Optional localStorage helpers                                       */
/* ------------------------------------------------------------------ */

function defaultStorage(): Storage | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage
    } catch {
        return null
    }
}

/**
 * Read saved preferences from Web Storage under the host's own key. Returns
 * `null` when nothing usable is stored or storage is unavailable.
 */
export function loadReaderMixerPreferences(
    storageKey: string,
    storage: Storage | null = defaultStorage()
): ReaderMixerPreferences | null {
    if (!storage) return null
    try {
        const raw = storage.getItem(storageKey)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        return isRecord(parsed) ? normalizeReaderMixerPreferences(parsed) : null
    } catch {
        return null
    }
}

/** Save preferences to Web Storage under the host's own key. Returns false when it could not. */
export function saveReaderMixerPreferences(
    storageKey: string,
    preferences: ReaderMixerPreferences,
    storage: Storage | null = defaultStorage()
): boolean {
    if (!storage) return false
    try {
        storage.setItem(storageKey, JSON.stringify(preferences))
        return true
    } catch {
        return false
    }
}
