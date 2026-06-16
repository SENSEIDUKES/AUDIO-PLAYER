import { describe, expect, it, vi } from "vitest"
import { WaveformPlugin, createWaveformPlugin } from "../WaveformPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"
import type { AudioPlayerEngine, Track } from "../../types"

function createPluginContext(track: Track | null): PluginPlayerContext {
    const engine = {} as unknown as AudioPlayerEngine
    return {
        getEngine: () => engine,
        getRootElement: () => null,
        getAudioElement: () => null,
        getCurrentTrack: () => track,
        getNextTrack: () => null,
        getSourceKey: () => "test-track",
    }
}

describe("WaveformPlugin", () => {
    it("marks itself with providesWaveform so the player renders the waveform", () => {
        const plugin = createWaveformPlugin()
        expect(plugin.providesWaveform).toBe(true)
        expect(plugin.name).toBe("waveform")
    })

    it("honors a custom name", () => {
        expect(createWaveformPlugin({ name: "registry-waveform" }).name).toBe(
            "registry-waveform"
        )
    })

    it("never throws into the host and does no playback work", () => {
        const plugin = new WaveformPlugin({ prewarmPeaks: false })
        const track: Track = {
            title: "Test",
            artist: "SEIHouse",
            audioFile: "/test.mp3",
        }
        expect(() => {
            plugin.init(createPluginContext(track))
            plugin.onTrackLoad(track)
            plugin.onTrackLoad(null)
            plugin.destroy()
        }).not.toThrow()
    })

    it("skips the peaks pre-warm for tracks that already ship peaks", () => {
        const fetchSpy = vi.fn()
        const original = globalThis.fetch
        globalThis.fetch = fetchSpy as unknown as typeof fetch
        try {
            const plugin = new WaveformPlugin()
            plugin.init(
                createPluginContext({
                    title: "Test",
                    artist: "SEIHouse",
                    audioFile: "/test.mp3",
                    peaks: [[0.1, 0.2]],
                    waveformDuration: 2,
                })
            )
            expect(fetchSpy).not.toHaveBeenCalled()
        } finally {
            globalThis.fetch = original
        }
    })
})
