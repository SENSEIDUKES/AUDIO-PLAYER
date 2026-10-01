import type { MediaGainSink, MediaGainSinkFactory } from "./mediaRouting"

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
    let previous: string
    try {
        previous = session.type
        session.type = type
    } catch {
        return () => {}
    }
    return () => {
        try {
            if (session.type === type) session.type = previous
        } catch {
            // Restoring is best effort.
        }
    }
}

/**
 * One Web Audio graph for several independent layers:
 *
 *     element → MediaElementAudioSourceNode → element gain → layer bus → destination
 *
 * The element gain carries an engine's per-element value (fade curve and
 * per-call volume); the layer bus carries the reader's layer level. Both work
 * on browsers that ignore `HTMLMediaElement.volume`.
 */
export class LayerGainGraph<Layer extends string> {
    private readonly ctx: AudioContext
    private readonly buses = new Map<Layer, GainNode>()
    private closed = false

    constructor(Ctor: typeof AudioContext, layers: readonly Layer[]) {
        this.ctx = new Ctor()
        for (const layer of layers) {
            const bus = this.ctx.createGain()
            bus.connect(this.ctx.destination)
            this.buses.set(layer, bus)
        }
    }

    get state(): AudioContextState | "closed" {
        return this.closed ? "closed" : this.ctx.state
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
            const source = this.ctx.createMediaElementSource(element)
            const gain = this.ctx.createGain()
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
    resume(): void {
        if (this.closed || this.ctx.state === "running") return
        try {
            void Promise.resolve(this.ctx.resume()).catch(() => {})
        } catch {
            // Resume is retried on the next gesture.
        }
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
        try {
            void Promise.resolve(this.ctx.close()).catch(() => {})
        } catch {
            // Closing is best effort.
        }
    }

    private setParam(param: AudioParam, value: number): void {
        const target = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
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
