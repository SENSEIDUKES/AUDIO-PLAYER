import { BufferedRange, DistanceModelType } from '../../types';
import { AudioBackend, AudioBackendErrorCode, AudioBackendEvent, AudioBackendInfo, AudioBackendKind } from './AudioBackend';
export declare const WEBAUDIO_CAPABILITIES: {
    readonly streaming: false;
    readonly preciseTiming: true;
    readonly reliableVolume: true;
    readonly decodeAhead: true;
    readonly requiresCors: true;
    readonly progressiveBuffered: false;
};
/**
 * Web Audio playback backend: fetch + decodeAudioData into an AudioBuffer,
 * played through AudioBufferSourceNode → [PannerNode] → StereoPannerNode → GainNode → destination.
 *
 * Spatial audio features (Howler.js-style API):
 * - Stereo panning via StereoPannerNode (-1 left to 1 right)
 * - 3D positioning via PannerNode with HRTF (default) or equalpower (lite mode)
 * - Source orientation for directional audio
 * - Distance modeling (inverse/linear/exponential) with refDistance, maxDistance, rolloffFactor
 * - Cone settings for directional audio (coneInnerAngle, coneOuterAngle, coneOuterGain)
 * - Playback rate control (0.5 to 4.0)
 * - Lite mode: skips 3D PannerNode, uses only StereoPannerNode for mobile/low-power
 *
 * Synthesizes the media-element events the engine hook expects, so the hook's
 * state machine is identical to the html5 path. Key semantic mappings:
 * - pause = stop the source node and remember the offset (not ctx.suspend(),
 *   which is context-global and would ambiguate the autoplay check).
 * - seek while playing = silently swap in a new source node at the offset.
 * - native loop = `source.loop`, which (like the html5 `loop` attribute)
 *   suppresses the `ended` event — repeat-one relies on that.
 * - volume = GainNode, so programmatic volume works on iOS Safari.
 *
 * A monotonic `generation` invalidates every in-flight fetch/decode/play when
 * the source changes — the backend-level mirror of the hook's playbackToken.
 */
export declare class WebAudioBackend implements AudioBackend {
    readonly kind: AudioBackendKind;
    private info;
    private ctx;
    private gain;
    private panner;
    private stereoPanner;
    private source;
    private buffer;
    private srcUrl;
    private state;
    /** Playback position while not playing; start offset while playing. */
    private offset;
    private startedAtCtxTime;
    private volume;
    private muted;
    private loopFlag;
    private lastError;
    private generation;
    /** Invalidates `source.onended` from nodes we stopped on purpose. */
    private sourceToken;
    private loadPromise;
    private fetchAbort;
    private preloadAborts;
    /** In-flight preload decodes, so load() can adopt them instead of re-fetching. */
    private preloadPromises;
    private listeners;
    private stereoPan;
    private position;
    private orientation;
    private rate;
    private distanceModel;
    private refDistance;
    private maxDistance;
    private rolloffFactor;
    private coneInnerAngle;
    private coneOuterAngle;
    private coneOuterGain;
    private liteMode;
    constructor(info: AudioBackendInfo);
    private emit;
    private ensureContext;
    private cachePut;
    private cacheTouch;
    /** Stop the current source node without emitting any events. */
    private stopSourceNode;
    private abortFetch;
    private failLoad;
    private decodeArrayBuffer;
    private fetchNetworkArrayBuffer;
    private loadBufferWaterfall;
    private fetchAndDecode;
    /** Adopt a decoded buffer as the active source and announce readiness. */
    private completeLoad;
    /**
     * Wait for an in-flight preload of the same URL instead of starting a
     * second fetch+decode. Falls back to a real load when the preload failed
     * or was aborted, so errors surface through the normal path.
     */
    private adoptPreload;
    /** Start (or restart) playback of the decoded buffer at `offset` seconds. */
    private startSource;
    private playInternal;
    isAttached(): boolean;
    setSource(src: string | null): void;
    load(): void;
    clearSource(): void;
    play(): Promise<void>;
    pause(): void;
    getCurrentTime(): number;
    setCurrentTime(seconds: number): void;
    getDuration(): number;
    isPaused(): boolean;
    isEnded(): boolean;
    hasMetadata(): boolean;
    setVolume(value: number): void;
    getVolume(): number;
    isMuted(): boolean;
    setMuted(muted: boolean): void;
    setLoop(loop: boolean): void;
    getBufferedRanges(): BufferedRange[];
    getError(): AudioBackendErrorCode | null;
    getDecodedData(): AudioBuffer | null;
    addEventListener(event: AudioBackendEvent, handler: () => void): void;
    removeEventListener(event: AudioBackendEvent, handler: () => void): void;
    preload(url: string): void;
    releasePreload(): void;
    getMediaElement(): HTMLAudioElement | null;
    getInfo(): AudioBackendInfo;
    destroy(): void;
    supportsSpatial(): boolean;
    setStereo(pan: number): void;
    getStereo(): number;
    setPos(x: number, y: number, z: number): void;
    getPos(): [number, number, number];
    setOrientation(x: number, y: number, z: number): void;
    getOrientation(): [number, number, number];
    setRate(rate: number): void;
    getRate(): number;
    setDistanceModel(model: DistanceModelType): void;
    getDistanceModel(): DistanceModelType;
    setRefDistance(distance: number): void;
    getRefDistance(): number;
    setMaxDistance(distance: number): void;
    getMaxDistance(): number;
    setRolloffFactor(factor: number): void;
    getRolloffFactor(): number;
    setConeInnerAngle(angle: number): void;
    getConeInnerAngle(): number;
    setConeOuterAngle(angle: number): void;
    getConeOuterAngle(): number;
    setConeOuterGain(gain: number): void;
    getConeOuterGain(): number;
    setLiteMode(enabled: boolean): void;
    isLiteMode(): boolean;
    /**
     * Get the shared AudioContext for global listener control.
     * Returns null if the context hasn't been created yet.
     * Use this to control the global listener position/orientation.
     */
    getAudioContext(): AudioContext | null;
}
//# sourceMappingURL=WebAudioBackend.d.ts.map