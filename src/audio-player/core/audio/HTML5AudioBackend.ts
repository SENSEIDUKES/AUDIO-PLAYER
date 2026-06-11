import type { RefObject } from "react"
import type { BufferedRange } from "../../types"
import type {
    AudioBackend,
    AudioBackendErrorCode,
    AudioBackendEvent,
    AudioBackendInfo,
    AudioBackendKind,
} from "./AudioBackend"

export const HTML5_CAPABILITIES = {
    streaming: true,
    preciseTiming: false,
    reliableVolume: false,
    decodeAhead: false,
    requiresCors: false,
    progressiveBuffered: true,
} as const

/**
 * Thin pass-through over the host-rendered `<audio>` element. Every call reads
 * `audioRef.current` at invocation time and forwards 1:1, so behavior is
 * identical to the hook touching the element directly. When the ref has not
 * mounted, methods no-op / return the same defaults the hook's old
 * `if (!audio) return` guards produced.
 */
export class HTML5AudioBackend implements AudioBackend {
    readonly kind: AudioBackendKind = "html5"

    private audioRef: RefObject<HTMLAudioElement | null>
    private preloadAudio: HTMLAudioElement | null = null
    private info: AudioBackendInfo

    constructor(
        audioRef: RefObject<HTMLAudioElement | null>,
        info?: AudioBackendInfo
    ) {
        this.audioRef = audioRef
        this.info = info ?? {
            requested: "html5",
            active: "html5",
            didFallback: false,
            capabilities: HTML5_CAPABILITIES,
        }
    }

    private get audio(): HTMLAudioElement | null {
        return this.audioRef.current
    }

    isAttached(): boolean {
        return this.audio !== null
    }

    setSource(_src: string | null): void {
        // No-op: the host JSX owns the element's `src` attribute.
    }

    load(): void {
        this.audio?.load()
    }

    clearSource(): void {
        const audio = this.audio
        if (!audio) return
        audio.removeAttribute("src")
        audio.load()
    }

    play(): Promise<void> {
        const audio = this.audio
        if (!audio) {
            const error = new Error("Audio element is not mounted.")
            error.name = "NotSupportedError"
            return Promise.reject(error)
        }
        return audio.play()
    }

    pause(): void {
        this.audio?.pause()
    }

    getCurrentTime(): number {
        return this.audio?.currentTime ?? 0
    }

    setCurrentTime(seconds: number): void {
        const audio = this.audio
        if (audio) audio.currentTime = seconds
    }

    getDuration(): number {
        return this.audio?.duration ?? 0
    }

    isPaused(): boolean {
        return this.audio?.paused ?? true
    }

    isEnded(): boolean {
        return this.audio?.ended ?? false
    }

    hasMetadata(): boolean {
        return (this.audio?.readyState ?? 0) >= 1
    }

    setVolume(value: number): void {
        const audio = this.audio
        if (audio) audio.volume = value
    }

    getVolume(): number {
        return this.audio?.volume ?? 1
    }

    isMuted(): boolean {
        return this.audio?.muted ?? false
    }

    setMuted(muted: boolean): void {
        const audio = this.audio
        if (audio) audio.muted = muted
    }

    setLoop(loop: boolean): void {
        const audio = this.audio
        if (audio) audio.loop = loop
    }

    getBufferedRanges(): BufferedRange[] {
        const audio = this.audio
        if (!audio) return []
        const ranges: BufferedRange[] = []
        const length = audio.buffered.length
        for (let i = 0; i < length; i++) {
            ranges.push({
                start: audio.buffered.start(i),
                end: audio.buffered.end(i),
            })
        }
        return ranges
    }

    getError(): AudioBackendErrorCode | null {
        const error = this.audio?.error
        if (!error) return null
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                return "aborted"
            case error.MEDIA_ERR_NETWORK:
                return "network"
            case error.MEDIA_ERR_DECODE:
                return "decode"
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return "src-not-supported"
            default:
                return "unknown"
        }
    }

    getDecodedData(): AudioBuffer | null {
        // The element streams; no decoded PCM is available on this backend.
        return null
    }

    addEventListener(event: AudioBackendEvent, handler: () => void): void {
        this.audio?.addEventListener(event, handler)
    }

    removeEventListener(event: AudioBackendEvent, handler: () => void): void {
        this.audio?.removeEventListener(event, handler)
    }

    preload(url: string): void {
        let el = this.preloadAudio
        if (!el) {
            el = new Audio()
            el.preload = "auto"
            this.preloadAudio = el
        }
        if (el.src !== url) {
            el.src = url
            el.load()
        }
    }

    releasePreload(): void {
        if (this.preloadAudio) {
            this.preloadAudio.src = ""
            this.preloadAudio = null
        }
    }

    getMediaElement(): HTMLAudioElement | null {
        return this.audio
    }

    getInfo(): AudioBackendInfo {
        return this.info
    }

    destroy(): void {
        // The main element is JSX-owned; only release backend-owned resources.
        this.releasePreload()
    }
}
