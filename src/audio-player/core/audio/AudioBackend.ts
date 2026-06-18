import type { BufferedRange, DistanceModelType } from "../../types"

/** Available playback backend implementations. */
export type AudioBackendKind = "html5" | "webaudio"

/**
 * The media-element-shaped events the engine hook subscribes to. The HTML5
 * backend forwards them 1:1 from the underlying element; the Web Audio backend
 * synthesizes the equivalent moments so the hook's state machine is identical
 * for both.
 */
export type AudioBackendEvent =
    | "play"
    | "pause"
    | "ended"
    | "loadedmetadata"
    | "waiting"
    | "stalled"
    | "canplay"
    | "canplaythrough"
    | "playing"
    | "progress"
    | "timeupdate"
    | "error"
    | "loadstart"

/**
 * Normalized load/playback failure codes. Mirrors the `MediaError` code space
 * so both backends can drive the same user-facing error messages.
 */
export type AudioBackendErrorCode =
    | "aborted"
    | "network"
    | "decode"
    | "src-not-supported"
    | "unknown"

/** What a backend can and cannot do, for consumers picking a backend. */
export interface AudioBackendCapabilities {
    /** Progressive playback before the full file has downloaded. */
    streaming: boolean
    /** Sample-accurate start/loop scheduling. */
    preciseTiming: boolean
    /** Programmatic volume honored everywhere, including iOS Safari. */
    reliableVolume: boolean
    /** Decode-ahead cache for near-instant track changes. */
    decodeAhead: boolean
    /** Remote sources must allow CORS for this backend to play them. */
    requiresCors: boolean
    /** Multi-segment buffered ranges reported while downloading. */
    progressiveBuffered: boolean
}

/** Result of `engine.getBackendInfo()` — which backend ran and why. */
export interface AudioBackendInfo {
    /** Backend asked for in config. */
    requested: AudioBackendKind
    /** Backend actually instantiated. */
    active: AudioBackendKind
    /** True when `requested` was unavailable and the factory fell back. */
    didFallback: boolean
    /** Human-readable reason when `didFallback` is true. */
    fallbackReason?: string
    capabilities: AudioBackendCapabilities
}

/**
 * Playback backend contract. Designed to mirror HTMLMediaElement semantics so
 * `useAudioPlayer` keeps its existing race/token/state logic verbatim and the
 * HTML5 implementation is a zero-logic pass-through.
 *
 * Implementations must:
 * - Reject `play()` with errors whose `name` is `"AbortError"`,
 *   `"NotAllowedError"` (autoplay blocked), or `"NotSupportedError"` so the
 *   hook's promise handling is backend-agnostic.
 * - Keep `destroy()` idempotent AND revivable: React StrictMode unmounts and
 *   remounts with the same backend instance, so a destroyed backend must be
 *   usable again on the next `load()`/`play()`.
 */
export interface AudioBackend {
    readonly kind: AudioBackendKind

    /**
     * Whether the backend is ready to receive commands. html5: true once the
     * JSX `<audio>` ref has mounted. webaudio: always true.
     */
    isAttached(): boolean

    /**
     * Point the backend at a source URL (or null to clear). html5: no-op —
     * the host JSX owns the element's `src` attribute. webaudio: arms the URL
     * for the next `load()`.
     */
    setSource(src: string | null): void
    /** Mirrors `HTMLMediaElement.load()`: reset and (re)load the current source. */
    load(): void
    /** Mirrors `removeAttribute("src")` + `load()`: stop and drop the source. */
    clearSource(): void

    play(): Promise<void>
    pause(): void

    getCurrentTime(): number
    setCurrentTime(seconds: number): void
    /** Raw duration; may be NaN/Infinity for html5 before metadata loads. */
    getDuration(): number
    isPaused(): boolean
    isEnded(): boolean
    /** Equivalent of `readyState >= 1` (metadata known). */
    hasMetadata(): boolean

    /** Raw volume write — no support detection; the hook owns that probe. */
    setVolume(value: number): void
    /** Read-back used by the hook's iOS volume-unsupported probe. */
    getVolume(): number
    isMuted(): boolean
    setMuted(muted: boolean): void
    setLoop(loop: boolean): void

    getBufferedRanges(): BufferedRange[]
    getError(): AudioBackendErrorCode | null

    /**
     * Decoded PCM for the active source when the backend has it (webaudio
     * after load). html5 streams through the element and returns null —
     * consumers needing waveform data must decode separately.
     */
    getDecodedData(): AudioBuffer | null

    addEventListener(event: AudioBackendEvent, handler: () => void): void
    removeEventListener(event: AudioBackendEvent, handler: () => void): void

    /** Cache-warm a URL without switching playback to it. */
    preload(url: string): void
    /** Release any preload resources (detached element / decode cache). */
    releasePreload(): void

    /**
     * The underlying media element when one exists (html5), for plugins that
     * drive the DOM directly. webaudio returns null — plugins must guard.
     */
    getMediaElement(): HTMLAudioElement | null
    getInfo(): AudioBackendInfo
    destroy(): void

    // ===================== SPATIAL AUDIO METHODS =====================
    // These methods control spatial audio behavior. HTML5 backend returns
    // false/no-ops; WebAudioBackend provides full implementation.

    /** Returns true if this backend supports spatial audio (webaudio only). */
    supportsSpatial(): boolean

    /** Set stereo pan from -1 (left) to 1 (right). */
    setStereo(pan: number): void
    /** Get current stereo pan value. */
    getStereo(): number

    /** Set 3D position of the audio source. */
    setPos(x: number, y: number, z: number): void
    /** Get current 3D position [x, y, z]. */
    getPos(): [number, number, number]

    /** Set orientation vector (direction sound is pointing). */
    setOrientation(x: number, y: number, z: number): void
    /** Get current orientation vector [x, y, z]. */
    getOrientation(): [number, number, number]

    /** Set playback rate (pitch) from 0.5 to 4.0. */
    setRate(rate: number): void
    /** Get current playback rate. */
    getRate(): number

    /** Set distance model algorithm. */
    setDistanceModel(model: DistanceModelType): void
    /** Get current distance model. */
    getDistanceModel(): DistanceModelType

    /** Set reference distance for attenuation calculations. */
    setRefDistance(distance: number): void
    /** Get current reference distance. */
    getRefDistance(): number

    /** Set maximum distance for attenuation calculations. */
    setMaxDistance(distance: number): void
    /** Get current maximum distance. */
    getMaxDistance(): number

    /** Set rolloff factor for distance attenuation. */
    setRolloffFactor(factor: number): void
    /** Get current rolloff factor. */
    getRolloffFactor(): number

    /** Set cone inner angle for directional audio. */
    setConeInnerAngle(angle: number): void
    /** Get current cone inner angle. */
    getConeInnerAngle(): number

    /** Set cone outer angle for directional audio. */
    setConeOuterAngle(angle: number): void
    /** Get current cone outer angle. */
    getConeOuterAngle(): number

    /** Set cone outer gain for directional audio. */
    setConeOuterGain(gain: number): void
    /** Get current cone outer gain. */
    getConeOuterGain(): number

    /** Enable/disable lite mode (stereo-only, no 3D panner). */
    setLiteMode(enabled: boolean): void
    /** Check if lite mode is active. */
    isLiteMode(): boolean

    /**
     * Get the shared AudioContext for global listener control.
     * Returns null if the context hasn't been created yet.
     * WebAudioBackend only; HTML5AudioBackend returns undefined.
     * Use this to control the global listener position/orientation.
     */
    getAudioContext?(): AudioContext | null
}
