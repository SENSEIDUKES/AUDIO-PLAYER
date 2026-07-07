import { RefObject } from 'react';
import { BufferedRange, DistanceModelType } from '../../types';
import { AudioBackend, AudioBackendErrorCode, AudioBackendEvent, AudioBackendInfo, AudioBackendKind } from './AudioBackend';
export declare const HTML5_CAPABILITIES: {
    readonly streaming: true;
    readonly preciseTiming: false;
    readonly reliableVolume: false;
    readonly decodeAhead: false;
    readonly requiresCors: false;
    readonly progressiveBuffered: true;
};
/**
 * Thin pass-through over the host-rendered `<audio>` element. Every call reads
 * `audioRef.current` at invocation time and forwards 1:1, so behavior is
 * identical to the hook touching the element directly. When the ref has not
 * mounted, methods no-op / return the same defaults the hook's old
 * `if (!audio) return` guards produced.
 */
export declare class HTML5AudioBackend implements AudioBackend {
    readonly kind: AudioBackendKind;
    private audioRef;
    private preloadAudio;
    private info;
    constructor(audioRef: RefObject<HTMLAudioElement | null>, info?: AudioBackendInfo);
    private get audio();
    isAttached(): boolean;
    setSource(_src: string | null): void;
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
    setStereo(_pan: number): void;
    getStereo(): number;
    setPos(_x: number, _y: number, _z: number): void;
    getPos(): [number, number, number];
    setOrientation(_x: number, _y: number, _z: number): void;
    getOrientation(): [number, number, number];
    setRate(_rate: number): void;
    getRate(): number;
    setDistanceModel(_model: DistanceModelType): void;
    getDistanceModel(): DistanceModelType;
    setRefDistance(_distance: number): void;
    getRefDistance(): number;
    setMaxDistance(_distance: number): void;
    getMaxDistance(): number;
    setRolloffFactor(_factor: number): void;
    getRolloffFactor(): number;
    setConeInnerAngle(_angle: number): void;
    getConeInnerAngle(): number;
    setConeOuterAngle(_angle: number): void;
    getConeOuterAngle(): number;
    setConeOuterGain(_gain: number): void;
    getConeOuterGain(): number;
    setLiteMode(_enabled: boolean): void;
    isLiteMode(): boolean;
}
//# sourceMappingURL=HTML5AudioBackend.d.ts.map