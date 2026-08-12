import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioSpriteEngine } from "../AudioSpriteEngine"

class FakeAudioParam {
    value = 1
    setValueAtTime = vi.fn((value: number) => {
        this.value = value
        return this
    })
    cancelScheduledValues = vi.fn(() => this)
    linearRampToValueAtTime = vi.fn((value: number) => {
        this.value = value
        return this
    })
}

class FakeGainNode {
    gain = new FakeAudioParam()
    connect = vi.fn()
    disconnect = vi.fn()
}

class FakeBufferSourceNode {
    buffer: AudioBuffer | null = null
    loop = false
    loopStart = 0
    loopEnd = 0
    onended: (() => void) | null = null
    connect = vi.fn()
    disconnect = vi.fn()
    start = vi.fn()
    stop = vi.fn()
}

class FakeAudioContext {
    state: AudioContextState = "running"
    currentTime = 10
    destination = {}
    sources: FakeBufferSourceNode[] = []
    gains: FakeGainNode[] = []
    buffer = { duration: 5 } as AudioBuffer
    createGain = vi.fn(() => {
        const gain = new FakeGainNode()
        this.gains.push(gain)
        return gain as unknown as GainNode
    })
    createBufferSource = vi.fn(() => {
        const source = new FakeBufferSourceNode()
        this.sources.push(source)
        return source as unknown as AudioBufferSourceNode
    })
    decodeAudioData = vi.fn(async () => this.buffer)
    resume = vi.fn(async () => undefined)
    close = vi.fn(async () => undefined)
}

describe("AudioSpriteEngine", () => {
    let context: FakeAudioContext

    beforeEach(() => {
        context = new FakeAudioContext()
        ;(globalThis as any).window = {
            AudioContext: vi.fn(function AudioContextMock() {
                return context
            }),
        }
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
        })) as unknown as typeof fetch
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete (globalThis as any).window
    })

    it("loads one pack and plays named clips by offset and duration", async () => {
        const engine = new AudioSpriteEngine()

        await engine.load({
            src: "/sprites/vault-radio.mp3",
            clips: { ping: { offset: 1.25, duration: 0.5, volume: 0.4 } },
        })
        const id = engine.play("ping")

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(id).toMatch(/^sap-sprite-/)
        expect(context.sources[0].start).toHaveBeenCalledWith(0, 1.25, 0.5)
        expect(context.gains[1].gain.setValueAtTime).toHaveBeenCalledWith(0.4, 10)
    })

    it("returns ids that can stop and fade individual instances", async () => {
        const engine = new AudioSpriteEngine()
        await engine.load({
            src: "/sprites/vault-radio.mp3",
            clips: { click: { offset: 0, duration: 1 } },
        })

        const id = engine.play("click")!
        engine.fade(id, 0, 250)
        engine.stop(id)

        expect(context.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.25)
        expect(context.sources[0].stop).toHaveBeenCalledTimes(1)
        expect(engine.getActiveInstances()).toEqual([])
    })

    it("configures loop boundaries for looping clips", async () => {
        const engine = new AudioSpriteEngine()
        await engine.load({
            src: "/sprites/vault-radio.mp3",
            clips: { bed: { offset: 2, duration: 1.5, loop: true } },
        })

        const id = engine.play("bed")

        expect(id).not.toBeNull()
        expect(context.sources[0].loop).toBe(true)
        expect(context.sources[0].loopStart).toBe(2)
        expect(context.sources[0].loopEnd).toBe(3.5)
        expect(context.sources[0].start).toHaveBeenCalledWith(0, 2, undefined)
    })

    it("fadeOut ramps to zero then stops the (looping) instance", async () => {
        vi.useFakeTimers()
        const engine = new AudioSpriteEngine()
        await engine.load({
            src: "/sprites/ambience.mp3",
            clips: { bed: { offset: 0, duration: 2, loop: true } },
        })

        const id = engine.play("bed")!
        engine.fadeOut(id, 300)

        // Ramps to silence immediately, but the source is still alive mid-fade.
        expect(context.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.3)
        expect(engine.getActiveInstances()).toHaveLength(1)

        // Only once the ramp completes is the looping source released (no leak).
        vi.advanceTimersByTime(300)
        expect(context.sources[0].stop).toHaveBeenCalledTimes(1)
        expect(engine.getActiveInstances()).toEqual([])
        vi.useRealTimers()
    })

    it("re-targeting an instance with fade cancels a pending fadeOut stop", async () => {
        vi.useFakeTimers()
        const engine = new AudioSpriteEngine()
        await engine.load({
            src: "/sprites/ambience.mp3",
            clips: { bed: { offset: 0, duration: 2, loop: true } },
        })

        const id = engine.play("bed")!
        engine.fadeOut(id, 300)
        engine.fade(id, 0.8, 100) // duck back up before the stop fires

        vi.advanceTimersByTime(300)
        expect(context.sources[0].stop).not.toHaveBeenCalled()
        expect(engine.getActiveInstances()).toHaveLength(1)
        vi.useRealTimers()
    })

    it("applies and persists master volume across context recreation", async () => {
        const engine = new AudioSpriteEngine()
        // Set before any context exists — it must survive the lazy creation.
        engine.setMasterVolume(0.3)
        await engine.load({
            src: "/sprites/ambience.mp3",
            clips: { a: { offset: 0, duration: 1 } },
        })

        // The output gain is the first gain the context creates.
        expect(context.gains[0].gain.value).toBe(0.3)
        expect(engine.getMasterVolume()).toBe(0.3)

        engine.setMasterVolume(0.5)
        expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.5, 10)
    })

    it("surfaces load failures to direct callers but never rejects ready()", async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            status: 500,
        })) as unknown as typeof fetch

        const engine = new AudioSpriteEngine()
        await expect(engine.load({ src: "/sprites/missing.mp3", clips: {} })).rejects.toThrow()
        // ready() consumes a never-rejecting view, so no unhandled rejection.
        await expect(engine.ready()).resolves.toBeUndefined()
    })
})
