// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createReaderMixer, type ReaderMixer } from "../ReaderMixer"
import { FakeAudio, flushMicrotasks, setVisibility } from "./fakeMedia"

let mixer: ReaderMixer
const rain = { id: "rain", label: "Rain", sources: [{ url: "https://a.test/rain.mp3" }] }
beforeEach(() => {
    vi.useFakeTimers()
    FakeAudio.reset()
    vi.stubGlobal("Audio", FakeAudio)
    setVisibility("visible")
    mixer = createReaderMixer({ atmospheres: [rain], atmospherePreviewFadeMs: 1000 })
})
afterEach(() => {
    mixer.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

it("defaults to soundtrack layers and connects/disconnects Voice availability", () => {
    expect(mixer.getState().availability).toEqual({
        soundscapes: true,
        atmosphere: true,
        cues: true,
        voice: false,
    })
    const disconnect = mixer.connectVoice({
        getState: () => ({ status: "idle" }),
        subscribe: () => () => {},
        setLevel: vi.fn(),
        setEnabled: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
    })
    expect(mixer.getState().availability.voice).toBe(true)
    disconnect()
    expect(mixer.getState().availability.voice).toBe(false)
})

it("keeps hidden/off settings and applies presets to hidden layers", () => {
    mixer.setLayerEnabled("cues", false)
    mixer.setLayerLevel("cues", 0.2)
    const saved = mixer.getPreferences()
    mixer.setLayerAvailability({ cues: false, voice: true })
    expect(mixer.getPreferences()).toBe(saved)
    mixer.setLayerAvailability({ cues: true })
    expect(mixer.getState().availability.cues).toBe(true)
    expect(mixer.getPreferences().layers.cues.enabled).toBe(false)
    mixer.setLayerAvailability({ cues: false })
    mixer.applyPreset("cinematic")
    expect(mixer.getPreferences().layers.cues).toEqual({ enabled: true, level: 0.9 })
})

it("previews only Atmosphere for ten seconds outside a chapter, saving its choice", async () => {
    mixer.setAtmosphere(rain)
    await flushMicrotasks()
    expect(mixer.getState().atmosphereActive).toBe(false)
    expect(mixer.getState().atmospherePreviewing).toBe(true)
    vi.advanceTimersByTime(1030)
    const audio = FakeAudio.withSrc(rain.sources[0].url)[0]
    expect(audio.volume).toBeCloseTo(0.3)
    vi.advanceTimersByTime(8000)
    expect(mixer.getState().atmospherePreviewing).toBe(false)
    vi.advanceTimersByTime(500)
    expect(audio.volume).toBeGreaterThan(0)
    expect(audio.volume).toBeLessThan(0.3)
    vi.advanceTimersByTime(600)
    expect(audio.paused).toBe(true)
    expect(mixer.getPreferences().atmosphereId).toBe("rain")
    expect(mixer.getState().layers.atmosphere.status).toBe("idle")
    expect("previewSoundscape" in mixer).toBe(false)
    expect("previewCue" in mixer).toBe(false)
    expect("previewVoice" in mixer).toBe(false)
})

it("starts a continuous atmosphere after a preview, and previews again after chapter close", async () => {
    mixer.setAtmosphere(rain, { fadeMs: 0 })
    mixer.startAtmosphere({ fadeMs: 0 })
    await flushMicrotasks()
    vi.advanceTimersByTime(11000)
    expect(mixer.getState().atmosphereActive).toBe(true)
    expect(mixer.getState().layers.atmosphere.status).toBe("playing")
    mixer.stopAll({ fadeMs: 0 })
    vi.advanceTimersByTime(40)
    mixer.setAtmosphere(rain, { fadeMs: 0 })
    await flushMicrotasks()
    expect(mixer.getState().atmospherePreviewing).toBe(true)
    vi.advanceTimersByTime(10050)
    expect(mixer.getState().layers.atmosphere.status).toBe("idle")
})

it("never resumes an unfinished outside-chapter preview after page hide", async () => {
    mixer.setAtmosphere(rain)
    await flushMicrotasks()
    setVisibility("hidden")
    setVisibility("visible")
    vi.advanceTimersByTime(11000)
    expect(mixer.getState().layers.atmosphere.status).toBe("idle")
    expect(mixer.getState().atmospherePreviewing).toBe(false)
})
