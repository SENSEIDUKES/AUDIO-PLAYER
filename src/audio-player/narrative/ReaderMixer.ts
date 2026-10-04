import type { FallbackSourceEvent, Track, TrackSource } from "../types"
import { trackKey } from "../utils/trackKey"
import { OneShotEngine } from "./OneShotEngine"
import type { OneShotPlaybackErrorEvent } from "./OneShotEngine"
import { SCENE_FADE_MS, SceneMixEngine } from "./SceneMixEngine"
import type { SceneMixAnalysisPolicy, SceneMixStatusSnapshot } from "./SceneMixEngine"
import { ReaderMixerSession } from "./ReaderMixerSession"
import type {
    ReaderMixerSleepEvent,
    ReaderMixerSleepTimerChoice,
    ReaderMixerSleepTimerState,
} from "./ReaderMixerSession"
import { ACTIVATION_EVENTS, isActivationEvent } from "./mediaRouting"
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
 * The reader's four audio layers: the music score (`soundscapes`), the
 * reader-chosen ambient bed (`atmosphere`) and short one-shot effects the
 * story places on words (`cues`), and recorded/generated narration (`voice`).
 */
export type ReaderMixerLayer = "soundscapes" | "atmosphere" | "cues" | "voice"

/** Host-declared use of each layer, independent of the reader's saved switches. */
export type ReaderMixerLayerAvailability = Readonly<Record<ReaderMixerLayer, boolean>>

/** The layers in display order. */
export const READER_MIXER_LAYERS: readonly ReaderMixerLayer[] = Object.freeze([
    "soundscapes",
    "atmosphere",
    "cues",
    "voice",
])

const OWNED_LAYERS = ["soundscapes", "atmosphere", "cues"] as const

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
    readonly version: 2
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

/**
 * What a new reader starts with: everything on, the score at 25%, the
 * atmosphere at 30% on gentle rain, cues at 75% and voice at 100%. `atmosphereId` names a
 * catalog option; a host whose catalog has no `"gentle-rain"` passes its own
 * `defaultPreferences`.
 */
export const DEFAULT_READER_MIXER_PREFERENCES: ReaderMixerPreferences = Object.freeze({
    version: 2,
    masterEnabled: true,
    layers: Object.freeze({
        soundscapes: Object.freeze({ enabled: true, level: 0.25 }),
        atmosphere: Object.freeze({ enabled: true, level: 0.3 }),
        cues: Object.freeze({ enabled: true, level: 0.75 }),
        voice: Object.freeze({ enabled: true, level: 1 }),
    }),
    atmosphereId: "gentle-rain",
})

/**
 * A named mix the reader can pick in one tap. `preferences` may be partial:
 * fields it leaves out (typically the atmosphere) keep the reader's current
 * choice.
 */
export interface ReaderMixerPreset {
    id: string
    label: string
    preferences: ReaderMixerPreferencesInput
}

/** Id of the preset that applies the mixer's default preferences. */
export const READER_MIXER_DEFAULT_PRESET_ID = "default"

const allOn = (soundscapes: number, atmosphere: number, cues: number) => ({
    masterEnabled: true,
    layers: {
        soundscapes: { enabled: true, level: soundscapes },
        atmosphere: { enabled: true, level: atmosphere },
        cues: { enabled: true, level: cues },
    },
})

/**
 * The built-in presets. "Default" restores the mixer's default preferences
 * (including the default atmosphere); the others change only the switches and
 * levels and keep the reader's atmosphere.
 */
export const READER_MIXER_PRESETS: readonly ReaderMixerPreset[] = Object.freeze([
    Object.freeze({
        id: READER_MIXER_DEFAULT_PRESET_ID,
        label: "Default",
        preferences: DEFAULT_READER_MIXER_PREFERENCES,
    }),
    Object.freeze({ id: "cinematic", label: "Cinematic", preferences: allOn(0.6, 0.35, 0.9) }),
    Object.freeze({ id: "calm", label: "Calm", preferences: allOn(0.15, 0.4, 0.4) }),
    Object.freeze({
        id: "focus",
        label: "Focus",
        preferences: {
            masterEnabled: true,
            layers: {
                soundscapes: { enabled: false },
                atmosphere: { enabled: true, level: 0.3 },
                cues: { enabled: false },
            },
        },
    }),
])

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
        version: 2,
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
 * - `paused`: paused by the system or while the page is hidden.
 */
export type ReaderMixerLayerStatus =
    "idle" | "loading" | "playing" | "blocked" | "failed" | "paused" | "resting"

export interface ReaderMixerLayerState {
    readonly status: ReaderMixerLayerStatus
    /** Loops: key of the track that owns the audible output. Cues: the last cue URL. */
    readonly current: string | null
    /** Loops: the newest requested track key, including one still loading. */
    readonly requested: string | null
    readonly failure: string | null
    /** The gain this layer plays at right now (see {@link computeReaderMixerGain}). */
    readonly effectiveLevel: number
    /** Per-layer routing, including an automatic downgrade after a media/CORS failure. */
    readonly routing?: ReaderMixerRouting
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

/** Playback state of caller-owned narration, independent of the mixer's controls. */
export interface ReaderMixerVoiceSnapshot {
    status: ReaderMixerLayerStatus
    current?: string | null
    failure?: string | null
    muted?: boolean
    routing?: ReaderMixerRouting
    volumeControl?: ReaderMixerVolumeControl
}

/** Connect recorded/generated TTS audio. The host retains its transport and source ownership. */
export interface ReaderMixerVoiceOutput {
    /** Return the current transport state and actual routing/volume capabilities. */
    getState(): ReaderMixerVoiceSnapshot
    /** Observe snapshot changes; return an idempotent listener cleanup. */
    subscribe(listener: () => void): () => void
    /** Apply the reader's saved 0–1 volume independently of the enable gate. */
    setLevel(level: number): void
    /** Output gate that preserves the host's user volume and mute setting. */
    setEnabled(enabled: boolean): void
    /** Pause transport without dropping its source or playback position. */
    pause(): void
    /** Resume the retained source; the host reports loading or blocked playback through its snapshot. */
    resume(): void
}

export interface ReaderMixerState {
    readonly preferences: ReaderMixerPreferences
    readonly availability: ReaderMixerLayerAvailability
    readonly layers: Readonly<Record<ReaderMixerLayer, ReaderMixerLayerState>>
    /** The atmosphere catalog the mixer resolves ids against. */
    readonly atmosphereOptions: readonly ReaderAtmosphereOption[]
    /** The presets the reader can pick (see {@link ReaderMixer.applyPreset}). */
    readonly presets: readonly ReaderMixerPreset[]
    /** The preset the current preferences match, or `null` for a custom mix. */
    readonly activePresetId: string | null
    /** Whether the atmosphere layer is meant to be sounding (started and not stopped). */
    readonly atmosphereActive: boolean
    /** A bounded audition outside an open chapter. */
    readonly atmospherePreviewing: boolean
    readonly sleepTimer: ReaderMixerSleepTimerState
    readonly sleepTimerChoices: readonly ReaderMixerSleepTimerChoice[]
    readonly idle: boolean
    readonly soundscapePlays: number
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
    /** Session-only timer choices, including their translated labels. */
    sleepTimerChoices?: readonly ReaderMixerSleepTimerChoice[]
    /** Slow fade before sleep stops both beds. Default 20,000 ms. */
    sleepFadeMs?: number
    /** The host can stop browser Listen when this event fires. Also exposed by subscribeSleep. */
    onSleepTimer?: (event: ReaderMixerSleepEvent) => void
    /** Plays before a score rests. Default 2; null disables music rests. */
    soundscapeMaxPlays?: number | null
    /** Fade at the end of the final score play. Default 8,000 ms. */
    soundscapeRestFadeMs?: number
    /** No-input timeout. Default 600,000 ms; null disables idle pause. */
    idleTimeoutMs?: number | null
    /** Idle fade before pausing in place. Default 8,000 ms. */
    idleFadeMs?: number
    /** Omitted soundtrack layers are available; Voice follows its connection unless overridden. */
    layerAvailability?: Partial<ReaderMixerLayerAvailability>
    /** Total atmosphere audition length outside a chapter. Default 10,000 ms. */
    atmospherePreviewMs?: number
    /** Fade at each end of an atmosphere audition. Default 1,000 ms. */
    atmospherePreviewFadeMs?: number
    /** Saved preferences to start from. Missing or invalid fields use `defaultPreferences`. */
    initialPreferences?: ReaderMixerPreferencesInput | ReaderMixerPreferences | null
    /**
     * What a new reader starts with and what the "Default" preset and
     * `resetPreferences()` restore. Missing fields use
     * {@link DEFAULT_READER_MIXER_PREFERENCES}.
     */
    defaultPreferences?: ReaderMixerPreferencesInput | ReaderMixerPreferences | null
    /**
     * Presets offered to the reader. Defaults to {@link READER_MIXER_PRESETS},
     * with "Default" following `defaultPreferences`.
     */
    presets?: readonly ReaderMixerPreset[]
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
     * - `"element"`: plain media elements everywhere; where element volume
     *   is ignored, sliders act as on/off.
     * - `"web-audio"`: Web Audio gain everywhere.
     *
     * All routes use anonymous CORS by default. `"auto"` retries a routed
     * media/CORS failure once on a fresh non-CORS element for that layer.
     * For non-CORS hosts, pass `crossOrigin: null` to use element routing.
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
    /** Idle cue cache limits. Defaults to 8 URLs, 2 elements each. */
    maxCachedCueUrls?: number
    maxCuePoolSizePerUrl?: number
    /** Short overlap at each bed boundary. Default 250 ms; 0 selects native looping. */
    loopCrossfadeMs?: number
    /** Coalesce persistence callbacks. Default 300 ms; 0 delivers each change immediately. */
    preferencesDebounceMs?: number
    /**
     * Pause both loops and connected narration while hidden and resume when it returns.
     * Defaults to true. Active cues are dropped; new cues are skipped while hidden.
     */
    pauseWhenHidden?: boolean
    /**
     * Safari Audio Session type applied only while Web Audio output is audible.
     * Defaults to `"playback"` so the iPhone silent switch does not mute the
     * mixer. Restores the previous type when idle. Pass `null` to leave the
     * page's session untouched.
     */
    audioSessionType?: string | null
    /** All mixer requests default to anonymous CORS. Use null with element routing for non-CORS hosts. */
    crossOrigin?: "anonymous" | "use-credentials" | null
    /** Per-attempt loop load/start/stall deadline. Default 12,000 ms. */
    loopAttemptTimeoutMs?: number
    /** Same-source loop retries before advancing or failing. Default 2. */
    loopMaxRetries?: number
    /** Initial loop retry backoff (doubles per retry). Default 500 ms. */
    loopRetryDelayMs?: number
    /** A cue that has not started by this deadline is dropped. Default 1,500 ms. */
    cueStartTimeoutMs?: number
    /** Fired when a soundscape or atmosphere source falls back to its next candidate. */
    onFallbackSource?: (event: FallbackSourceEvent & { layer: ReaderMixerLayer }) => void
}

export interface PlaySoundscapeOptions {
    /** Same track in a new scene starts a fresh play count; same scene is a no-op, including a rest. */
    scene?: string
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

/** An independent ducking owner. Releasing it preserves every other owner's duck. */
export interface ReaderMixerDuckLease {
    /** Set this owner's 0–1 duck amount; other owners keep their own amounts. */
    setDuck(amount: number, options?: ReaderMixerDuckOptions): void
    /** Idempotently remove this owner's contribution to the strongest active duck. */
    release(): void
}

/** Layers a duck lowers. Cues are short moments and are never ducked. */
const DUCKED_LAYERS: ReadonlySet<ReaderMixerLayer> = new Set(["soundscapes", "atmosphere"])
const DUCK_FADE_MS = 350
const DUCK_TICK_MS = 33

type LoopLayer = "soundscapes" | "atmosphere"
type CueStatus = "idle" | "blocked" | "failed"

const LOOP_STATUS: Record<SceneMixStatusSnapshot["state"], ReaderMixerLayerStatus> = {
    idle: "idle",
    loading: "loading",
    "autoplay-blocked": "blocked",
    playing: "playing",
    stopped: "idle",
    failed: "failed",
    paused: "paused",
    resting: "resting",
}

/* ------------------------------------------------------------------ */
/* Mixer                                                               */
/* ------------------------------------------------------------------ */

/**
 * Four-layer reader audio: Soundscapes, Atmosphere, Sound Cues and Voice, each with
 * its own switch and level under one master switch.
 *
 * Built from the existing engines: two looping {@link SceneMixEngine}s
 * (soundscape crossfades, atmosphere bed) and one {@link OneShotEngine}
 * (overlapping cues that never pause or duck the loops), with caller-owned TTS
 * connected through `connectVoice`. Headless and
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
    private readonly session: ReaderMixerSession
    private readonly sleepFadeMs: number
    private readonly idleFadeMs: number
    private readonly sleepListeners = new Set<(event: ReaderMixerSleepEvent) => void>()
    private wantedSoundscape: { track: Track; options: PlaySoundscapeOptions } | null = null
    private idleGain = 1
    private idleFadeTimer: ReturnType<typeof setInterval> | null = null
    private voicePausedForIdle = false
    private prefs: ReaderMixerPreferences
    private readonly soundscapes: SceneMixEngine
    private readonly atmosphere: SceneMixEngine
    private readonly cues: OneShotEngine
    private readonly graph: LayerGainGraph<ReaderMixerLayer> | null
    private readonly fadeMs: number
    private readonly atmosphereFadeMs: number
    private readonly elementVolumeWorks: boolean
    private readonly onPreferencesChange?: ReaderMixerPreferencesListener
    private readonly preferencesDebounceMs: number
    private preferencesTimer: ReturnType<typeof setTimeout> | null = null
    private pendingPreferences: ReaderMixerPreferences | null = null
    private atmosphereOptions: readonly ReaderAtmosphereOption[]
    private atmosphereActive = false
    /** Reader lifetime, retained when its selected atmosphere is Off. */
    private atmosphereStarted = false
    private availabilityInput: Partial<ReaderMixerLayerAvailability>
    private atmospherePreviewing = false
    private previewTimer: ReturnType<typeof setTimeout> | null = null
    private readonly previewMs: number
    private readonly previewFadeMs: number
    private loopStatus: Record<LoopLayer, SceneMixStatusSnapshot>
    private cueStatus: CueStatus = "idle"
    private cueFailure: string | null = null
    private lastCue: string | null = null
    private activeCues = 0
    private pageHidden = false
    /** Duck applied to the engines right now (ramps toward duckTarget). */
    private duckLevel = 0
    private duckTarget = 0
    private manualDuck = 0
    private readonly duckOwners = new Map<object, number>()
    private duckTimer: ReturnType<typeof setInterval> | null = null
    private readonly defaults: ReaderMixerPreferences
    private readonly presets: readonly ReaderMixerPreset[]
    private state: ReaderMixerState
    private readonly stateListeners = new Set<ReaderMixerStateListener>()
    private readonly preferenceListeners = new Set<ReaderMixerPreferencesListener>()
    private readonly cleanups: Array<() => void> = []
    private ready = false
    private disposed = false
    private readonly elementFallbacks = new Set<ReaderMixerLayer>()
    private readonly audioSessionType: string | null
    private restoreAudioSession: (() => void) | null = null
    private voiceOutput: ReaderMixerVoiceOutput | null = null
    private disconnectVoice: (() => void) | null = null
    private voiceSnapshot: ReaderMixerVoiceSnapshot = { status: "idle" }
    private voicePausedForVisibility = false

    constructor(options: ReaderMixerOptions = {}) {
        this.sleepFadeMs = Math.max(0, options.sleepFadeMs ?? 20000)
        this.idleFadeMs = Math.max(0, options.idleFadeMs ?? 8000)
        if (options.onSleepTimer) this.sleepListeners.add(options.onSleepTimer)
        this.availabilityInput = { ...options.layerAvailability }
        this.previewMs = Math.max(0, options.atmospherePreviewMs ?? 10000)
        this.previewFadeMs = Math.max(0, options.atmospherePreviewFadeMs ?? 1000)
        this.defaults = normalizeReaderMixerPreferences(options.defaultPreferences)
        this.prefs = normalizeReaderMixerPreferences(options.initialPreferences, this.defaults)
        this.presets = Object.freeze(
            (options.presets ?? READER_MIXER_PRESETS).map((preset) =>
                preset.id === READER_MIXER_DEFAULT_PRESET_ID && !options.presets
                    ? Object.freeze({ ...preset, preferences: this.defaults })
                    : preset
            )
        )
        this.onPreferencesChange = options.onPreferencesChange
        this.preferencesDebounceMs = Math.max(0, options.preferencesDebounceMs ?? 300)
        this.atmosphereOptions = Object.freeze([...(options.atmospheres ?? [])])
        this.fadeMs = Math.max(0, options.fadeMs ?? SCENE_FADE_MS)
        this.atmosphereFadeMs = Math.max(0, options.atmosphereFadeMs ?? SCENE_FADE_MS)
        this.elementVolumeWorks = probeElementVolumeWrites()

        this.graph = this.createGraph(
            options.crossOrigin === null ? "element" : (options.routing ?? "auto")
        )
        const crossOrigin = options.crossOrigin === undefined ? "anonymous" : options.crossOrigin
        this.audioSessionType =
            options.audioSessionType === undefined ? "playback" : options.audioSessionType
        if (this.graph) {
            this.cleanups.push(
                this.graph.onStateChange(() => {
                    if (
                        this.ready &&
                        !this.pageHidden &&
                        !this.session.idle &&
                        this.session.sleep.status !== "fired" &&
                        this.graph?.state === "running"
                    ) {
                        this.cues.notifyOutputReady()
                        for (const layer of ["soundscapes", "atmosphere"] as const) {
                            if (this.layerGain(layer) > 0) this[layer].resume()
                        }
                    }
                    this.refresh()
                })
            )
        }

        const recovery = {
            loopCrossfadeMs: options.loopCrossfadeMs ?? 250,
            attemptTimeoutMs: options.loopAttemptTimeoutMs ?? 12000,
            maxRetries: options.loopMaxRetries ?? 2,
            retryDelayMs: options.loopRetryDelayMs ?? 500,
            allowElementFallback: (options.routing ?? "auto") === "auto" && !!this.graph,
            onPlaybackChange: () => this.refresh(),
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
            ...recovery,
            loop: true,
            maxPlays: options.soundscapeMaxPlays === undefined ? 2 : options.soundscapeMaxPlays,
            restFadeMs: options.soundscapeRestFadeMs ?? 8000,
            fadeMs: this.fadeMs,
            crossOrigin,
            analysisPolicy: options.analysisPolicy ?? "off",
            onFallbackSource: fallback("soundscapes"),
            createGainSink: this.graph?.sinkFactory("soundscapes"),
            onRoutingFallback: () => this.routingFallback("soundscapes"),
        })
        this.atmosphere = new SceneMixEngine({
            ...recovery,
            loop: true,
            fadeMs: this.atmosphereFadeMs,
            crossOrigin,
            analysisPolicy: "off",
            onFallbackSource: fallback("atmosphere"),
            createGainSink: this.graph?.sinkFactory("atmosphere"),
            onRoutingFallback: () => this.routingFallback("atmosphere"),
        })
        this.cues = new OneShotEngine({
            crossOrigin,
            maxConcurrent: options.maxConcurrentCues ?? 6,
            maxCachedUrls: options.maxCachedCueUrls ?? 8,
            maxPoolSizePerUrl: options.maxCuePoolSizePerUrl ?? 2,
            disconnectIdleSinks: true,
            createGainSink: this.graph?.sinkFactory("cues"),
            startTimeoutMs: options.cueStartTimeoutMs ?? 1500,
            outputReady: () => !this.graph || this.graph.state === "running",
            allowElementFallback: recovery.allowElementFallback,
            onRoutingFallback: () => this.routingFallback("cues"),
            onPlaybackChange: () => this.refresh(),
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

        this.session = new ReaderMixerSession({
            choices: options.sleepTimerChoices,
            idleTimeoutMs:
                options.idleTimeoutMs === null
                    ? null
                    : Math.max(1, options.idleTimeoutMs ?? 600000),
            onChange: () => this.refresh(),
            onSleep: (event) => this.fireSleep(event),
            onResume: () => this.resumeAfterSleep(),
            onIdle: (idle) => this.changeIdle(idle),
        })

        this.applyLevels()
        this.armGestures()
        if (options.pauseWhenHidden ?? true) this.followVisibility()
        if (typeof window !== "undefined") {
            const online = () => {
                this.soundscapes.retryFailed()
                if (this.atmosphereActive) this.atmosphere.retryFailed()
            }
            window.addEventListener("online", online)
            this.cleanups.push(() => window.removeEventListener("online", online))
            const pagehide = () => this.flushPreferences()
            window.addEventListener("pagehide", pagehide)
            this.cleanups.push(() => window.removeEventListener("pagehide", pagehide))
        }

        this.ready = true
        this.state = this.buildState()
        this.syncRuntime()
    }

    /* ---------------------------- Soundscapes --------------------------- */

    /**
     * Crossfade the music score to `track` (about 2 s by default). Repeating
     * the track that is already playing or loading does nothing.
     */
    playSoundscape(track: Track, options: PlaySoundscapeOptions = {}): void {
        if (this.disposed) return
        this.wantedSoundscape = { track, options }
        this.session.start()
        if (this.session.sleep.status === "fired") return
        if (!this.pageHidden && !this.session.idle) this.soundscapes.resume()
        this.soundscapes.crossfadeTo(track, {
            scene: options.scene,
            fadeMs: options.fadeMs ?? this.fadeMs,
            ...(options.trimStartMs !== undefined ? { trimStartMs: options.trimStartMs } : {}),
        })
    }

    /** Fade the music out. */
    stopSoundscape(options: ReaderMixerFadeOptions = {}): void {
        if (this.disposed) return
        this.wantedSoundscape = null
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
        this.cancelAtmospherePreview()
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
        this.updatePreferences({ ...this.prefs, atmosphereId: resolved.id })
        if (this.session.sleep.status === "fired") {
            this.refresh()
            return
        }
        if (this.atmosphereStarted) {
            this.atmosphereActive = true
            this.atmosphere.crossfadeTo(resolved.track, { fadeMs })
        } else if (!this.pageHidden) {
            this.atmospherePreviewing = true
            const previewFade = Math.min(options.fadeMs ?? this.previewFadeMs, this.previewMs / 2)
            this.atmosphere.crossfadeTo(resolved.track, { fadeMs: previewFade })
            this.previewTimer = setTimeout(() => {
                this.previewTimer = null
                this.atmospherePreviewing = false
                this.atmosphere.stop(previewFade)
                this.refresh()
            }, this.previewMs - previewFade)
        }
        this.refresh()
    }

    /**
     * Start the saved atmosphere (for example when the reader opens a story).
     * Does nothing when the preference is Off. If the saved id is not in the
     * catalog yet, it starts once {@link setAtmosphereOptions} provides it.
     */
    startAtmosphere(options: ReaderMixerFadeOptions = {}): void {
        if (this.disposed) return
        this.cancelAtmospherePreview()
        this.atmosphereStarted = true
        this.atmosphereActive = true
        this.session.start()
        if (this.session.sleep.status === "fired") {
            this.refresh()
            return
        }
        if (!this.pageHidden && !this.session.idle) this.atmosphere.resume()
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
        this.cancelAtmospherePreview()
        this.atmosphereStarted = false
        this.atmosphereActive = false
        this.atmosphere.stop(options.fadeMs ?? this.atmosphereFadeMs)
        this.refresh()
    }

    /** Replace the catalog and reconcile the open reader's chosen bed with its sources. */
    setAtmosphereOptions(atmospheres: readonly ReaderAtmosphereOption[]): void {
        if (this.disposed) return
        this.atmosphereOptions = Object.freeze([...atmospheres])
        this.refresh()
        if (this.atmosphereStarted && this.prefs.atmosphereId !== null) {
            this.startAtmosphere()
        }
    }

    getAtmosphereOptions(): readonly ReaderAtmosphereOption[] {
        return this.atmosphereOptions
    }

    /** Change host use without changing saved switches, levels, sources or presets. */
    setLayerAvailability(availability: Partial<ReaderMixerLayerAvailability>): void {
        if (this.disposed) return
        this.availabilityInput = { ...this.availabilityInput, ...availability }
        this.refresh()
    }

    private cancelAtmospherePreview(): void {
        if (this.previewTimer !== null) clearTimeout(this.previewTimer)
        this.previewTimer = null
        this.atmospherePreviewing = false
    }

    /* -------------------------------- Cues ------------------------------ */

    /**
     * Play a one-shot over the loops. Cues overlap (up to the concurrency
     * cap) and never pause or duck the other layers. Returns false when the
     * cue was skipped: Sound Cues or the master is off, the cap is reached,
     * or audio is unavailable.
     */
    playCue(url: string, options: PlayCueOptions = {}): boolean {
        if (
            this.disposed ||
            this.pageHidden ||
            this.session.idle ||
            this.session.sleep.status === "fired"
        )
            return false
        if (computeReaderMixerGain(this.prefs, "cues", options.volume ?? 1) <= 0) return false
        const element = this.cues.playOneShot(url, {
            volume: options.volume,
            startTime: options.startTime,
        })
        if (!element) return false
        this.session.start()
        this.lastCue = url.trim()
        if (this.cueStatus === "failed") {
            this.cueStatus = "idle"
            this.cueFailure = null
        }
        this.refresh()
        return true
    }

    /** Fade both loops and pause connected narration. Preferences stay; cues finish on their own. */
    stopAll(options: ReaderMixerFadeOptions = {}): void {
        if (this.disposed) return
        this.session.reset()
        this.cancelIdleFade()
        this.idleGain = 1
        this.voicePausedForIdle = false
        this.stopSoundscape(options)
        this.stopAtmosphere(options)
        this.voicePausedForVisibility = false
        this.voiceOutput?.pause()
        this.applyLevels()
        this.refresh()
    }

    /** Arm a session-only wall-clock timer by its host-defined choice id. A new choice resumes sleep-stopped audio. */
    setSleepTimer(choiceId: string): void {
        this.session.setTimer(choiceId)
    }

    /** Cancel a running timer without changing preferences or playback. */
    cancelSleepTimer(): void {
        this.session.cancelTimer()
    }

    /** Required host signal for End of chapter; scrolling alone never stops or resumes sleep audio. */
    notifyChapterEnd(): void {
        this.session.chapterEnd()
    }

    /** Observe sleep firing so the host can stop its own browser speech. */
    subscribeSleep(listener: (event: ReaderMixerSleepEvent) => void): () => void {
        if (this.disposed) return () => {}
        this.sleepListeners.add(listener)
        return () => {
            this.sleepListeners.delete(listener)
        }
    }

    /** Hold activity while host-owned Listen speaks; release is idempotent. */
    retainActivity(): () => void {
        return this.session.retainActivity()
    }

    /** Explicit reader intent from the note/master, never called by scroll/activity listeners. */
    resumeAudio(): void {
        if (this.disposed) return
        this.session.resume()
        this.setMasterEnabled(true)
        this.unlock()
    }

    /**
     * Connect one caller-owned TTS output, pausing and detaching any previous connection.
     * The returned cleanup releases its mixer gate and subscription; it retains host transport.
     */
    connectVoice(output: ReaderMixerVoiceOutput): () => void {
        if (this.disposed) return () => {}
        if (this.voiceOutput) this.voiceOutput.pause()
        this.disconnectVoice?.()
        this.voiceOutput = output
        const sync = () => {
            if (this.voiceOutput !== output || this.disposed) return
            this.voiceSnapshot = { ...output.getState() }
            this.session.setVoicePlaying(this.voiceSnapshot.status === "playing")
            if (this.voiceSnapshot.status === "playing") this.session.start()
            this.pauseVoiceWhileHidden()
            this.refresh()
        }
        const unsubscribe = output.subscribe(sync)
        let detached = false
        const disconnect = () => {
            if (detached) return
            detached = true
            unsubscribe()
            if (this.voiceOutput !== output) return
            this.voiceOutput = null
            this.disconnectVoice = null
            this.voiceSnapshot = { status: "idle" }
            this.voicePausedForVisibility = false
            this.session.setVoicePlaying(false)
            output.setEnabled(true)
            this.refresh()
        }
        this.disconnectVoice = disconnect
        output.setLevel(this.prefs.layers.voice.level)
        output.setEnabled(this.voiceEnabled())
        sync()
        return disconnect
    }

    /* ------------------------------- Levels ----------------------------- */

    /** Save a layer's clamped 0–1 level and apply it without changing its enable switch. */
    setLayerLevel(layer: ReaderMixerLayer, level: number): void {
        if (this.disposed || !READER_MIXER_LAYERS.includes(layer)) return
        this.updateLayer(layer, { level: clamp01(level) })
    }

    /** Save a layer's enable switch while retaining its level and selected source. */
    setLayerEnabled(layer: ReaderMixerLayer, enabled: boolean): void {
        if (this.disposed || !READER_MIXER_LAYERS.includes(layer)) return
        this.updateLayer(layer, { enabled: Boolean(enabled) })
    }

    /** Silence or restore everything without touching the layers' own settings. */
    setMasterEnabled(enabled: boolean): void {
        if (this.disposed) return
        if (enabled) this.session.resume()
        this.updatePreferences({ ...this.prefs, masterEnabled: Boolean(enabled) })
    }

    /* ----------------------------- Preferences -------------------------- */

    /* -------------------------------- Duck ------------------------------ */

    /**
     * Temporarily lower Soundscapes and Atmosphere, for example under
     * narration: each plays at its normal level × (1 − amount). Cues and Voice
     * are not ducked, and the reader's preferences never change. Independent
     * leases can request a stronger duck. `setDuck(0)` clears this manual duck
     * while preserving their requests. Ramps over `fadeMs` (default 350 ms).
     *
     * Ducking needs real volume control: on the element route where the
     * browser ignores element volume (`volumeControl: "on-off"`), only a full
     * duck (1) has an audible effect.
     */
    setDuck(amount: number, options: ReaderMixerDuckOptions = {}): void {
        if (this.disposed) return
        this.manualDuck = clamp01(amount)
        this.applyDuckTarget(options)
    }

    /** Retain an independent narration duck; overlapping owners use the strongest amount. */
    retainDuck(): ReaderMixerDuckLease {
        const owner = {}
        let released = false
        if (!this.disposed) this.duckOwners.set(owner, 0)
        return {
            setDuck: (amount, options = {}) => {
                if (released || this.disposed) return
                this.duckOwners.set(owner, clamp01(amount))
                this.applyDuckTarget(options)
            },
            release: () => {
                if (released) return
                released = true
                this.duckOwners.delete(owner)
                if (!this.disposed) this.applyDuckTarget({})
            },
        }
    }

    /** Ramp background gains toward the strongest manual or retained-owner duck. */
    private applyDuckTarget(options: ReaderMixerDuckOptions): void {
        const target = Math.max(this.manualDuck, ...this.duckOwners.values())
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
        if (nextId === previousId || !this.atmosphereStarted) return
        if (nextId === null) {
            this.atmosphereActive = false
            this.atmosphere.stop(this.atmosphereFadeMs)
            this.refresh()
        } else this.startAtmosphere()
    }

    /** The presets the reader can pick. */
    getPresets(): readonly ReaderMixerPreset[] {
        return this.presets
    }

    /**
     * Apply a preset (or its id). Fields the preset leaves out keep the
     * reader's current choice. Unknown ids do nothing.
     */
    applyPreset(preset: ReaderMixerPreset | string): void {
        if (this.disposed) return
        const resolved =
            typeof preset === "string" ? this.presets.find((p) => p.id === preset) : preset
        if (!resolved) return
        this.setPreferences(resolved.preferences)
    }

    /** Restore the default preferences (what a new reader starts with). */
    resetPreferences(): void {
        this.setPreferences(this.defaults)
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
     * Unlock audio for every layer. The mixer already calls this on
     * every tap, click and key press; call it yourself from the handler of
     * the control that turns audio on, so that tap counts too.
     */
    unlock(): void {
        if (this.disposed) return
        if (!this.pageHidden && this.graphWanted()) this.graph?.resume(true)
        this.soundscapes.unlock()
        this.atmosphere.unlock()
        this.cues.unlock()
        if (!this.pageHidden && !this.session.idle && this.session.sleep.status !== "fired") {
            if (this.layerGain("soundscapes") > 0) this.soundscapes.resume()
            if (this.layerGain("atmosphere") > 0) this.atmosphere.resume()
            if (this.voiceSnapshot.status === "blocked" && this.layerGain("voice") > 0) {
                this.voiceOutput?.resume()
            }
        }
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
        this.flushPreferences()
        this.disposed = true
        this.stopDuckRamp()
        this.session.dispose()
        this.cancelIdleFade()
        this.cancelAtmospherePreview()
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
        this.voiceOutput?.pause()
        this.disconnectVoice?.()
        this.restoreAudioSession?.()
        this.restoreAudioSession = null
        this.graph?.close()
        this.stateListeners.clear()
        this.preferenceListeners.clear()
        this.duckOwners.clear()
        this.sleepListeners.clear()
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
            return new LayerGainGraph(Ctor, OWNED_LAYERS)
        } catch {
            return null
        }
    }

    private engineFor(layer: (typeof OWNED_LAYERS)[number]): SceneMixEngine | OneShotEngine {
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
        this.pendingPreferences = normalized
        if (this.preferencesTimer !== null) clearTimeout(this.preferencesTimer)
        if (this.preferencesDebounceMs === 0) this.flushPreferences()
        else
            this.preferencesTimer = setTimeout(
                () => this.flushPreferences(),
                this.preferencesDebounceMs
            )
        for (const listener of this.preferenceListeners) {
            try {
                listener?.(normalized)
            } catch {
                // Host persistence cannot break playback.
            }
        }
        this.refresh()
    }

    /** Persist the latest settings immediately (also called on pagehide and dispose). */
    flushPreferences(): void {
        if (this.preferencesTimer !== null) clearTimeout(this.preferencesTimer)
        this.preferencesTimer = null
        const preferences = this.pendingPreferences
        this.pendingPreferences = null
        if (preferences) {
            try {
                this.onPreferencesChange?.(preferences)
            } catch {
                /* Persistence cannot break playback. */
            }
        }
    }

    /** Warm the chapter's bounded cue cache without starting playback or owning the audio session. */
    preloadCues(urls: readonly string[]): void {
        if (!this.disposed) this.cues.preload(urls)
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
        return DUCKED_LAYERS.has(layer) ? gain * (1 - duck) * this.idleGain : gain
    }

    private applyLevels(): void {
        for (const layer of OWNED_LAYERS) {
            const gain = this.layerGain(layer)
            const engine = this.engineFor(layer)
            if (this.graph && !this.elementFallbacks.has(layer)) {
                this.graph.setLayerGain(layer, gain)
                engine.setLevel(1)
            } else {
                this.graph?.setLayerGain(layer, 1)
                engine.setLevel(gain)
            }
            // Muting is what silences a layer where element volume is ignored.
            engine.setMuted(gain <= 0)
        }
        this.voiceOutput?.setLevel(this.prefs.layers.voice.level)
        this.voiceOutput?.setEnabled(this.voiceEnabled())
        this.syncRuntime()
    }

    private routingFallback(layer: ReaderMixerLayer): void {
        this.elementFallbacks.add(layer)
        this.applyLevels()
        this.refresh()
    }

    /** A context is useful only while there is enabled playback demand. */
    private syncRuntime(): void {
        if (!this.ready || this.disposed || !this.graph) return
        if (!this.pageHidden && this.graphWanted()) this.graph.resume()
        else this.graph.suspend()

        const audible =
            !this.pageHidden &&
            this.graph.state === "running" &&
            OWNED_LAYERS.some(
                (layer) =>
                    this.layerGain(layer) > 0 &&
                    (layer === "cues"
                        ? this.cues.hasRoutedDemand(true)
                        : this[layer].hasRoutedDemand())
            )
        if (audible && !this.restoreAudioSession) {
            this.restoreAudioSession = applyAudioSessionType(this.audioSessionType)
        } else if (!audible && this.restoreAudioSession) {
            this.restoreAudioSession()
            this.restoreAudioSession = null
        }
    }

    private graphWanted(): boolean {
        if (this.session?.idle && this.idleGain === 0) return false
        const loopWanted = (["soundscapes", "atmosphere"] as const).some(
            (layer) =>
                this.layerGain(layer) > 0 &&
                ((!this.elementFallbacks.has(layer) &&
                    this.loopStatus[layer].requestedTrackKey !== null &&
                    this.loopStatus[layer].state !== "failed" &&
                    this.loopStatus[layer].state !== "resting") ||
                    this[layer].hasRoutedDemand())
        )
        return loopWanted || (this.layerGain("cues") > 0 && this.cues.hasRoutedDemand())
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
        const onGesture = (event: Event) => {
            if (isActivationEvent(event)) this.unlock()
        }
        for (const type of ACTIVATION_EVENTS) {
            document.addEventListener(type, onGesture, { capture: true, passive: true })
        }
        this.cleanups.push(() => {
            for (const type of ACTIVATION_EVENTS) {
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
            this.session.setHidden(hidden)
            if (hidden) {
                if (this.atmospherePreviewing) {
                    this.cancelAtmospherePreview()
                    this.atmosphere.stop(0)
                }
                this.soundscapes.pause()
                this.atmosphere.pause()
                this.cues.stopAll()
                this.voiceOutput?.setEnabled(false)
                this.pauseVoiceWhileHidden()
            } else if (!this.session.idle && this.session.sleep.status !== "fired") {
                this.soundscapes.resume()
                this.atmosphere.resume()
                this.voiceOutput?.setEnabled(this.voiceEnabled())
                if (this.voicePausedForVisibility) {
                    this.voicePausedForVisibility = false
                    this.voiceOutput?.resume()
                }
            }
            this.refresh()
        }
        document.addEventListener("visibilitychange", sync)
        this.cleanups.push(() => document.removeEventListener("visibilitychange", sync))
        sync()
    }

    /** Pause a hidden voice once, including starts that finish loading after the page hides. */
    private pauseVoiceWhileHidden(): void {
        if (
            this.pageHidden &&
            !this.voicePausedForVisibility &&
            this.voiceSnapshot.status === "playing"
        ) {
            this.voicePausedForVisibility = true
            this.voiceOutput?.pause()
        }
    }

    private volumeControl(): ReaderMixerVolumeControl {
        if (this.voiceSnapshot.volumeControl === "on-off") return "on-off"
        if (this.graph && this.elementFallbacks.size === 0) return "level"
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
        if (this.session.idle && status !== "idle" && status !== "resting" && status !== "failed")
            status = "paused"
        return Object.freeze({
            status,
            current: snapshot.audibleTrackKey,
            requested: snapshot.requestedTrackKey,
            failure: snapshot.failure?.message ?? null,
            effectiveLevel: this.layerGain(layer, this.duckTarget),
            routing: this.graph && !this.elementFallbacks.has(layer) ? "web-audio" : "element",
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
                routing: this.graph && !this.elementFallbacks.has("cues") ? "web-audio" : "element",
            }),
            voice: Object.freeze({
                status:
                    this.pageHidden &&
                    (this.voiceSnapshot.status === "playing" ||
                        this.voiceSnapshot.status === "loading")
                        ? "paused"
                        : this.voiceSnapshot.status,
                current: this.voiceSnapshot.current ?? null,
                requested: this.voiceSnapshot.current ?? null,
                failure: this.voiceSnapshot.failure ?? null,
                effectiveLevel: this.voiceSnapshot.muted ? 0 : this.layerGain("voice"),
                routing: this.voiceSnapshot.routing ?? "element",
            }),
        })
        const loopsRequested = (["soundscapes", "atmosphere"] as const).some(
            (layer) =>
                !this.elementFallbacks.has(layer) &&
                this.layerGain(layer) > 0 &&
                this.loopStatus[layer].requestedTrackKey !== null &&
                this.loopStatus[layer].state !== "failed" &&
                this.loopStatus[layer].state !== "resting"
        )
        const needsGesture =
            (!this.pageHidden &&
                READER_MIXER_LAYERS.some(
                    (layer) => this.layerGain(layer) > 0 && layers[layer].status === "blocked"
                )) ||
            ((this.graph?.state === "suspended" || this.graph?.state === "interrupted") &&
                (loopsRequested || this.activeCues > 0) &&
                !this.pageHidden)
        return Object.freeze({
            preferences: this.prefs,
            availability: Object.freeze({
                soundscapes: this.availabilityInput.soundscapes ?? true,
                atmosphere: this.availabilityInput.atmosphere ?? true,
                cues: this.availabilityInput.cues ?? true,
                voice: this.availabilityInput.voice ?? !!this.voiceOutput,
            }),
            layers,
            atmosphereOptions: this.atmosphereOptions,
            presets: this.presets,
            activePresetId: this.matchPreset(),
            atmosphereActive: this.atmosphereActive,
            atmospherePreviewing: this.atmospherePreviewing,
            sleepTimer: this.session.sleep,
            sleepTimerChoices: this.session.choices,
            idle: this.session.idle,
            soundscapePlays: this.soundscapes.getCompletedPlays(),
            activeCues: this.activeCues,
            routing: this.graph ? "web-audio" : "element",
            volumeControl: this.volumeControl(),
            pageHidden: this.pageHidden,
            needsGesture,
            duck: this.duckTarget,
        })
    }

    private matchPreset(): string | null {
        const match = this.presets.find((preset) =>
            samePreferences(
                normalizeReaderMixerPreferences(preset.preferences, this.prefs),
                this.prefs
            )
        )
        return match?.id ?? null
    }

    private refresh(): void {
        if (!this.ready || this.disposed) return
        this.syncRuntime()
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

    private voiceEnabled(): boolean {
        return (
            !this.pageHidden &&
            !this.session?.idle &&
            this.session?.sleep.status !== "fired" &&
            computeReaderMixerGain(this.prefs, "voice") > 0
        )
    }

    private fireSleep(event: ReaderMixerSleepEvent): void {
        this.cancelAtmospherePreview()
        this.cancelIdleFade()
        this.idleGain = 1
        this.soundscapes.stop(this.sleepFadeMs)
        this.atmosphere.stop(this.sleepFadeMs)
        this.voicePausedForVisibility = false
        this.voicePausedForIdle = false
        this.voiceOutput?.setEnabled(false)
        this.voiceOutput?.pause()
        this.applyLevels()
        this.refresh()
        for (const listener of [...this.sleepListeners]) {
            try {
                listener(event)
            } catch {
                /* Host speech cannot interrupt cleanup. */
            }
        }
    }

    private resumeAfterSleep(): void {
        this.cancelIdleFade()
        this.idleGain = 1
        this.soundscapes.resume()
        this.atmosphere.resume()
        if (this.wantedSoundscape)
            this.playSoundscape(this.wantedSoundscape.track, this.wantedSoundscape.options)
        if (this.atmosphereStarted) this.startAtmosphere()
        this.voiceOutput?.setEnabled(this.voiceEnabled())
        if (this.layerGain("voice") > 0) this.voiceOutput?.resume()
        this.applyLevels()
    }

    private changeIdle(idle: boolean): void {
        this.cancelIdleFade()
        if (!idle) {
            this.idleGain = 1
            this.applyLevels()
            if (!this.pageHidden && this.session.sleep.status !== "fired") {
                this.soundscapes.resume()
                this.atmosphere.resume()
                if (this.voicePausedForIdle) {
                    this.voicePausedForIdle = false
                    this.voiceOutput?.resume()
                }
            }
            return
        }
        if (this.voiceSnapshot.status === "playing") {
            this.voicePausedForIdle = true
            this.voiceOutput?.pause()
        }
        const finish = () => {
            this.cancelIdleFade()
            this.idleGain = 0
            this.soundscapes.pause()
            this.atmosphere.pause()
            this.applyLevels()
            this.refresh()
        }
        if (this.pageHidden || this.idleFadeMs === 0) {
            finish()
            return
        }
        const from = this.idleGain
        const began = Date.now()
        this.idleFadeTimer = setInterval(() => {
            const progress = Math.min(1, (Date.now() - began) / this.idleFadeMs)
            this.idleGain = from * (1 - progress)
            this.applyLevels()
            if (progress >= 1) finish()
        }, 33)
    }

    private cancelIdleFade(): void {
        if (this.idleFadeTimer !== null) clearInterval(this.idleFadeTimer)
        this.idleFadeTimer = null
    }
}

function sameState(a: ReaderMixerState, b: ReaderMixerState): boolean {
    if (
        a.preferences !== b.preferences ||
        a.atmosphereOptions !== b.atmosphereOptions ||
        a.presets !== b.presets
    ) {
        return false
    }
    const rest = (state: ReaderMixerState) =>
        JSON.stringify({ ...state, preferences: null, atmosphereOptions: null, presets: null })
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
