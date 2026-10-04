// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HTML5AudioBackend } from "../HTML5AudioBackend"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../WebAudioBackend"
import { sharedAudioBufferCache } from "../audioCaches"
import { FakeAudio, FakeAudioContext } from "../../../narrative/__tests__/fakeMedia"

beforeEach(() => {
    FakeAudio.reset()
    FakeAudioContext.instances = []
})
afterEach(() => {
    vi.unstubAllGlobals()
    sharedAudioBufferCache.clear()
})

describe("independent mixer output gain", () => {
    it("gates HTML5 output while preserving user volume and mute", () => {
        const audio = new Audio()
        const backend = new HTML5AudioBackend({ current: audio })
        backend.setVolume(0.6)
        backend.setOutputGain(0)
        expect(audio.muted).toBe(true)
        expect(backend.getVolume()).toBe(0.6)
        expect(backend.isMuted()).toBe(false)
        backend.setVolume(0.3)
        backend.setMuted(true)
        backend.setOutputGain(1)
        expect(audio.volume).toBe(0.3)
        expect(audio.muted).toBe(true)
        backend.setMuted(false)
        expect(audio.muted).toBe(false)
        backend.setOutputGain(0.5)
        expect(audio.volume).toBe(0.15)
        expect(backend.getVolume()).toBe(0.3)
        backend.setOutputGain(Number.NaN)
        expect(audio.muted).toBe(true)
    })

    it("keeps mute gating on browsers that ignore element volume writes", () => {
        FakeAudio.volumeLocked = true
        const audio = new FakeAudio()
        const backend = new HTML5AudioBackend({ current: audio as unknown as HTMLAudioElement })
        backend.setVolume(0.6)
        expect(backend.getVolume()).toBe(1)
        backend.setOutputGain(0)
        expect(audio.muted).toBe(true)
        expect(backend.isMuted()).toBe(false)
        backend.setMuted(false)
        expect(audio.muted).toBe(true)
        backend.setOutputGain(1)
        expect(audio.muted).toBe(false)
    })

    it("applies Web Audio gain before load and across source changes and user mute", async () => {
        vi.stubGlobal("AudioContext", FakeAudioContext)
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(4),
            }))
        )
        const backend = new WebAudioBackend({
            requested: "webaudio",
            active: "webaudio",
            didFallback: false,
            capabilities: WEBAUDIO_CAPABILITIES,
        })
        try {
            backend.setVolume(0.6)
            backend.setOutputGain(0)
            backend.setSource("tts-a.mp3")
            await backend.play()
            const gain = FakeAudioContext.instances[0].buses()[0].gain
            expect(gain.value).toBe(0)
            expect(backend.getVolume()).toBe(0.6)
            expect(backend.isMuted()).toBe(false)
            backend.setOutputGain(1)
            expect(gain.value).toBe(0.6)
            backend.setMuted(true)
            backend.setSource("tts-b.mp3")
            await backend.play()
            expect(gain.value).toBe(0)
            backend.setOutputGain(0.5)
            backend.setMuted(false)
            expect(gain.value).toBe(0.3)
            backend.setVolume(0.2)
            expect(gain.value).toBe(0.1)
        } finally {
            backend.destroy()
        }
    })
})
