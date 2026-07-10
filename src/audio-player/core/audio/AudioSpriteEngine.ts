function getAudioContextCtor(): typeof AudioContext | undefined {
    if (typeof window === "undefined") return undefined
    return (
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
    )
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 1
    return Math.max(0, Math.min(1, value))
}

function positiveSeconds(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, value)
}

export type AudioSpriteInstanceId = string

export interface AudioSpriteClipDefinition {
    /** Clip start within the decoded pack, in seconds. */
    offset: number
    /** Clip duration in seconds. */
    duration: number
    /** Default loop behavior for this clip. Can be overridden per play(). */
    loop?: boolean
    /** Default playback volume for this clip. Can be overridden per play(). */
    volume?: number
}

export interface AudioSpriteManifest {
    /** Single audio file containing every named clip. */
    src: string
    /** Named clips addressed by plugin/Vault Radio callers. */
    clips: Record<string, AudioSpriteClipDefinition>
}

export interface AudioSpritePlayOptions {
    volume?: number
    loop?: boolean
}

export interface AudioSpriteInstanceInfo {
    id: AudioSpriteInstanceId
    clipName: string
    loop: boolean
    volume: number
}

type AudioSpriteInstance = AudioSpriteInstanceInfo & {
    source: AudioBufferSourceNode
    gain: GainNode
    /** Pending stop scheduled by `fadeOut`, cleared if the instance is retargeted. */
    fadeStopTimer?: ReturnType<typeof setTimeout>
}

let nextInstanceId = 0

function createInstanceId(): AudioSpriteInstanceId {
    nextInstanceId += 1
    return `sap-sprite-${nextInstanceId}`
}

/**
 * SAP-native audio sprite engine for short Vault Radio / plugin-layer sounds.
 *
 * This intentionally does not replace the player's track playback backend. It
 * decodes one declared pack and lets trusted SAP plugin surfaces trigger named
 * slices through Web Audio (`AudioBufferSourceNode.start(when, offset, duration)`).
 */
export class AudioSpriteEngine {
    private ctx: AudioContext | null = null
    private output: GainNode | null = null
    private manifest: AudioSpriteManifest | null = null
    private buffer: AudioBuffer | null = null
    private loadAbort: AbortController | null = null
    private loadPromise: Promise<void> | null = null
    private instances = new Map<AudioSpriteInstanceId, AudioSpriteInstance>()
    private generation = 0
    /**
     * Desired master gain for the whole sprite layer (the "ambience volume"
     * control points here). Stored so it survives context recreation, since
     * `ensureContext` builds a fresh `output` GainNode at unity otherwise.
     */
    private masterVolume = 1
    /** Removes the armed unlock-gesture listeners, when armed. */
    private disarmGestureResume: (() => void) | null = null

    private ensureContext(): AudioContext {
        if (this.ctx && this.ctx.state !== "closed") return this.ctx
        const Ctor = getAudioContextCtor()
        if (!Ctor) throw new Error("Web Audio API unavailable for SAP sprites.")
        this.ctx = new Ctor()
        this.output = this.ctx.createGain()
        this.output.gain.value = this.masterVolume
        this.output.connect(this.ctx.destination)
        return this.ctx
    }

    /**
     * Resume a context that autoplay policy left suspended on the next user
     * gesture. Ambience/FX are typically started from lifecycle code (scene
     * changes), where `resume()` is silently rejected — sources scheduled on
     * the suspended timeline then never make a sound. Buffer sources started
     * while suspended begin playing when the context resumes, so one resume on
     * the first real interaction un-silences the whole layer.
     */
    private armGestureResume(): void {
        if (this.disarmGestureResume) return
        if (typeof document === "undefined") return
        // Disposed or closed engines must not (re)attach document listeners.
        if (!this.ctx || this.ctx.state === "closed") return
        const gestures = ["pointerdown", "keydown", "touchend"] as const
        const resume = () => {
            disarm()
            const ctx = this.ctx
            if (!ctx || ctx.state !== "suspended") return
            void ctx.resume().then(
                () => {
                    // A stale callback from a replaced/disposed context must
                    // not re-arm against the live engine.
                    if (ctx !== this.ctx) return
                    if (this.ctx.state === "suspended") this.armGestureResume()
                },
                () => {
                    if (ctx !== this.ctx) return
                    this.armGestureResume()
                }
            )
        }
        const disarm = () => {
            this.disarmGestureResume = null
            for (const type of gestures) {
                document.removeEventListener(type, resume, true)
            }
        }
        this.disarmGestureResume = disarm
        for (const type of gestures) {
            document.addEventListener(type, resume, {
                capture: true,
                passive: true,
            })
        }
    }

    /**
     * Set the master output level (0..1) for the whole sprite layer. Persisted
     * across context recreation so a later (re)load doesn't silently reset it.
     */
    setMasterVolume(value: number): void {
        this.masterVolume = clamp01(value)
        if (this.output && this.ctx) {
            this.output.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime)
        }
    }

    getMasterVolume(): number {
        return this.masterVolume
    }

    async load(manifest: AudioSpriteManifest): Promise<void> {
        const src = manifest.src.trim()
        if (!src) throw new Error("Audio sprite manifest requires a src URL.")

        this.generation += 1
        const generation = this.generation
        this.loadAbort?.abort()
        this.stopAll()
        this.manifest = { ...manifest, src }
        this.buffer = null

        const abort = new AbortController()
        this.loadAbort = abort
        const work = (async () => {
            const response = await fetch(src, { signal: abort.signal })
            if (!response.ok) {
                throw new Error(`Audio sprite pack failed to load: ${response.status}`)
            }
            const data = await response.arrayBuffer()
            const decoded = await this.ensureContext().decodeAudioData(data)
            if (generation !== this.generation) return
            this.buffer = decoded
        })()

        // `ready()` and any internal awaiters consume a never-rejecting view of
        // the load: an aborted/failed load (e.g. a superseding `load()` call, or
        // a bad URL) must not surface as an unhandled promise rejection. Direct
        // `load()` callers still see the real error below.
        this.loadPromise = work.then(
            () => {},
            () => {}
        )

        try {
            await work
        } finally {
            if (this.loadAbort === abort) this.loadAbort = null
        }
    }

    async ready(): Promise<void> {
        // Resolves once the latest in-flight load settles; never rejects (see
        // `load`). A superseding `load()` aborts the one we're awaiting (its
        // error is swallowed), so follow the chain to the newest promise rather
        // than resolving early while a fresh buffer is still decoding.
        let pending = this.loadPromise
        while (pending) {
            await pending
            if (pending === this.loadPromise) break
            pending = this.loadPromise
        }
    }

    play(
        clipName: string,
        options: AudioSpritePlayOptions = {}
    ): AudioSpriteInstanceId | null {
        const manifest = this.manifest
        const buffer = this.buffer
        if (!manifest || !buffer) return null

        const clip = manifest.clips[clipName]
        if (!clip) return null

        const ctx = this.ensureContext()
        void ctx.resume().then(
            () => {
                // Ignore stale callbacks from a replaced/disposed context.
                if (ctx !== this.ctx) return
                // Chrome resolves resume() while leaving the context suspended
                // when there has been no user gesture yet; recover on the first
                // real interaction instead of playing into a frozen timeline.
                if (ctx.state === "suspended") this.armGestureResume()
            },
            () => {
                if (ctx !== this.ctx) return
                this.armGestureResume()
            }
        )
        const output = this.output
        if (!output) return null

        const offset = Math.min(positiveSeconds(clip.offset), buffer.duration)
        const duration = Math.min(
            positiveSeconds(clip.duration),
            Math.max(0, buffer.duration - offset)
        )
        if (duration <= 0) return null

        const loop = options.loop ?? clip.loop ?? false
        const volume = clamp01(options.volume ?? clip.volume ?? 1)
        const id = createInstanceId()
        const source = ctx.createBufferSource()
        const gain = ctx.createGain()

        source.buffer = buffer
        source.loop = loop
        if (loop) {
            source.loopStart = offset
            source.loopEnd = offset + duration
        }
        gain.gain.setValueAtTime(volume, ctx.currentTime)
        source.connect(gain)
        gain.connect(output)

        const instance: AudioSpriteInstance = {
            id,
            clipName,
            loop,
            volume,
            source,
            gain,
        }
        this.instances.set(id, instance)
        source.onended = () => {
            if (this.instances.get(id) === instance) this.removeInstance(id)
        }
        source.start(0, offset, loop ? undefined : duration)
        return id
    }

    stop(id: AudioSpriteInstanceId): void {
        const instance = this.instances.get(id)
        if (!instance) return
        instance.source.onended = null
        try {
            instance.source.stop()
        } catch {}
        this.removeInstance(id)
    }

    fade(id: AudioSpriteInstanceId, toVolume: number, durationMs: number): void {
        const instance = this.instances.get(id)
        if (!instance || !this.ctx) return
        // Retargeting the gain cancels any pending fade-out stop: the caller
        // wants this instance to keep playing at the new level.
        this.clearFadeStop(instance)
        const gain = instance.gain.gain
        const now = this.ctx.currentTime
        const duration = Math.max(0, durationMs) / 1000
        const target = clamp01(toVolume)
        gain.cancelScheduledValues(now)
        gain.setValueAtTime(gain.value, now)
        gain.linearRampToValueAtTime(target, now + duration)
        instance.volume = target
    }

    /**
     * Ramp an instance to silence and then stop it. Unlike `fade(id, 0, ms)`,
     * this releases the underlying source when the ramp completes — essential
     * for looping clips, which otherwise keep running silently forever (a leak
     * that accumulates one node per ambience/mood crossfade).
     */
    fadeOut(id: AudioSpriteInstanceId, durationMs: number): void {
        const instance = this.instances.get(id)
        if (!instance) return
        this.fade(id, 0, durationMs)
        const delay = Math.max(0, durationMs)
        instance.fadeStopTimer = setTimeout(() => {
            // Only stop if this exact instance is still live for the id (a
            // re-trigger of the same id would have replaced/cleared it).
            if (this.instances.get(id) === instance) this.stop(id)
        }, delay)
    }

    private clearFadeStop(instance: AudioSpriteInstance): void {
        if (instance.fadeStopTimer !== undefined) {
            clearTimeout(instance.fadeStopTimer)
            instance.fadeStopTimer = undefined
        }
    }

    stopAll(): void {
        for (const id of [...this.instances.keys()]) this.stop(id)
    }

    getActiveInstances(): AudioSpriteInstanceInfo[] {
        return [...this.instances.values()].map(({ id, clipName, loop, volume }) => ({
            id,
            clipName,
            loop,
            volume,
        }))
    }

    dispose(): void {
        this.generation += 1
        this.disarmGestureResume?.()
        this.loadAbort?.abort()
        this.loadAbort = null
        this.loadPromise = null
        this.stopAll()
        this.output?.disconnect()
        this.output = null
        this.buffer = null
        this.manifest = null
        if (this.ctx && this.ctx.state !== "closed") {
            void this.ctx.close().catch(() => {})
        }
        this.ctx = null
    }

    private removeInstance(id: AudioSpriteInstanceId): void {
        const instance = this.instances.get(id)
        if (!instance) return
        this.clearFadeStop(instance)
        this.instances.delete(id)
        try {
            instance.source.disconnect()
        } catch {}
        try {
            instance.gain.disconnect()
        } catch {}
    }
}

export function createAudioSpriteEngine(): AudioSpriteEngine {
    return new AudioSpriteEngine()
}
