// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    createReaderMixer,
    loadReaderMixerPreferences,
    normalizeReaderMixerPreferences,
    saveReaderMixerPreferences,
} from "../ReaderMixer"
import type { ReaderMixer, ReaderMixerVoiceOutput, ReaderMixerVoiceSnapshot } from "../ReaderMixer"
import { FakeAudio, setVisibility } from "./fakeMedia"

const mixers: ReaderMixer[] = []
function makeMixer() {
    const mixer = createReaderMixer({ initialPreferences: { layers: { voice: { level: 0.6 } } } })
    mixers.push(mixer)
    return mixer
}

function voice(status: ReaderMixerVoiceSnapshot["status"] = "playing") {
    let snapshot: ReaderMixerVoiceSnapshot = { status, current: "tts-line" }
    const listeners = new Set<() => void>()
    const emit = (next: Partial<ReaderMixerVoiceSnapshot>) => {
        snapshot = { ...snapshot, ...next }
        for (const listener of listeners) listener()
    }
    const output: ReaderMixerVoiceOutput = {
        getState: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        setLevel: vi.fn(),
        setEnabled: vi.fn(),
        pause: vi.fn(() => emit({ status: "paused" })),
        resume: vi.fn(() => emit({ status: "playing" })),
    }
    return { output, emit, listeners }
}

beforeEach(() => {
    FakeAudio.reset()
    vi.stubGlobal("Audio", FakeAudio)
    setVisibility("visible")
})
afterEach(() => {
    for (const mixer of mixers.splice(0)) mixer.dispose()
    vi.unstubAllGlobals()
    localStorage.clear()
})

describe("Voice mixer slot", () => {
    it("migrates three-layer saves and round-trips all four settings", () => {
        const legacy = {
            version: 1,
            masterEnabled: false,
            atmosphereId: "wind",
            layers: {
                soundscapes: { enabled: false, level: 0.23 },
                atmosphere: { enabled: true, level: 0.48 },
                cues: { enabled: true, level: 0.91 },
            },
        }
        const migrated = normalizeReaderMixerPreferences(legacy)
        expect(migrated).toEqual({
            ...legacy,
            version: 2,
            layers: { ...legacy.layers, voice: { enabled: true, level: 1 } },
        })
        const mixer = makeMixer()
        mixer.setPreferences(migrated)
        mixer.setLayerLevel("voice", 0.37)
        mixer.setLayerEnabled("voice", false)
        saveReaderMixerPreferences("voice-test", mixer.getPreferences())
        expect(loadReaderMixerPreferences("voice-test")).toEqual(mixer.getPreferences())
    })

    it("gates voice independently, preserves level and never ducks it", () => {
        const mixer = makeMixer()
        const { output } = voice()
        mixer.connectVoice(output)
        expect(output.setLevel).toHaveBeenLastCalledWith(0.6)
        expect(output.setEnabled).toHaveBeenLastCalledWith(true)
        mixer.setDuck(0.8, { fadeMs: 0 })
        expect(mixer.getState().layers.voice.effectiveLevel).toBe(0.6)
        mixer.setMasterEnabled(false)
        expect(output.setEnabled).toHaveBeenLastCalledWith(false)
        expect(mixer.getPreferences().layers.voice).toEqual({ enabled: true, level: 0.6 })
        mixer.setLayerLevel("voice", 0.3)
        mixer.setMasterEnabled(true)
        expect(output.setEnabled).toHaveBeenLastCalledWith(true)
        expect(output.setLevel).toHaveBeenLastCalledWith(0.3)
        mixer.setLayerEnabled("voice", false)
        expect(output.setEnabled).toHaveBeenLastCalledWith(false)
        expect(mixer.getState().layers.voice.effectiveLevel).toBe(0)
        mixer.setLayerEnabled("voice", true)
        expect(mixer.getState().layers.voice.effectiveLevel).toBe(0.3)
    })

    it("silences a saved zero level even when element volume is ignored", () => {
        const mixer = makeMixer()
        mixer.setLayerLevel("voice", 0)
        const { output, emit } = voice()
        mixer.connectVoice(output)
        emit({ volumeControl: "on-off" })
        expect(output.setEnabled).toHaveBeenLastCalledWith(false)
        expect(mixer.getState().volumeControl).toBe("on-off")
    })

    it("surfaces failures, retries blocked voice on a gesture and follows host mute", () => {
        const mixer = makeMixer()
        const { output, emit } = voice("blocked")
        mixer.connectVoice(output)
        expect(mixer.getState().needsGesture).toBe(true)
        mixer.unlock()
        expect(output.resume).toHaveBeenCalledOnce()
        expect(mixer.getState().needsGesture).toBe(false)
        emit({ status: "failed", failure: "TTS fetch failed" })
        expect(mixer.getState().layers.voice.failure).toBe("TTS fetch failed")
        emit({ status: "playing", failure: null, muted: true })
        expect(mixer.getState().layers.voice.effectiveLevel).toBe(0)
    })

    it("pauses playing voice while hidden and keeps a stopped chapter paused", () => {
        const mixer = makeMixer()
        const { output } = voice()
        mixer.connectVoice(output)
        setVisibility("hidden")
        expect(output.pause).toHaveBeenCalledOnce()
        setVisibility("visible")
        expect(output.resume).toHaveBeenCalledOnce()
        setVisibility("hidden")
        mixer.stopAll()
        setVisibility("visible")
        expect(output.resume).toHaveBeenCalledOnce()
    })

    it("does not start a voice that the reader already paused", () => {
        const mixer = makeMixer()
        const { output } = voice("paused")
        mixer.connectVoice(output)
        setVisibility("hidden")
        setVisibility("visible")
        expect(output.pause).not.toHaveBeenCalled()
        expect(output.resume).not.toHaveBeenCalled()
    })

    it("gates pending narration that finishes starting while hidden", () => {
        const mixer = makeMixer()
        setVisibility("hidden")
        const { output, emit } = voice("loading")
        mixer.connectVoice(output)
        expect(output.setEnabled).toHaveBeenLastCalledWith(false)
        emit({ status: "playing" })
        expect(output.pause).toHaveBeenCalledOnce()
        setVisibility("visible")
        expect(output.setEnabled).toHaveBeenLastCalledWith(true)
        expect(output.resume).toHaveBeenCalledOnce()
    })

    it("detaches replaced outputs and releases the gate without owning their source", () => {
        const mixer = makeMixer()
        const first = voice()
        const disconnectFirst = mixer.connectVoice(first.output)
        const second = voice()
        const disconnectSecond = mixer.connectVoice(second.output)
        expect(first.output.pause).toHaveBeenCalledOnce()
        expect(first.listeners.size).toBe(0)
        disconnectFirst()
        expect(second.listeners.size).toBe(1)
        mixer.setMasterEnabled(false)
        disconnectSecond()
        expect(second.output.setEnabled).toHaveBeenLastCalledWith(true)
        expect(second.output.pause).not.toHaveBeenCalled()
        expect(mixer.getState().layers.voice.status).toBe("idle")
        const third = voice()
        mixer.connectVoice(third.output)
        mixer.dispose()
        expect(third.output.pause).toHaveBeenCalledOnce()
        expect(third.listeners.size).toBe(0)
    })
})
