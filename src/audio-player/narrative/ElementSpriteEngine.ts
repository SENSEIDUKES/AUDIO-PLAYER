import type { AudioSpriteManifest, AudioSpritePlayOptions } from "../core/audio/AudioSpriteEngine"
import { notifySprite } from "../core/audio/AudioSpriteEngine"
import { withAudioLoad } from "../core/audio/audioResources"
import { canPrimeMedia, UnlockedAudioPool } from "./mediaRouting"

function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}

let nextId = 0
interface Instance {
    element: HTMLAudioElement
    volume: number
    ready: boolean
    cleanup: () => void
    onEnded?: () => void
    fadeTimer?: ReturnType<typeof setInterval>
}

/** Bounded media-element clips. Timing follows media events, not sample boundaries. */
export class ElementSpriteEngine {
    private manifest: AudioSpriteManifest | null = null
    private preload: HTMLAudioElement | null = null
    private abort: AbortController | null = null
    private instances = new Map<string, Instance>()
    private pool = new UnlockedAudioPool(2)
    private volume = 1
    private generation = 0
    private preloadNeedsPrime = false

    constructor(
        private options: {
            crossOrigin?: "anonymous" | "use-credentials" | null
            startTimeoutMs: number
            onActiveCountChange: (count: number) => void
        }
    ) {}

    /** Load a reusable first element without reserving a playback slot. */
    async load(manifest: AudioSpriteManifest): Promise<void> {
        this.dispose()
        const generation = this.generation
        const abort = new AbortController()
        this.abort = abort
        await withAudioLoad(async () => {
            if (abort.signal.aborted) throw new DOMException("Cancelled", "AbortError")
            const element = this.createElement(manifest.src)
            this.preload = element
            this.preloadNeedsPrime = true
            await new Promise<void>((resolve, reject) => {
                const finish = (error?: Error) => {
                    clearTimeout(timer)
                    element.removeEventListener("loadeddata", ready)
                    element.removeEventListener("canplay", ready)
                    element.removeEventListener("error", failed)
                    abort.signal.removeEventListener("abort", cancelled)
                    if (error) reject(error)
                    else resolve()
                }
                const ready = () => finish()
                const failed = () => finish(new Error("Sprite media load failed"))
                const cancelled = () => finish(new DOMException("Cancelled", "AbortError"))
                const timer = setTimeout(failed, 12000)
                element.addEventListener("loadeddata", ready)
                element.addEventListener("canplay", ready)
                element.addEventListener("error", failed)
                abort.signal.addEventListener("abort", cancelled, { once: true })
                try {
                    element.load()
                    if (element.readyState >= 2) ready()
                } catch {
                    failed()
                }
            })
            if (generation !== this.generation) throw new DOMException("Cancelled", "AbortError")
            this.manifest = manifest
        }).catch((error) => {
            if (generation === this.generation) {
                this.releaseElement(this.preload)
                this.preload = null
            }
            throw error
        })
    }

    /** Take a gesture-primed element and apply request settings before assigning its source. */
    private createElement(src: string): HTMLAudioElement {
        const element = this.pool.take()
        if (this.options.crossOrigin) element.crossOrigin = this.options.crossOrigin
        element.preload = "auto"
        element.src = src
        return element
    }

    /** Prime spares on the mixer's existing activation path. */
    unlock(): void {
        this.pool.prime()
        if (this.preload && this.preloadNeedsPrime && canPrimeMedia()) {
            this.preloadNeedsPrime = false
            this.preload.load()
        }
    }

    /** Play a confirmed-seek segment with bounded start/stall recovery and cancellable loop boundaries. */
    play(clipName: string, options: AudioSpritePlayOptions = {}): string | null {
        const clip = this.manifest?.clips[clipName]
        if (
            !clip ||
            !this.manifest ||
            !Number.isFinite(clip.offset) ||
            clip.offset < 0 ||
            !Number.isFinite(clip.duration) ||
            clip.duration <= 0
        )
            return null
        const element = this.preload ?? this.createElement(this.manifest.src)
        this.preload = null
        const id = `sap-element-sprite-${++nextId}`
        const end = clip.offset + clip.duration
        const loop = options.loop ?? clip.loop ?? false
        let expires = Date.now() + this.options.startTimeoutMs
        let started = false
        let seeking = false
        let playingRequested = false
        let boundary: ReturnType<typeof setTimeout> | undefined
        let deadline: ReturnType<typeof setTimeout> | undefined
        const current = () => this.instances.get(id) === instance
        const fail = (reason: string) => {
            if (!current()) return
            this.stop(id)
            notifySprite(() => options.onError?.(reason))
        }
        const apply = () => this.applyVolume(instance)
        const onPlaying = () => {
            if (!current() || seeking) return
            if (!started && Date.now() >= expires) {
                fail("start-timeout")
                return
            }
            clearTimeout(deadline)
            deadline = undefined
            if (!started) {
                started = true
                notifySprite(() => options.onStarted?.())
            }
            scheduleBoundary()
        }
        const start = () => {
            if (!current() || playingRequested) return
            if (Date.now() >= expires) {
                fail("start-timeout")
                return
            }
            if (element.readyState < 1) return
            if (Number.isFinite(element.duration) && end > element.duration + 0.01) {
                fail("invalid-clip-range")
                return
            }
            if (!seeking && Math.abs(element.currentTime - clip.offset) > 0.01) {
                seeking = true
                element.muted = true
                try {
                    element.currentTime = clip.offset
                } catch {
                    fail("seek-failed")
                    return
                }
                // A synchronous seek is complete only when the browser is not seeking.
                if (!element.seeking && Math.abs(element.currentTime - clip.offset) <= 0.01)
                    onSeeked()
                return
            }
            if (seeking || element.seeking) return
            playingRequested = true
            instance.ready = true
            apply()
            try {
                void element.play()?.then(
                    () => {
                        if (current()) onPlaying()
                        else element.pause()
                    },
                    (error) =>
                        fail(
                            error?.name === "NotAllowedError"
                                ? "autoplay-blocked"
                                : "playback-failed"
                        )
                )
            } catch {
                fail("playback-failed")
            }
        }
        const onSeeked = () => {
            if (!current() || !seeking) return
            if (Math.abs(element.currentTime - clip.offset) > 0.05) {
                fail("seek-failed")
                return
            }
            seeking = false
            start()
        }
        const boundaryReached = (ended = false) => {
            if (!current() || !started || seeking) return
            if (!ended && element.currentTime < end - 0.005) {
                scheduleBoundary()
                return
            }
            if (!loop) {
                this.stop(id)
                return
            }
            element.muted = true
            instance.ready = false
            element.pause()
            playingRequested = false
            started = false
            expires = Date.now() + this.options.startTimeoutMs
            clearTimeout(deadline)
            deadline = setTimeout(() => fail("start-timeout"), this.options.startTimeoutMs)
            start()
        }
        const scheduleBoundary = () => {
            clearTimeout(boundary)
            if (!current() || element.paused || seeking) return
            boundary = setTimeout(
                boundaryReached,
                Math.max(
                    4,
                    ((end - element.currentTime) * 1000) / Math.max(0.01, element.playbackRate || 1)
                )
            )
        }
        const onTime = () => {
            if (element.currentTime >= end) boundaryReached()
        }
        const onEnded = () => {
            if (loop) boundaryReached(true)
            else this.stop(id)
        }
        const onError = () => fail("playback-failed")
        const onStall = () => {
            if (deadline !== undefined) return
            deadline = setTimeout(
                () => fail("playback-stalled"),
                started ? this.options.startTimeoutMs : Math.max(0, expires - Date.now())
            )
        }
        const listeners: Array<[string, () => void]> = [
            ["loadedmetadata", start],
            ["canplay", start],
            ["seeked", onSeeked],
            ["playing", onPlaying],
            ["timeupdate", onTime],
            ["ratechange", scheduleBoundary],
            ["ended", onEnded],
            ["error", onError],
            ["waiting", onStall],
            ["stalled", onStall],
        ]
        const instance: Instance = {
            element,
            ready: false,
            volume: clamp01(options.volume ?? clip.volume ?? 1),
            onEnded: options.onEnded,
            cleanup: () => {
                clearTimeout(boundary)
                clearTimeout(deadline)
                clearInterval(instance.fadeTimer)
                for (const [event, listener] of listeners)
                    element.removeEventListener(event, listener)
                this.releaseElement(element)
            },
        }
        this.instances.set(id, instance)
        notifySprite(() => this.options.onActiveCountChange(this.instances.size))
        if (!current()) return null
        for (const [event, listener] of listeners) element.addEventListener(event, listener)
        element.muted = true
        deadline = setTimeout(() => fail("start-timeout"), this.options.startTimeoutMs)
        if (element.readyState >= 1) start()
        else {
            try {
                element.load()
            } catch {
                fail("playback-failed")
            }
        }
        return current() ? id : null
    }

    /** Keep unconfirmed seeks muted and compose reader gain with the instance fade. */
    private applyVolume(instance: Instance) {
        const gain = Math.max(0, Math.min(1, this.volume * instance.volume))
        instance.element.volume = gain
        instance.element.muted = !instance.ready || gain <= 0
    }
    /** Apply the current reader level to every live instance without releasing its clip position. */
    setMasterVolume(volume: number): void {
        this.volume = clamp01(volume)
        for (const instance of this.instances.values()) this.applyVolume(instance)
    }
    /** Remove ownership before cleanup, then publish released capacity before completion observers. */
    stop(id: string): void {
        const instance = this.instances.get(id)
        if (!instance) return
        this.instances.delete(id)
        instance.cleanup()
        notifySprite(() => this.options.onActiveCountChange(this.instances.size))
        notifySprite(() => instance.onEnded?.())
    }
    /** Replace an instance fade; its timer cannot affect disposed or replaced instances. */
    fade(id: string, volume: number, durationMs: number): void {
        const instance = this.instances.get(id)
        if (!instance) return
        clearInterval(instance.fadeTimer)
        volume = clamp01(volume)
        durationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0
        const initial = instance.volume
        const start = Date.now()
        const tick = () => {
            if (this.instances.get(id) !== instance) return
            const t = durationMs <= 0 ? 1 : Math.min(1, (Date.now() - start) / durationMs)
            instance.volume = initial + (volume - initial) * t
            this.applyVolume(instance)
            if (t === 1) clearInterval(instance.fadeTimer)
        }
        if (durationMs > 0) instance.fadeTimer = setInterval(tick, 16)
        tick()
    }
    /** Stop all owned segments, including pending seeks and starts. */
    stopAll(): void {
        for (const id of [...this.instances.keys()]) this.stop(id)
    }
    /** Pause and detach one element so late play settlement cannot retain the media source. */
    private releaseElement(element: HTMLAudioElement | null) {
        if (!element) return
        element.pause()
        element.removeAttribute("src")
        element.load()
    }
    /** Cancel preload admission and active segments, then release retained media and unlock spares. */
    dispose(): void {
        ++this.generation
        this.abort?.abort()
        this.abort = null
        this.stopAll()
        this.releaseElement(this.preload)
        this.preload = null
        this.manifest = null
        this.pool.clear()
    }
}
