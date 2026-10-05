import type { MediaGainSink, MediaGainSinkFactory } from "./mediaRouting"
import { retainAudioContext, type AudioContextLease } from "../core/audio/sharedAudioContext"

/** Short smoothing so slider moves and fade ticks never click. */
const SMOOTHING_SECONDS = 0.015

export function getAudioContextCtor(): typeof AudioContext | undefined {
    if (typeof window === "undefined") return undefined
    return (
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    )
}

/**
 * Whether this browser honors `HTMLMediaElement.volume` writes. iOS Safari
 * keeps every element at full volume and reads back 1. Without `Audio` (a
 * server render) the answer is unknown, so it is reported as supported.
 */
export function probeElementVolumeWrites(): boolean {
    if (typeof Audio === "undefined") return true
    try {
        const probe = new Audio()
        probe.volume = 0.5
        return Math.abs(probe.volume - 0.5) < 0.01
    } catch {
        return false
    }
}

type AudioSessionLike = { type: string }
const sessionOwners = new WeakMap<
    AudioSessionLike,
    { previous: string; owners: Map<object, string> }
>()

function getAudioSession(): AudioSessionLike | null {
    if (typeof navigator === "undefined") return null
    const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession
    return session && typeof session === "object" ? session : null
}

/**
 * Set Safari's Audio Session type, returning a function that restores the
 * previous value. `"playback"` keeps Web Audio audible when the iPhone
 * ring/silent switch is on silent; plain media elements already are.
 */
export function applyAudioSessionType(type: string | null | undefined): () => void {
    if (!type) return () => {}
    const session = getAudioSession()
    if (!session) return () => {}
    let entry = sessionOwners.get(session)
    const owner = {}
    try {
        if (!entry) entry = { previous: session.type, owners: new Map() }
        session.type = type
    } catch {
        return () => {}
    }
    entry.owners.set(owner, type)
    sessionOwners.set(session, entry)
    return () => {
        if (!entry.owners.has(owner)) return
        const before = [...entry.owners.values()]
        const currentType = before[before.length - 1]
        entry.owners.delete(owner)
        const remaining = [...entry.owners.values()]
        const nextType = remaining[remaining.length - 1] ?? entry.previous
        if (entry.owners.size === 0) sessionOwners.delete(session)
        try {
            if (session.type === currentType) session.type = nextType
        } catch {
            // Restoring is best effort.
        }
    }
}

/**
 * One Web Audio graph for several independent layers:
 *
 *     element → MediaElementAudioSourceNode → element gain → layer bus → limiter → destination
 *
 * The element gain carries an engine's per-element value (fade curve and
 * per-call volume); the layer bus carries the reader's layer level. Both work
 * on browsers that ignore `HTMLMediaElement.volume`.
 */
export class LayerGainGraph<Layer extends string> {
    private readonly ctx: AudioContext
    private readonly buses = new Map<Layer, GainNode>()
    private readonly lease: AudioContextLease
    private readonly limiter: DynamicsCompressorNode
    private readonly routes = new WeakMap<
        HTMLAudioElement,
        { source: MediaElementAudioSourceNode; gain: GainNode }
    >()
    private closed = false

    constructor(Ctor: typeof AudioContext, layers: readonly Layer[]) {
        this.lease = retainAudioContext(Ctor)
        this.ctx = this.lease.context
        let limiter: DynamicsCompressorNode | undefined
        try {
            limiter = this.ctx.createDynamicsCompressor()
            this.limiter = limiter
            limiter.threshold.value = -1
            limiter.knee.value = 0
            limiter.ratio.value = 20
            limiter.attack.value = 0.001
            limiter.release.value = 0.1
            limiter.connect(this.ctx.destination)
            for (const layer of layers) {
                const bus = this.ctx.createGain()
                this.buses.set(layer, bus)
                bus.connect(limiter)
            }
        } catch (error) {
            for (const bus of this.buses.values()) {
                try {
                    bus.disconnect()
                } catch {
                    /* Best effort after partial construction. */
                }
            }
            try {
                limiter?.disconnect()
            } catch {
                /* Best effort. */
            }
            this.lease.release()
            throw error
        }
    }

    get state(): AudioContextState | "interrupted" {
        return this.closed ? "closed" : (this.ctx.state as AudioContextState | "interrupted")
    }

    /** Listen for the context starting or suspending. Returns an unsubscribe. */
    onStateChange(listener: () => void): () => void {
        try {
            this.ctx.addEventListener("statechange", listener)
        } catch {
            return () => {}
        }
        return () => {
            try {
                this.ctx.removeEventListener("statechange", listener)
            } catch {
                // Context already gone.
            }
        }
    }

    /** Gain sinks for one layer's engine. */
    sinkFactory(layer: Layer): MediaGainSinkFactory {
        return (element) => {
            const bus = this.buses.get(layer)
            if (!bus || this.closed) return null
            // Media elements can be captured once only, even after disconnect.
            let route = this.routes.get(element)
            if (!route) {
                route = {
                    source: this.ctx.createMediaElementSource(element),
                    gain: this.ctx.createGain(),
                }
                this.routes.set(element, route)
            }
            const { source, gain } = route
            gain.gain.value = 0
            source.connect(gain)
            gain.connect(bus)
            const sink: MediaGainSink = {
                setGain: (value) => this.setParam(gain.gain, value),
                dispose: () => {
                    try {
                        source.disconnect()
                        gain.disconnect()
                    } catch {
                        // Already disconnected.
                    }
                },
            }
            return sink
        }
    }

    setLayerGain(layer: Layer, value: number): void {
        const bus = this.buses.get(layer)
        if (bus) this.setParam(bus.gain, value)
    }

    getLayerGain(layer: Layer): number {
        return this.buses.get(layer)?.gain.value ?? 0
    }

    /** Start (or restart) the context. Call from a user gesture on iOS. */
    resume(fromActivation = false): void {
        void this.lease.setActive(true, fromActivation).catch(() => {})
    }

    /** Stop the render thread while idle or hidden. */
    suspend(): void {
        void this.lease.setActive(false).catch(() => {})
    }

    close(): void {
        if (this.closed) return
        this.closed = true
        for (const bus of this.buses.values()) {
            try {
                bus.disconnect()
            } catch {
                // Already disconnected.
            }
        }
        this.lease.release()
        this.limiter.disconnect()
    }

    private setParam(param: AudioParam, value: number): void {
        const target = Number.isFinite(value) ? Math.max(0, value) : 0
        if (this.closed) return
        try {
            if (this.ctx.state === "running") {
                const now = this.ctx.currentTime
                param.cancelScheduledValues(now)
                param.setTargetAtTime(target, now, SMOOTHING_SECONDS)
            } else {
                param.value = target
            }
        } catch {
            param.value = target
        }
    }
}
