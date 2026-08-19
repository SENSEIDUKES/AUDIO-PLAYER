import { describe, it, expect } from "vitest"
import {
    createMockAudioEngine,
    createMockPluginContext,
    createMockAudioContext,
    createMockTrack,
    createMockSoundLayer,
} from "../testMocks"

describe("testMocks helper suite", () => {
    it("creates a compliant MockAudioEngine with default behaviors", async () => {
        const engine = createMockAudioEngine({
            duration: 240,
        })

        expect(engine.duration).toBe(240)
        expect(engine.currentTime).toBe(0)
        expect(engine.volume).toBe(1)
        expect(engine.isPlaying).toBe(false)

        await engine.play()
        expect(engine.play).toHaveBeenCalled()

        engine.seek(15)
        expect(engine.seek).toHaveBeenCalledWith(15)
    })

    it("creates a typed MockPluginContext with attached engine and root", () => {
        const context = createMockPluginContext()

        expect(context.getEngine).toBeDefined()
        const engine = context.getEngine()
        expect(engine).toBeDefined()
        expect(engine.volume).toBe(1)

        expect(typeof context.getSourceKey()).toBe("string")
        expect(context.getQueue?.()).toEqual([])
    })

    it("creates a typed MockAudioContext with Web Audio nodes", async () => {
        const ctx = createMockAudioContext({ sampleRate: 48000 })
        expect(ctx.sampleRate).toBe(48000)
        expect(ctx.state).toBe("running")

        const gain = ctx.createGain()
        expect(gain.gain.value).toBe(1)

        const buffer = await ctx.decodeAudioData(new ArrayBuffer(16))
        expect(buffer.numberOfChannels).toBe(2)
        expect(buffer.sampleRate).toBe(44100)
    })

    it("creates a valid Track mock with custom overrides", () => {
        const track = createMockTrack("custom-1", {
            title: "Custom Title",
            artist: "Custom Artist",
        })

        expect(track.id).toBe("custom-1")
        expect(track.title).toBe("Custom Title")
        expect(track.artist).toBe("Custom Artist")
        expect(track.audioFile).toBe("https://example.com/audio-custom-1.mp3")
    })

    it("creates a mock sound layer", () => {
        const soundLayer = createMockSoundLayer()
        expect(soundLayer.playSprite("beep")).toBe("sprite-1")
        soundLayer.stopAllSprites()
        expect(soundLayer.stopAllSprites).toHaveBeenCalled()
    })
})
