import type { BufferedRange, DistanceModelType } from "../../types"
import type {
    AudioBackend,
    AudioBackendErrorCode,
    AudioBackendEvent,
    AudioBackendInfo,
    AudioBackendKind,
} from "./AudioBackend"

export const WEBAUDIO_CAPABILITIES = {
    streaming: false,
    preciseTiming: true,
    reliableVolume: true,
    decodeAhead: true,
    requiresCors: true,
    progressiveBuffered: false,
} as const

/** Decoded PCM is heavy (~10MB per stereo minute); keep the cache small. */
const DECODE_CACHE_LIMIT = 3

type WebAudioState =
    | "idle"
    | "loading"
    | "ready"
    | "playing"
    | "paused"
    | "ended"
    | "error"

/** Default spatial audio values matching Howler.js conventions. */
const DEFAULT_SPATIAL = {
    stereo: 0,
    pos: [0, 0, 0] as [number, number, number],
    orientation: [1, 0, 0] as [number, number, number],
    rate: 1,
    distanceModel: "inverse" as DistanceModelType,
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    liteMode: false,
}

function namedError(name: string, message: string): Error {
    const error = new Error(message)
    error.name = name
    return error
}

function getAudioContextCtor(): typeof AudioContext | undefined {
    if (typeof window === "undefined") return undefined
    return (
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
    )
}

/**
 * One AudioContext shared by every WebAudioBackend instance on the page.
 * Browsers cap (and charge resources for) concurrent contexts, so each
 * backend gets its own GainNode into the shared context instead. Reference
 * counted: closed when the last backend releases it, recreated on demand.
 */
let sharedContext: AudioContext | null = null
let sharedContextUsers = 0

function retainSharedContext(): AudioContext {
    if (!sharedContext || sharedContext.state === "closed") {
        const Ctor = getAudioContextCtor()
        if (!Ctor) {
            throw namedError("NotSupportedError", "Web Audio API unavailable.")
        }
        sharedContext = new Ctor()
        sharedContextUsers = 0
    }
    sharedContextUsers += 1
    return sharedContext
}

function releaseSharedContext(ctx: AudioContext): void {
    if (ctx !== sharedContext) return
    sharedContextUsers = Math.max(0, sharedContextUsers - 1)
    if (sharedContextUsers === 0) {
        if (sharedContext.state !== "closed") {
            void sharedContext.close().catch(() => {})
        }
        sharedContext = null
    }
}

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
export class WebAudioBackend implements AudioBackend {
    readonly kind: AudioBackendKind = "webaudio"

    private info: AudioBackendInfo
    private ctx: AudioContext | null = null
    private gain: GainNode | null = null
    private panner: PannerNode | null = null
    private stereoPanner: StereoPannerNode | null = null
    private source: AudioBufferSourceNode | null = null
    private buffer: AudioBuffer | null = null
    private srcUrl: string | null = null
    private state: WebAudioState = "idle"
    /** Playback position while not playing; start offset while playing. */
    private offset = 0
    private startedAtCtxTime = 0
    private volume = 1
    private muted = false
    private loopFlag = false
    private lastError: AudioBackendErrorCode | null = null
    private generation = 0
    /** Invalidates `source.onended` from nodes we stopped on purpose. */
    private sourceToken = 0
    private loadPromise: Promise<void> | null = null
    private fetchAbort: AbortController | null = null
    private decodeCache = new Map<string, AudioBuffer>()
    private preloadAborts = new Map<string, AbortController>()
    /** In-flight preload decodes, so load() can adopt them instead of re-fetching. */
    private preloadPromises = new Map<string, Promise<AudioBuffer | null>>()
    private listeners = new Map<AudioBackendEvent, Set<() => void>>()

    // Spatial audio state
    private stereoPan = DEFAULT_SPATIAL.stereo
    private position: [number, number, number] = [...DEFAULT_SPATIAL.pos]
    private orientation: [number, number, number] = [...DEFAULT_SPATIAL.orientation]
    private rate = DEFAULT_SPATIAL.rate
    private distanceModel: DistanceModelType = DEFAULT_SPATIAL.distanceModel
    private refDistance = DEFAULT_SPATIAL.refDistance
    private maxDistance = DEFAULT_SPATIAL.maxDistance
    private rolloffFactor = DEFAULT_SPATIAL.rolloffFactor
    private coneInnerAngle = DEFAULT_SPATIAL.coneInnerAngle
    private coneOuterAngle = DEFAULT_SPATIAL.coneOuterAngle
    private coneOuterGain = DEFAULT_SPATIAL.coneOuterGain
    private liteMode = DEFAULT_SPATIAL.liteMode

    constructor(info: AudioBackendInfo) {
        this.info = info
    }

    private emit(event: AudioBackendEvent): void {
        const handlers = this.listeners.get(event)
        if (!handlers) return
        for (const handler of Array.from(handlers)) handler()
    }

    private ensureContext(): AudioContext {
        if (this.ctx && this.ctx.state !== "closed") return this.ctx
        this.ctx = retainSharedContext()

        // Create spatial audio nodes: PannerNode → StereoPannerNode → GainNode
        this.panner = this.ctx.createPanner()
        this.panner.panningModel = this.liteMode ? "equalpower" : "HRTF"
        this.panner.distanceModel = this.distanceModel
        this.panner.refDistance = this.refDistance
        this.panner.maxDistance = this.maxDistance
        this.panner.rolloffFactor = this.rolloffFactor
        this.panner.coneInnerAngle = this.coneInnerAngle
        this.panner.coneOuterAngle = this.coneOuterAngle
        this.panner.coneOuterGain = this.coneOuterGain
        this.panner.positionX.value = this.position[0]
        this.panner.positionY.value = this.position[1]
        this.panner.positionZ.value = this.position[2]
        this.panner.orientationX.value = this.orientation[0]
        this.panner.orientationY.value = this.orientation[1]
        this.panner.orientationZ.value = this.orientation[2]

        this.gain = this.ctx.createGain()
        this.gain.gain.value = this.muted ? 0 : this.volume

        if (typeof this.ctx.createStereoPanner === "function") {
            this.stereoPanner = this.ctx.createStereoPanner()
            this.stereoPanner.pan.value = this.stereoPan
            this.panner.connect(this.stereoPanner)
            this.stereoPanner.connect(this.gain)
        } else {
            this.panner.connect(this.gain)
        }
        this.gain.connect(this.ctx.destination)

        return this.ctx
    }

    private cachePut(url: string, buffer: AudioBuffer): void {
        this.decodeCache.delete(url)
        this.decodeCache.set(url, buffer)
        while (this.decodeCache.size > DECODE_CACHE_LIMIT) {
            const oldest = this.decodeCache.keys().next().value
            if (oldest === undefined) break
            this.decodeCache.delete(oldest)
        }
    }

    private cacheTouch(url: string): AudioBuffer | undefined {
        const buffer = this.decodeCache.get(url)
        if (buffer) {
            this.decodeCache.delete(url)
            this.decodeCache.set(url, buffer)
        }
        return buffer
    }

    /** Stop the current source node without emitting any events. */
    private stopSourceNode(): void {
        this.sourceToken += 1
        const source = this.source
        if (!source) return
        this.source = null
        source.onended = null
        try {
            source.stop()
        } catch {
            // Stopping a never-started/already-stopped node throws; ignore.
        }
        try {
            source.disconnect()
        } catch {
            // Already disconnected.
        }
    }

    private abortFetch(): void {
        if (this.fetchAbort) {
            this.fetchAbort.abort()
            this.fetchAbort = null
        }
    }

    private failLoad(code: AudioBackendErrorCode, url: string): void {
        this.buffer = null
        this.lastError = code
        this.state = "error"
        // Evict so a retry() → load() genuinely re-fetches.
        this.decodeCache.delete(url)
        this.emit("error")
    }

    private async fetchAndDecode(url: string, gen: number): Promise<void> {
        const abort = new AbortController()
        this.fetchAbort = abort

        let data: ArrayBuffer
        try {
            const response = await fetch(url, { signal: abort.signal })
            if (gen !== this.generation) return
            if (!response.ok) {
                this.failLoad("src-not-supported", url)
                return
            }
            data = await response.arrayBuffer()
            if (gen !== this.generation) return
        } catch (error: unknown) {
            if (gen !== this.generation) return
            if (error instanceof Error && error.name === "AbortError") return
            // Includes CORS rejections, which surface as opaque network errors.
            this.failLoad("network", url)
            return
        } finally {
            if (this.fetchAbort === abort) this.fetchAbort = null
        }

        let buffer: AudioBuffer
        try {
            // decodeAudioData works on a suspended context; no gesture needed.
            buffer = await this.ensureContext().decodeAudioData(data)
            if (gen !== this.generation) return
        } catch {
            if (gen !== this.generation) return
            this.failLoad("decode", url)
            return
        }

        this.completeLoad(url, buffer)
    }

    /** Adopt a decoded buffer as the active source and announce readiness. */
    private completeLoad(url: string, buffer: AudioBuffer): void {
        this.buffer = buffer
        this.cachePut(url, buffer)
        this.state = "ready"
        this.emit("loadedmetadata")
        this.emit("progress")
        this.emit("canplay")
        this.emit("canplaythrough")
    }

    /**
     * Wait for an in-flight preload of the same URL instead of starting a
     * second fetch+decode. Falls back to a real load when the preload failed
     * or was aborted, so errors surface through the normal path.
     */
    private async adoptPreload(
        url: string,
        pending: Promise<AudioBuffer | null>,
        gen: number
    ): Promise<void> {
        const buffer = await pending
        if (gen !== this.generation) return
        if (buffer) {
            this.completeLoad(url, buffer)
            return
        }
        await this.fetchAndDecode(url, gen)
    }

    /** Start (or restart) playback of the decoded buffer at `offset` seconds. */
    private startSource(offset: number): void {
        const ctx = this.ensureContext()
        const buffer = this.buffer
        if (!buffer || !this.gain) return
        this.stopSourceNode()
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = this.loopFlag
        // Connect to panner (first node in chain), not directly to gain
        source.connect(this.panner!)
        const token = (this.sourceToken += 1)
        source.onended = () => {
            // Only natural completion reaches here; manual stops bump the token.
            if (token !== this.sourceToken) return
            this.source = null
            this.offset = buffer.duration
            this.state = "ended"
            this.emit("ended")
        }
        const clamped = Math.max(0, Math.min(offset, buffer.duration))
        source.start(0, clamped)
        this.source = source
        this.offset = clamped
        this.startedAtCtxTime = ctx.currentTime
        this.state = "playing"
    }

    private async playInternal(): Promise<void> {
        if (!this.srcUrl) {
            throw namedError("NotSupportedError", "No audio source set.")
        }
        const ctx = this.ensureContext()
        // Kick off the load before any await so the download starts inside the
        // user gesture's synchronous window.
        if (!this.buffer && this.state !== "loading") {
            this.load()
        }
        const gen = this.generation

        let resumed = false
        try {
            await ctx.resume()
            resumed = true
        } catch {
            resumed = false
        }
        // resume() can resolve while the context stays suspended (no gesture);
        // treat that as autoplay-blocked so the hook's affordance shows.
        if (!resumed || ctx.state !== "running") {
            throw namedError(
                "NotAllowedError",
                "AudioContext requires a user gesture to start."
            )
        }
        if (gen !== this.generation) {
            throw namedError("AbortError", "Source changed during play().")
        }

        if (!this.buffer) {
            this.emit("waiting")
            await this.loadPromise
            if (gen !== this.generation) {
                throw namedError("AbortError", "Source changed during play().")
            }
            if (!this.buffer) {
                throw namedError(
                    "NotSupportedError",
                    "Audio failed to load or decode."
                )
            }
        }

        if (this.state === "playing") return

        // Like the html5 element, playing an ended track restarts it.
        const duration = this.buffer.duration
        const startAt =
            this.state === "ended" || this.offset >= duration ? 0 : this.offset
        this.startSource(startAt)
        this.emit("play")
        this.emit("playing")
    }

    isAttached(): boolean {
        return true
    }

    setSource(src: string | null): void {
        // Store the trimmed form so load()'s decode-cache and preload lookups
        // use the same key preload() trims to.
        const next = src && src.trim().length > 0 ? src.trim() : null
        this.generation += 1
        this.abortFetch()
        this.stopSourceNode()
        this.srcUrl = next
        this.buffer = null
        this.offset = 0
        this.lastError = null
        this.loadPromise = null
        this.state = "idle"
    }

    load(): void {
        this.generation += 1
        const gen = this.generation
        this.abortFetch()
        this.stopSourceNode()
        this.buffer = null
        this.offset = 0
        this.lastError = null
        this.emit("loadstart")
        const url = this.srcUrl
        if (!url) {
            this.state = "idle"
            this.loadPromise = null
            return
        }
        const cached = this.cacheTouch(url)
        if (cached) {
            this.completeLoad(url, cached)
            this.loadPromise = Promise.resolve()
            return
        }
        this.state = "loading"
        const pending = this.preloadPromises.get(url)
        this.loadPromise = pending
            ? this.adoptPreload(url, pending, gen)
            : this.fetchAndDecode(url, gen)
    }

    clearSource(): void {
        this.setSource(null)
    }

    play(): Promise<void> {
        return this.playInternal()
    }

    pause(): void {
        if (this.state !== "playing") return
        this.offset = this.getCurrentTime()
        this.stopSourceNode()
        this.state = "paused"
        this.emit("pause")
    }

    getCurrentTime(): number {
        const duration = this.buffer?.duration ?? 0
        if (this.state === "playing" && this.ctx) {
            const elapsed = this.ctx.currentTime - this.startedAtCtxTime
            const position = this.offset + elapsed
            if (this.loopFlag && duration > 0) {
                return position % duration
            }
            return Math.min(position, duration)
        }
        return this.offset
    }

    setCurrentTime(seconds: number): void {
        const duration = this.buffer?.duration ?? 0
        if (duration <= 0) {
            this.offset = Math.max(0, seconds)
            return
        }
        const clamped = Math.max(0, Math.min(duration, seconds))
        if (this.state === "playing") {
            // Silent source swap — html5 fires only seeking/seeked here, which
            // the engine hook does not listen to.
            this.startSource(clamped)
            return
        }
        this.offset = clamped
        if (this.state === "ended" && clamped < duration) {
            this.state = "paused"
        }
        this.emit("timeupdate")
    }

    getDuration(): number {
        return this.buffer?.duration ?? 0
    }

    isPaused(): boolean {
        return this.state !== "playing"
    }

    isEnded(): boolean {
        return this.state === "ended"
    }

    hasMetadata(): boolean {
        return this.buffer !== null
    }

    setVolume(value: number): void {
        this.volume = Math.max(0, Math.min(1, value))
        if (this.gain) {
            this.gain.gain.value = this.muted ? 0 : this.volume
        }
    }

    getVolume(): number {
        return this.volume
    }

    isMuted(): boolean {
        return this.muted
    }

    setMuted(muted: boolean): void {
        this.muted = muted
        if (this.gain) {
            this.gain.gain.value = muted ? 0 : this.volume
        }
    }

    setLoop(loop: boolean): void {
        if (loop === this.loopFlag) return
        // Re-anchor the position math before changing wrap behavior so
        // getCurrentTime() stays correct across the toggle.
        if (this.state === "playing" && this.ctx) {
            this.offset = this.getCurrentTime()
            this.startedAtCtxTime = this.ctx.currentTime
        }
        this.loopFlag = loop
        if (this.source) this.source.loop = loop
    }

    getBufferedRanges(): BufferedRange[] {
        const duration = this.buffer?.duration ?? 0
        if (duration <= 0) return []
        return [{ start: 0, end: duration }]
    }

    getError(): AudioBackendErrorCode | null {
        return this.lastError
    }

    getDecodedData(): AudioBuffer | null {
        return this.buffer
    }

    addEventListener(event: AudioBackendEvent, handler: () => void): void {
        let handlers = this.listeners.get(event)
        if (!handlers) {
            handlers = new Set()
            this.listeners.set(event, handlers)
        }
        handlers.add(handler)
    }

    removeEventListener(event: AudioBackendEvent, handler: () => void): void {
        this.listeners.get(event)?.delete(handler)
    }

    preload(url: string): void {
        const trimmed = url.trim()
        if (!trimmed) return
        if (this.decodeCache.has(trimmed) || this.preloadPromises.has(trimmed)) {
            return
        }
        const abort = new AbortController()
        this.preloadAborts.set(trimmed, abort)
        const run = async (): Promise<AudioBuffer | null> => {
            try {
                const response = await fetch(trimmed, { signal: abort.signal })
                if (!response.ok) return null
                const data = await response.arrayBuffer()
                if (abort.signal.aborted) return null
                const buffer = await this.ensureContext().decodeAudioData(data)
                if (abort.signal.aborted) return null
                this.cachePut(trimmed, buffer)
                return buffer
            } catch {
                // Preload is best-effort; failures surface on the real load.
                return null
            } finally {
                if (this.preloadAborts.get(trimmed) === abort) {
                    this.preloadAborts.delete(trimmed)
                }
                this.preloadPromises.delete(trimmed)
            }
        }
        this.preloadPromises.set(trimmed, run())
    }

    releasePreload(): void {
        for (const abort of this.preloadAborts.values()) abort.abort()
        this.preloadAborts.clear()
        this.preloadPromises.clear()
        this.decodeCache.clear()
    }

    getMediaElement(): HTMLAudioElement | null {
        return null
    }

    getInfo(): AudioBackendInfo {
        return this.info
    }

    destroy(): void {
        this.generation += 1
        this.abortFetch()
        this.stopSourceNode()
        this.releasePreload()
        this.buffer = null
        this.offset = 0
        this.lastError = null
        this.loadPromise = null
        this.state = "idle"

        // Disconnect spatial audio nodes
        if (this.panner) {
            try {
                this.panner.disconnect()
            } catch {
                // Already disconnected.
            }
            this.panner = null
        }
        if (this.stereoPanner) {
            try {
                this.stereoPanner.disconnect()
            } catch {
                // Already disconnected.
            }
            this.stereoPanner = null
        }
        if (this.gain) {
            try {
                this.gain.disconnect()
            } catch {
                // Already disconnected.
            }
            this.gain = null
        }
        if (this.ctx) {
            releaseSharedContext(this.ctx)
        }
        this.ctx = null
        // Revivable by design: the next load()/play() lazily recreates the
        // context (required for React StrictMode unmount/remount cycles).
    }

    // ===================== SPATIAL AUDIO METHODS =====================
    // Full Web Audio API implementation with PannerNode + StereoPannerNode

    supportsSpatial(): boolean {
        return true
    }

    setStereo(pan: number): void {
        this.stereoPan = Math.max(-1, Math.min(1, pan))
        if (this.stereoPanner) {
            this.stereoPanner.pan.value = this.stereoPan
        }
    }

    getStereo(): number {
        return this.stereoPan
    }

    setPos(x: number, y: number, z: number): void {
        this.position = [x, y, z]
        if (this.panner) {
            this.panner.positionX.value = x
            this.panner.positionY.value = y
            this.panner.positionZ.value = z
        }
    }

    getPos(): [number, number, number] {
        return this.position
    }

    setOrientation(x: number, y: number, z: number): void {
        this.orientation = [x, y, z]
        if (this.panner) {
            this.panner.orientationX.value = x
            this.panner.orientationY.value = y
            this.panner.orientationZ.value = z
        }
    }

    getOrientation(): [number, number, number] {
        return this.orientation
    }

    setRate(rate: number): void {
        const clamped = Math.max(0.5, Math.min(4.0, rate))
        this.rate = clamped
        if (this.source) {
            this.source.playbackRate.value = clamped
        }
    }

    getRate(): number {
        return this.rate
    }

    setDistanceModel(model: DistanceModelType): void {
        this.distanceModel = model
        if (this.panner) {
            this.panner.distanceModel = model
        }
    }

    getDistanceModel(): DistanceModelType {
        return this.distanceModel
    }

    setRefDistance(distance: number): void {
        this.refDistance = Math.max(0, distance)
        if (this.panner) {
            this.panner.refDistance = this.refDistance
        }
    }

    getRefDistance(): number {
        return this.refDistance
    }

    setMaxDistance(distance: number): void {
        this.maxDistance = Math.max(0, distance)
        if (this.panner) {
            this.panner.maxDistance = this.maxDistance
        }
    }

    getMaxDistance(): number {
        return this.maxDistance
    }

    setRolloffFactor(factor: number): void {
        this.rolloffFactor = Math.max(0, factor)
        if (this.panner) {
            this.panner.rolloffFactor = this.rolloffFactor
        }
    }

    getRolloffFactor(): number {
        return this.rolloffFactor
    }

    setConeInnerAngle(angle: number): void {
        this.coneInnerAngle = Math.max(0, Math.min(360, angle))
        if (this.panner) {
            this.panner.coneInnerAngle = this.coneInnerAngle
        }
    }

    getConeInnerAngle(): number {
        return this.coneInnerAngle
    }

    setConeOuterAngle(angle: number): void {
        this.coneOuterAngle = Math.max(0, Math.min(360, angle))
        if (this.panner) {
            this.panner.coneOuterAngle = this.coneOuterAngle
        }
    }

    getConeOuterAngle(): number {
        return this.coneOuterAngle
    }

    setConeOuterGain(gain: number): void {
        this.coneOuterGain = Math.max(0, Math.min(1, gain))
        if (this.panner) {
            this.panner.coneOuterGain = this.coneOuterGain
        }
    }

    getConeOuterGain(): number {
        return this.coneOuterGain
    }

    setLiteMode(enabled: boolean): void {
        if (enabled === this.liteMode) return
        this.liteMode = enabled

        // Recreate panner node with new panning model if it exists
        if (this.panner && this.ctx) {
            const oldPanner = this.panner
            const newPanner = this.ctx.createPanner()
            newPanner.panningModel = enabled ? "equalpower" : "HRTF"
            newPanner.distanceModel = this.distanceModel
            newPanner.refDistance = this.refDistance
            newPanner.maxDistance = this.maxDistance
            newPanner.rolloffFactor = this.rolloffFactor
            newPanner.coneInnerAngle = this.coneInnerAngle
            newPanner.coneOuterAngle = this.coneOuterAngle
            newPanner.coneOuterGain = this.coneOuterGain
            newPanner.positionX.value = this.position[0]
            newPanner.positionY.value = this.position[1]
            newPanner.positionZ.value = this.position[2]
            newPanner.orientationX.value = this.orientation[0]
            newPanner.orientationY.value = this.orientation[1]
            newPanner.orientationZ.value = this.orientation[2]

            // Reconnect: source → newPanner → stereoPanner → gain
            if (this.source) {
                try {
                    this.source.disconnect(oldPanner)
                } catch {
                    // Already disconnected.
                }
                this.source.connect(newPanner)
            }
            try {
                oldPanner.disconnect(this.stereoPanner!)
            } catch {
                // Already disconnected.
            }
            newPanner.connect(this.stereoPanner!)

            this.panner = newPanner
        }
    }

    isLiteMode(): boolean {
        return this.liteMode
    }

    /**
     * Get the shared AudioContext for global listener control.
     * Returns null if the context hasn't been created yet.
     * Use this to control the global listener position/orientation.
     */
    getAudioContext(): AudioContext | null {
        return this.ctx
    }
}
