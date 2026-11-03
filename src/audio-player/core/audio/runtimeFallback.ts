import type { RefObject } from "react"
import type { AudioBackend, AudioBackendEvent } from "./AudioBackend"
import { AudioContextUnavailableError, type WebAudioBackend } from "./WebAudioBackend"

/** Keep backend identity and subscriptions stable across a one-way runtime fallback. */
export function withRuntimeFallback(
    initial: WebAudioBackend,
    audioRef: RefObject<HTMLAudioElement | null>,
    createFallback: (reason: string) => AudioBackend
): AudioBackend {
    let active: AudioBackend = initial
    let source: string | null = null
    let loop = false
    let outputGain = 1
    let generation = 0
    let restoreAt: number | null = null
    const listeners = new Map<AudioBackendEvent, Set<() => void>>()
    const forwarders = new Map<AudioBackendEvent, () => void>()
    const methods = new Map<PropertyKey, (...args: unknown[]) => unknown>()
    const assertCurrent = (token: number) => {
        if (token !== generation) {
            throw new DOMException("Playback cancelled during backend fallback.", "AbortError")
        }
    }

    const switchBackend = (reason: string): boolean => {
        if (active.kind !== "webaudio" || !audioRef.current) return false
        const previous = active
        const volume = previous.getVolume()
        const muted = previous.isMuted()
        const rate = previous.getRate()
        const position = previous.getCurrentTime()
        for (const [event, forward] of forwarders) previous.removeEventListener(event, forward)
        previous.destroy()
        active = createFallback(reason)
        active.setVolume(volume)
        active.setMuted(muted)
        active.setRate(rate)
        active.setOutputGain?.(outputGain)
        active.setLoop(loop)
        active.setSource(source)
        restoreAt = Number.isFinite(position) && position > 0 ? position : null
        for (const [event, forward] of forwarders) active.addEventListener(event, forward)
        active.load()
        return true
    }

    const subscribe = (event: AudioBackendEvent) => {
        if (forwarders.has(event)) return
        const forward = () => {
            if (
                event === "error" &&
                active.getError() === "backend-unavailable" &&
                switchBackend("Web Audio context creation failed while loading.")
            )
                return
            if (event === "loadedmetadata" && restoreAt !== null) {
                const position = restoreAt
                restoreAt = null
                const duration = active.getDuration()
                active.setCurrentTime(
                    Number.isFinite(duration) && duration > 0
                        ? Math.min(position, duration)
                        : position
                )
            }
            for (const handler of Array.from(listeners.get(event) ?? [])) handler()
        }
        forwarders.set(event, forward)
        active.addEventListener(event, forward)
    }
    subscribe("error")
    subscribe("loadedmetadata")

    const overrides = {
        setSource(src: string | null) {
            generation += 1
            source = src?.trim() || null
            restoreAt = null
            active.setSource(source)
        },
        clearSource() {
            generation += 1
            source = null
            restoreAt = null
            active.clearSource()
        },
        load() {
            generation += 1
            active.load()
        },
        async play() {
            const token = ++generation
            const backend = active
            try {
                await backend.play()
            } catch (error) {
                assertCurrent(token)
                if (
                    backend === active &&
                    !(error instanceof AudioContextUnavailableError && switchBackend(error.message))
                ) {
                    throw error
                }
                // Switching calls load(), whose synchronous listeners may pause or replace the source.
                assertCurrent(token)
                await active.play()
            }
            assertCurrent(token)
        },
        pause() {
            generation += 1
            active.pause()
        },
        setCurrentTime(seconds: number) {
            restoreAt = null
            active.setCurrentTime(seconds)
        },
        setLoop(value: boolean) {
            loop = value
            active.setLoop(value)
        },
        setOutputGain(value: number) {
            outputGain = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
            active.setOutputGain?.(outputGain)
        },
        addEventListener(event: AudioBackendEvent, handler: () => void) {
            let handlers = listeners.get(event)
            if (!handlers) {
                handlers = new Set()
                listeners.set(event, handlers)
            }
            handlers.add(handler)
            subscribe(event)
        },
        removeEventListener(event: AudioBackendEvent, handler: () => void) {
            listeners.get(event)?.delete(handler)
        },
        destroy() {
            generation += 1
            restoreAt = null
            active.destroy()
        },
    } satisfies Partial<AudioBackend>

    // Forward the full advanced contract, including spatial controls, to the
    // active implementation at call time, including methods retained by a host.
    return new Proxy(initial, {
        get(_target, key) {
            if (Object.prototype.hasOwnProperty.call(overrides, key))
                return Reflect.get(overrides, key)
            const value: unknown = Reflect.get(active, key)
            if (typeof value !== "function") return value
            let method = methods.get(key)
            if (!method) {
                method = (...args: unknown[]) => {
                    const current: unknown = Reflect.get(active, key)
                    return typeof current === "function"
                        ? Reflect.apply(current, active, args)
                        : undefined
                }
                methods.set(key, method)
            }
            return method
        },
    })
}
