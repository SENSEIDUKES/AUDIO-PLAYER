/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { useAudioPlayer } from "../useAudioPlayer"
import type { AudioPlayerEngine } from "../types"

let root: Root
let container: HTMLDivElement
let engine: AudioPlayerEngine
let now: number
let frameId: number
const frames = new Map<number, FrameRequestCallback>()

function Harness({ webaudio = false }: { webaudio?: boolean }) {
    engine = useAudioPlayer({ src: "track.mp3", audioBackend: webaudio ? "webaudio" : "html5" })
    return <audio ref={engine.audioRef} src={engine.currentSrc} />
}

async function mount(webaudio = false) {
    await React.act(async () => root.render(<Harness webaudio={webaudio} />))
    return container.querySelector("audio")!
}

async function frame(time: number) {
    now = time
    const pending = [...frames.values()]
    frames.clear()
    await React.act(async () => {
        for (const callback of pending) callback(time)
    })
}

beforeEach(() => {
    now = 0
    frameId = 0
    frames.clear()
    container = document.createElement("div")
    root = createRoot(container)
    vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((callback: FrameRequestCallback) => {
            frames.set(++frameId, callback)
            return frameId
        })
    )
    vi.stubGlobal(
        "cancelAnimationFrame",
        vi.fn((id: number) => frames.delete(id))
    )
    vi.spyOn(performance, "now").mockImplementation(() => now)
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
        this: HTMLMediaElement
    ) {
        this.dispatchEvent(new Event("pause"))
    })
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
        this: HTMLMediaElement
    ) {
        this.dispatchEvent(new Event("play"))
        return Promise.resolve()
    })
})

afterEach(async () => {
    await React.act(async () => root.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("volume and independent fade gain", () => {
    it("ignores non-finite slider input and clamps finite values", async () => {
        const audio = await mount()
        await React.act(async () => engine.setVolume(0.6))
        for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            await React.act(async () => engine.setVolume(invalid))
            expect(engine.volume).toBe(0.6)
            expect(audio.volume).toBe(0.6)
        }
        await React.act(async () => engine.setVolume(2))
        expect(engine.volume).toBe(1)
        await React.act(async () => engine.setVolume(-2))
        expect(engine.volume).toBe(0)
    })

    it("fades independently of the slider and composes with changing host mixer gain", async () => {
        const audio = await mount()
        await React.act(async () => {
            engine.setVolume(0.6)
            engine.fade(0, 1000)
        })
        await frame(500)
        expect(audio.volume).toBeCloseTo(0.3)
        expect(engine.volume).toBe(0.6)
        await React.act(async () => engine.setOutputGain?.(0.5))
        expect(audio.volume).toBeCloseTo(0.15)
        await frame(1000)
        expect(audio.muted).toBe(true)
        expect(engine.volume).toBe(0.6)
        expect(engine.isMuted).toBe(false)
        await React.act(async () => engine.fade(1, 1000))
        await frame(1500)
        expect(audio.volume).toBeCloseTo(0.15)
        await frame(2000)
        expect(audio.volume).toBeCloseTo(0.3)
        expect(audio.muted).toBe(false)
        expect(engine.volume).toBe(0.6)
    })

    it("preserves the saved level for zero-volume unmute after a fade", async () => {
        const audio = await mount()
        await React.act(async () => {
            engine.setVolume(0.8)
            engine.fade(0, 0)
        })
        expect(engine.volume).toBe(0.8)
        expect(audio.volume).toBe(0)
        await React.act(async () => engine.setVolume(0))
        await React.act(async () => engine.toggleMute())
        await React.act(async () => engine.toggleMute())
        expect(engine.volume).toBe(0.8)
        expect(audio.volume).toBe(0.8)
        expect(engine.isMuted).toBe(false)
    })

    it("cancels an old fade on manual volume changes while retaining the host gate", async () => {
        const audio = await mount()
        await React.act(async () => {
            engine.setVolume(0.6)
            engine.setOutputGain?.(0.5)
            engine.fade(0, 1000)
        })
        await frame(500)
        await React.act(async () => engine.setVolume(0.4))
        await frame(1000)
        expect(engine.volume).toBe(0.4)
        expect(audio.volume).toBeCloseTo(0.2)
        expect(frames.size).toBe(0)
    })

    it("ignores non-finite fade inputs without interrupting a valid fade", async () => {
        const audio = await mount()
        await React.act(async () => {
            engine.setVolume(0.6)
            engine.fade(0, 1000)
            engine.fade(Number.NaN, 200)
            engine.fade(1, Number.POSITIVE_INFINITY)
            engine.setVolume(Number.NaN)
        })
        await frame(500)
        expect(engine.volume).toBe(0.6)
        expect(audio.volume).toBeCloseTo(0.3)
        await React.act(async () => engine.fade(2, 0))
        expect(audio.volume).toBe(0.6)
        expect(frames.size).toBe(0)
    })

    it("continues receiving hook events and preserves settings after runtime fallback", async () => {
        vi.stubGlobal(
            "AudioContext",
            vi.fn(function () {
                throw new Error("Context denied")
            })
        )
        vi.spyOn(console, "warn").mockImplementation(() => {})
        const audio = await mount(true)
        await React.act(async () => {
            engine.setVolume(0.6)
            engine.setPlaybackRate(1.75)
            engine.setOutputGain?.(0.5)
            engine.play()
        })
        expect(engine.getBackendInfo()).toMatchObject({ active: "html5", didFallback: true })
        expect(engine.isPlaying).toBe(true)
        expect(engine.hasError).toBe(false)
        expect(audio.volume).toBeCloseTo(0.3)
        expect(audio.playbackRate).toBe(1.75)
        await React.act(async () => engine.pause())
        expect(engine.isPlaying).toBe(false)
        await React.act(async () => engine.play())
        expect(engine.isPlaying).toBe(true)
    })
})
