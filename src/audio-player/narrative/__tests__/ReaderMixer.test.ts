// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    DEFAULT_READER_MIXER_PREFERENCES,
    computeReaderMixerGain,
    createReaderMixer,
    loadReaderMixerPreferences,
    normalizeReaderMixerPreferences,
    saveReaderMixerPreferences,
} from "../ReaderMixer"
import type {
    ReaderAtmosphereOption,
    ReaderMixer,
    ReaderMixerOptions,
    ReaderMixerPreferences,
} from "../ReaderMixer"
import type { Track } from "../../types"
import { FakeAudio, FakeAudioContext, flushMicrotasks, setVisibility } from "./fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))

const CHAPTER: Track = {
    id: "ch1",
    title: "Chapter 1",
    artist: "",
    audioFile: "https://a.test/ch1.mp3",
}
const BATTLE: Track = {
    id: "battle",
    title: "Battle",
    artist: "",
    audioFile: "https://a.test/battle.mp3",
}
const RAIN: ReaderAtmosphereOption = {
    id: "rain",
    label: "Rain",
    group: "Weather",
    sources: [{ url: "https://a.test/rain.mp3" }],
}
const WIND: ReaderAtmosphereOption = {
    id: "wind",
    label: "Wind",
    group: "Weather",
    track: { title: "Wind", artist: "", audioFile: "https://a.test/wind.mp3" },
}
const GROWL = "https://a.test/growl.mp3"

const PREFS: ReaderMixerPreferences = normalizeReaderMixerPreferences({
    layers: {
        soundscapes: { enabled: true, level: 0.5 },
        atmosphere: { enabled: true, level: 0.4 },
        cues: { enabled: true, level: 0.8 },
    },
})

const mixers: ReaderMixer[] = []
function makeMixer(options: ReaderMixerOptions = {}): ReaderMixer {
    const mixer = createReaderMixer({
        initialPreferences: PREFS,
        atmospheres: [RAIN, WIND],
        ...options,
    })
    mixers.push(mixer)
    return mixer
}

/** Start playback and let a zero-length fade settle. */
async function settle(ms = 40): Promise<void> {
    await flushMicrotasks()
    vi.advanceTimersByTime(ms)
    await flushMicrotasks()
}

const only = (url: string): FakeAudio => {
    const matches = FakeAudio.withSrc(url)
    expect(matches).toHaveLength(1)
    return matches[0]
}

describe("ReaderMixer", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeAudio.reset()
        FakeAudioContext.instances = []
        vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio)
        setVisibility("visible")
    })

    afterEach(() => {
        for (const mixer of mixers.splice(0)) mixer.dispose()
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    describe("level math", () => {
        it("multiplies master × switch × level × per-call volume", () => {
            expect(computeReaderMixerGain(PREFS, "soundscapes")).toBe(0.5)
            expect(computeReaderMixerGain(PREFS, "cues", 0.5)).toBeCloseTo(0.4)
            const layerOff = normalizeReaderMixerPreferences(
                { layers: { cues: { enabled: false } } },
                PREFS
            )
            expect(computeReaderMixerGain(layerOff, "cues", 1)).toBe(0)
            const masterOff = normalizeReaderMixerPreferences({ masterEnabled: false }, PREFS)
            expect(computeReaderMixerGain(masterOff, "soundscapes")).toBe(0)
            expect(computeReaderMixerGain(PREFS, "atmosphere", 7)).toBe(0.4)
        })

        it("applies each layer's gain to its own elements, live", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            expect(only("https://a.test/ch1.mp3").volume).toBeCloseTo(0.5)
            expect(only("https://a.test/rain.mp3").volume).toBeCloseTo(0.4)

            expect(mixer.playCue(GROWL, { volume: 0.5 })).toBe(true)
            expect(only(GROWL).volume).toBeCloseTo(0.4)

            mixer.setLayerLevel("soundscapes", 0.25)
            expect(only("https://a.test/ch1.mp3").volume).toBeCloseTo(0.25)
            expect(mixer.getState().layers.soundscapes.effectiveLevel).toBeCloseTo(0.25)
            // Other layers are untouched.
            expect(only("https://a.test/rain.mp3").volume).toBeCloseTo(0.4)
        })

        it("re-targets level changes during a crossfade", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            mixer.playSoundscape(BATTLE, { fadeMs: 2000 })
            await settle(1000)
            const incoming = only("https://a.test/battle.mp3")
            const before = incoming.volume
            mixer.setLayerLevel("soundscapes", 0.25)
            expect(incoming.volume).toBeCloseTo(before / 2)
            vi.advanceTimersByTime(1100)
            expect(incoming.volume).toBeCloseTo(0.25)
        })
    })

    describe("master switch", () => {
        it("silences every layer and restores each layer's own settings", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            mixer.setLayerEnabled("atmosphere", false)
            mixer.setLayerLevel("cues", 0.3)
            const layersBefore = mixer.getPreferences().layers

            mixer.setMasterEnabled(false)
            const off = mixer.getState()
            expect(off.preferences.masterEnabled).toBe(false)
            expect(off.preferences.layers).toEqual(layersBefore)
            for (const layer of ["soundscapes", "atmosphere", "cues"] as const) {
                expect(off.layers[layer].effectiveLevel).toBe(0)
            }
            expect(only("https://a.test/ch1.mp3").muted).toBe(true)
            expect(only("https://a.test/rain.mp3").muted).toBe(true)
            expect(mixer.playCue(GROWL)).toBe(false)

            mixer.setMasterEnabled(true)
            const on = mixer.getState()
            expect(on.preferences.layers).toEqual(layersBefore)
            expect(on.layers.soundscapes.effectiveLevel).toBeCloseTo(0.5)
            expect(on.layers.atmosphere.effectiveLevel).toBe(0)
            expect(on.layers.cues.effectiveLevel).toBeCloseTo(0.3)
            expect(only("https://a.test/ch1.mp3").muted).toBe(false)
            expect(only("https://a.test/ch1.mp3").volume).toBeCloseTo(0.5)
            // The atmosphere switch stayed off; it is still silent.
            expect(only("https://a.test/rain.mp3").muted).toBe(true)
        })
    })

    describe("preferences", () => {
        it("round-trips through JSON into a new mixer", () => {
            const first = makeMixer()
            first.setLayerLevel("soundscapes", 0.33)
            first.setLayerEnabled("cues", false)
            first.setMasterEnabled(false)
            first.setAtmosphere(RAIN)
            const saved = JSON.parse(JSON.stringify(first.getPreferences())) as unknown

            const second = makeMixer({ initialPreferences: saved as ReaderMixerPreferences })
            expect(second.getPreferences()).toEqual(first.getPreferences())
            expect(second.getPreferences()).toEqual({
                version: 3,
                masterEnabled: false,
                layers: {
                    soundscapes: { enabled: true, level: 0.33 },
                    atmosphere: { enabled: true, level: 0.4 },
                    cues: { enabled: false, level: 0.8 },
                    voice: { enabled: true, level: 1 },
                },
                atmosphereId: "rain",
            })
        })

        it("reports every change, and only real changes", () => {
            const onPreferencesChange = vi.fn()
            const mixer = makeMixer({ onPreferencesChange, preferencesDebounceMs: 0 })
            const listener = vi.fn()
            mixer.subscribePreferences(listener)

            mixer.setLayerLevel("atmosphere", 0.7)
            mixer.setLayerLevel("atmosphere", 0.7)
            mixer.setLayerEnabled("soundscapes", false)
            mixer.setAtmosphere("wind")
            expect(onPreferencesChange).toHaveBeenCalledTimes(3)
            expect(listener).toHaveBeenCalledTimes(3)
            expect(onPreferencesChange.mock.calls[2][0].atmosphereId).toBe("wind")
        })

        it("fills missing or invalid fields with defaults", () => {
            expect(normalizeReaderMixerPreferences("garbage")).toEqual(
                DEFAULT_READER_MIXER_PREFERENCES
            )
            const prefs = normalizeReaderMixerPreferences({
                masterEnabled: "yes",
                layers: { soundscapes: { level: 5 }, cues: { enabled: false, level: Number.NaN } },
                atmosphereId: 42,
            })
            expect(prefs.masterEnabled).toBe(true)
            expect(prefs.layers.soundscapes).toEqual({ enabled: true, level: 1 })
            expect(prefs.layers.cues).toEqual({ enabled: false, level: 0.75 })
            expect(prefs.atmosphereId).toBe("gentle-rain")
            expect(Object.isFrozen(prefs)).toBe(true)
        })

        it("starts a new reader on the default mix: 25 / 30 / 75 with gentle rain", () => {
            const mixer = createReaderMixer()
            mixers.push(mixer)
            expect(mixer.getPreferences()).toEqual({
                version: 3,
                masterEnabled: true,
                layers: {
                    soundscapes: { enabled: true, level: 0.25 },
                    atmosphere: { enabled: true, level: 0.3 },
                    cues: { enabled: true, level: 0.75 },
                    voice: { enabled: true, level: 1 },
                },
                atmosphereId: "gentle-rain",
            })
            expect(mixer.getState().activePresetId).toBe("default")
        })

        it("lets the host choose its own defaults", () => {
            const mixer = makeMixer({
                initialPreferences: { layers: { cues: { level: 0.1 } } },
                defaultPreferences: {
                    atmosphereId: "rain",
                    layers: { soundscapes: { level: 0.5 } },
                },
            })
            expect(mixer.getPreferences().atmosphereId).toBe("rain")
            expect(mixer.getPreferences().layers.soundscapes.level).toBe(0.5)
            expect(mixer.getPreferences().layers.cues.level).toBe(0.1)
            mixer.resetPreferences()
            expect(mixer.getPreferences().layers.cues.level).toBe(0.75)
            expect(mixer.getState().activePresetId).toBe("default")
        })

        it("applies presets, keeping the atmosphere a preset leaves out", async () => {
            const mixer = makeMixer()
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            expect(mixer.getState().activePresetId).toBeNull()

            mixer.applyPreset("calm")
            expect(mixer.getPreferences().layers).toEqual({
                soundscapes: { enabled: true, level: 0.15 },
                atmosphere: { enabled: true, level: 0.4 },
                cues: { enabled: true, level: 0.4 },
                voice: { enabled: true, level: 1 },
            })
            expect(mixer.getPreferences().atmosphereId).toBe("rain")
            expect(mixer.getState().activePresetId).toBe("calm")

            mixer.applyPreset("focus")
            expect(mixer.getPreferences().layers.soundscapes.enabled).toBe(false)
            expect(mixer.getPreferences().layers.cues.enabled).toBe(false)
            expect(mixer.getState().activePresetId).toBe("focus")

            mixer.applyPreset("nope")
            expect(mixer.getState().activePresetId).toBe("focus")
        })

        it("saves and loads under a host-chosen storage key", () => {
            const key = "test:reader-mixer"
            localStorage.removeItem(key)
            expect(loadReaderMixerPreferences(key)).toBeNull()
            expect(saveReaderMixerPreferences(key, PREFS)).toBe(true)
            expect(loadReaderMixerPreferences(key)).toEqual(PREFS)
            localStorage.setItem(key, "{not json")
            expect(loadReaderMixerPreferences(key)).toBeNull()
            expect(loadReaderMixerPreferences(key, null)).toBeNull()
            localStorage.removeItem(key)
        })
    })

    describe("soundscapes", () => {
        it("crossfades to a new track, then releases the old one", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            const outgoing = only("https://a.test/ch1.mp3")

            mixer.playSoundscape(BATTLE)
            await settle(1000)
            const incoming = only("https://a.test/battle.mp3")
            expect(outgoing.volume).toBeGreaterThan(0)
            expect(outgoing.volume).toBeLessThan(0.5)
            expect(incoming.volume).toBeGreaterThan(0)
            expect(incoming.volume).toBeLessThan(0.5)

            vi.advanceTimersByTime(1100)
            expect(incoming.volume).toBeCloseTo(0.5)
            expect(outgoing.src).toBe("")
            expect(mixer.getState().layers.soundscapes).toMatchObject({
                status: "playing",
                current: "id:battle",
            })
        })

        it("does nothing when asked for the track that is already playing", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            const created = FakeAudio.created.length
            const deck = only("https://a.test/ch1.mp3")
            const plays = deck.playCalls

            mixer.playSoundscape(CHAPTER)
            mixer.playSoundscape({ ...CHAPTER })
            await settle(3000)
            expect(FakeAudio.created).toHaveLength(created)
            expect(deck.playCalls).toBe(plays)
            expect(deck.volume).toBeCloseTo(0.5)
        })

        it("fades the music out on stopSoundscape()", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            const deck = only("https://a.test/ch1.mp3")
            mixer.stopSoundscape({ fadeMs: 1000 })
            vi.advanceTimersByTime(500)
            expect(deck.volume).toBeGreaterThan(0)
            expect(deck.volume).toBeLessThan(0.5)
            vi.advanceTimersByTime(600)
            expect(deck.src).toBe("")
            expect(mixer.getState().layers.soundscapes.status).toBe("idle")
        })
    })

    describe("atmosphere", () => {
        it("restores the default atmosphere after Off while the reader is open", async () => {
            const mixer = makeMixer({ defaultPreferences: { atmosphereId: "rain" } })
            mixer.startAtmosphere({ fadeMs: 0 })
            await settle()
            mixer.setAtmosphere(null, { fadeMs: 0 })
            await settle()
            mixer.applyPreset("default")
            await settle(2100)
            expect(mixer.getPreferences().atmosphereId).toBe("rain")
            expect(mixer.getState().layers.atmosphere.status).toBe("playing")
            expect(only("https://a.test/rain.mp3").paused).toBe(false)

            mixer.stopAtmosphere({ fadeMs: 0 })
            mixer.setPreferences({ atmosphereId: null })
            mixer.applyPreset("default")
            await settle()
            expect(FakeAudio.withSrc("https://a.test/rain.mp3")).toHaveLength(0)
        })

        it("fades out on setAtmosphere(null) and saves Off", async () => {
            const mixer = makeMixer()
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            const bed = only("https://a.test/rain.mp3")
            expect(bed.loop).toBe(false)

            mixer.setAtmosphere(null)
            expect(mixer.getPreferences().atmosphereId).toBeNull()
            vi.advanceTimersByTime(1000)
            expect(bed.volume).toBeGreaterThan(0)
            expect(bed.volume).toBeLessThan(0.4)
            vi.advanceTimersByTime(1100)
            expect(bed.src).toBe("")
            expect(mixer.getState().layers.atmosphere.status).toBe("idle")
            expect(mixer.getState().atmosphereActive).toBe(false)
        })

        it("starts the saved choice from the catalog", async () => {
            const mixer = makeMixer({
                initialPreferences: { ...PREFS, atmosphereId: "wind" },
                atmospheres: [],
            })
            mixer.startAtmosphere()
            await settle()
            expect(FakeAudio.withSrc("https://a.test/wind.mp3")).toHaveLength(0)

            // The catalog arrives later; the pending choice starts then.
            mixer.setAtmosphereOptions([RAIN, WIND])
            await settle(2100)
            expect(only("https://a.test/wind.mp3").paused).toBe(false)
            expect(mixer.getState().layers.atmosphere.status).toBe("playing")
        })

        it("stops a removed catalog bed and restores it if the catalog returns", async () => {
            const mixer = makeMixer({ initialPreferences: { atmosphereId: "rain" } })
            mixer.startAtmosphere({ fadeMs: 0 })
            await settle()
            mixer.setAtmosphereOptions([])
            await settle(2100)
            expect(FakeAudio.withSrc("https://a.test/rain.mp3")).toHaveLength(0)
            expect(mixer.getPreferences().atmosphereId).toBe("rain")
            mixer.setAtmosphereOptions([RAIN])
            await settle(2100)
            expect(only("https://a.test/rain.mp3").paused).toBe(false)
        })

        it("crossfades a changed source under the same catalog id and defers it while hidden", async () => {
            const mixer = makeMixer()
            mixer.startAtmosphere()
            const rain = { ...RAIN, track: { ...CHAPTER, audioFile: "https://a.test/old.mp3" } }
            mixer.setAtmosphere(rain, { fadeMs: 0 })
            await settle()
            const old = only("https://a.test/old.mp3")
            FakeAudio.playBehavior = "pending"
            mixer.setAtmosphereOptions([
                { ...rain, track: { ...rain.track, audioFile: "https://a.test/new.mp3" } },
            ])
            await settle()
            expect(old.paused).toBe(false)
            expect(FakeAudio.withSrc("https://a.test/new.mp3")).toHaveLength(1)
            setVisibility("hidden")
            mixer.setAtmosphereOptions([
                { ...rain, track: { ...rain.track, audioFile: "https://a.test/latest.mp3" } },
            ])
            await settle()
            expect(FakeAudio.withSrc("https://a.test/latest.mp3")).toHaveLength(0)
            FakeAudio.playBehavior = "resolve"
            setVisibility("visible")
            await settle(2100)
            expect(only("https://a.test/latest.mp3").paused).toBe(false)
            expect(old.src).toBe("")
        })

        it("silences the bed when new preferences name an unknown atmosphere", async () => {
            const mixer = makeMixer()
            mixer.startAtmosphere()
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            mixer.setPreferences({ atmosphereId: "not-in-catalog" })
            await settle(2100)
            expect(FakeAudio.withSrc("https://a.test/rain.mp3")).toHaveLength(0)
            expect(mixer.getPreferences().atmosphereId).toBe("not-in-catalog")

            mixer.setAtmosphereOptions([
                RAIN,
                {
                    id: "not-in-catalog",
                    label: "Late",
                    sources: [{ url: "https://a.test/late.mp3" }],
                },
            ])
            await settle(2100)
            expect(only("https://a.test/late.mp3").paused).toBe(false)
        })

        it("stopAtmosphere() keeps the reader's choice", async () => {
            const mixer = makeMixer()
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            mixer.stopAtmosphere({ fadeMs: 0 })
            await settle()
            expect(mixer.getPreferences().atmosphereId).toBe("rain")
            expect(FakeAudio.withSrc("https://a.test/rain.mp3")).toHaveLength(0)
        })
    })

    describe("cues", () => {
        it("overlap without stopping or ducking the loops", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            const score = only("https://a.test/ch1.mp3")
            const bed = only("https://a.test/rain.mp3")

            expect(mixer.playCue(GROWL)).toBe(true)
            expect(mixer.playCue(GROWL)).toBe(true)
            expect(mixer.playCue("https://a.test/chime.mp3", { volume: 0.25 })).toBe(true)
            await flushMicrotasks()

            const growls = FakeAudio.withSrc(GROWL)
            expect(growls).toHaveLength(2)
            expect(growls.every((audio) => !audio.paused)).toBe(true)
            expect(mixer.getState().activeCues).toBe(3)
            expect(mixer.getState().layers.cues.status).toBe("playing")

            for (const loop of [score, bed]) {
                expect(loop.paused).toBe(false)
                expect(loop.pauseCalls).toBe(0)
            }
            expect(score.volume).toBeCloseTo(0.5)
            expect(bed.volume).toBeCloseTo(0.4)

            growls[0].dispatch("ended")
            expect(mixer.getState().activeCues).toBe(2)
        })

        it("skips cues while Sound Cues is off", () => {
            const mixer = makeMixer()
            mixer.setLayerEnabled("cues", false)
            expect(mixer.playCue(GROWL)).toBe(false)
            expect(FakeAudio.withSrc(GROWL)).toHaveLength(0)
        })

        it("reports a blocked cue and clears it on the next gesture", async () => {
            const mixer = makeMixer()
            FakeAudio.playBehavior = "not-allowed"
            mixer.playCue(GROWL)
            await flushMicrotasks()
            expect(mixer.getState().layers.cues.status).toBe("blocked")
            expect(mixer.getState().needsGesture).toBe(true)

            document.dispatchEvent(new Event("pointerup"))
            expect(mixer.getState().layers.cues.status).toBe("idle")
        })
    })

    describe("browsers that ignore element volume", () => {
        beforeEach(() => {
            FakeAudio.volumeLocked = true
        })

        it("keeps playback working and turns sliders into on/off on the element route", async () => {
            vi.stubGlobal("AudioContext", FakeAudioContext)
            const mixer = makeMixer({ routing: "element" })
            expect(mixer.getState()).toMatchObject({
                routing: "element",
                volumeControl: "on-off",
            })
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            const deck = only("https://a.test/ch1.mp3")
            expect(deck.paused).toBe(false)
            expect(deck.crossOrigin).toBe("anonymous")
            expect(deck.muted).toBe(false)

            mixer.setLayerLevel("soundscapes", 0)
            expect(deck.muted).toBe(true)
            mixer.setLayerLevel("soundscapes", 0.3)
            expect(deck.muted).toBe(false)
            expect(deck.volume).toBe(1)

            mixer.playCue(GROWL)
            expect(only(GROWL).muted).toBe(false)
        })

        it("routes through Web Audio gain by default (auto)", async () => {
            vi.stubGlobal("AudioContext", FakeAudioContext)
            const mixer = makeMixer()
            expect(mixer.getState()).toMatchObject({
                routing: "web-audio",
                volumeControl: "level",
            })
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            const ctx = FakeAudioContext.instances[0]
            const deck = only("https://a.test/ch1.mp3")
            expect(deck.crossOrigin).toBe("anonymous")
            expect(ctx.routedElements).toContain(deck)
            const [soundscapes, atmosphere, cues] = ctx.buses()
            expect(soundscapes.gain.value).toBeCloseTo(0.5)
            expect(atmosphere.gain.value).toBeCloseTo(0.4)
            expect(cues.gain.value).toBeCloseTo(0.8)

            mixer.setLayerLevel("soundscapes", 0.2)
            expect(soundscapes.gain.value).toBeCloseTo(0.2)
            mixer.setMasterEnabled(false)
            expect(ctx.buses().every((bus) => bus.gain.value === 0)).toBe(true)
        })
    })

    describe("Web Audio routing", () => {
        beforeEach(() => {
            vi.stubGlobal("AudioContext", FakeAudioContext)
        })

        it("uses Web Audio for default leveling and can retain plain elements with leveling off", () => {
            expect(makeMixer().getState().routing).toBe("web-audio")
            expect(makeMixer({ routing: "auto", leveling: false }).getState().routing).toBe(
                "element"
            )
            expect(makeMixer({ routing: "element" }).getState().routing).toBe("element")
            expect(FakeAudioContext.instances).toHaveLength(1)
        })

        it("crossfades through per-element gain and resumes the context on a gesture", async () => {
            const mixer = makeMixer({ routing: "web-audio" })
            const ctx = FakeAudioContext.instances[0]
            ctx.resumeBehavior = "reject"
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            expect(mixer.getState().needsGesture).toBe(true)

            ctx.resumeBehavior = "resolve"
            const attempts = ctx.resumeCalls
            document.dispatchEvent(new Event("pointerup"))
            expect(ctx.resumeCalls).toBe(attempts + 1)
            expect(mixer.getState().needsGesture).toBe(false)

            mixer.playSoundscape(BATTLE, { fadeMs: 2000 })
            await settle(1000)
            const elementGains = ctx.gains.filter((node) => !ctx.buses().includes(node))
            const values = elementGains.map((node) => node.gain.value)
            // One element fading out, one fading in, both mid-way.
            expect(values.filter((value) => value > 0 && value < 1)).toHaveLength(2)
            // Element volume is never used on this route.
            expect(only("https://a.test/battle.mp3").volume).toBe(1)
        })
    })

    describe("page visibility", () => {
        it("pauses both loops while hidden and resumes them after", async () => {
            const mixer = makeMixer()
            mixer.startAtmosphere()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            const score = only("https://a.test/ch1.mp3")
            const bed = only("https://a.test/rain.mp3")

            setVisibility("hidden")
            expect(score.paused).toBe(true)
            expect(bed.paused).toBe(true)
            expect(mixer.getState()).toMatchObject({ pageHidden: true })
            expect(mixer.getState().layers.soundscapes.status).toBe("paused")

            // A switch requested while hidden waits for the page to return.
            mixer.playSoundscape(BATTLE, { fadeMs: 0 })
            expect(FakeAudio.withSrc("https://a.test/battle.mp3")).toHaveLength(0)

            setVisibility("visible")
            await settle()
            expect(bed.paused).toBe(false)
            expect(only("https://a.test/battle.mp3").paused).toBe(false)
            expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        })

        it("can be turned off", async () => {
            const mixer = makeMixer({ pauseWhenHidden: false })
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            setVisibility("hidden")
            expect(only("https://a.test/ch1.mp3").paused).toBe(false)
            expect(mixer.getState().pageHidden).toBe(false)
        })
    })

    describe("unlocking", () => {
        it("retries blocked loops on one gesture and primes spare elements", async () => {
            FakeAudio.playBehavior = "not-allowed"
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            expect(mixer.getState().layers.soundscapes.status).toBe("blocked")
            expect(mixer.getState().layers.atmosphere.status).toBe("blocked")

            FakeAudio.playBehavior = "resolve"
            const before = FakeAudio.created.length
            document.dispatchEvent(new Event("pointerup"))
            await settle()
            expect(mixer.getState().layers.soundscapes.status).toBe("playing")
            expect(mixer.getState().layers.atmosphere.status).toBe("playing")
            // 2 + 2 spare decks and 4 spare cue elements, each load()ed in the gesture.
            const spares = FakeAudio.created.slice(before)
            expect(spares).toHaveLength(8)
            expect(spares.every((audio) => audio.loadCalls === 1)).toBe(true)

            // The next cue uses a primed spare rather than a fresh element.
            mixer.playCue(GROWL)
            expect(FakeAudio.created).toHaveLength(before + 8)
        })
    })

    describe("duck", () => {
        it("lowers the loops but not cues, without touching preferences", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            mixer.setAtmosphere(RAIN, { fadeMs: 0 })
            await settle()
            const prefs = mixer.getPreferences()

            mixer.setDuck(0.5, { fadeMs: 0 })
            expect(only("https://a.test/ch1.mp3").volume).toBeCloseTo(0.25)
            expect(only("https://a.test/rain.mp3").volume).toBeCloseTo(0.2)
            mixer.playCue(GROWL)
            expect(only(GROWL).volume).toBeCloseTo(0.8)
            expect(mixer.getState()).toMatchObject({ duck: 0.5 })
            expect(mixer.getState().layers.soundscapes.effectiveLevel).toBeCloseTo(0.25)
            expect(mixer.getState().layers.cues.effectiveLevel).toBeCloseTo(0.8)
            expect(mixer.getPreferences()).toBe(prefs)

            mixer.setDuck(0, { fadeMs: 0 })
            expect(only("https://a.test/ch1.mp3").volume).toBeCloseTo(0.5)
        })

        it("ramps toward the target", async () => {
            const mixer = makeMixer()
            mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
            await settle()
            const score = only("https://a.test/ch1.mp3")
            mixer.setDuck(1, { fadeMs: 400 })
            vi.advanceTimersByTime(200)
            expect(score.volume).toBeGreaterThan(0.1)
            expect(score.volume).toBeLessThan(0.4)
            vi.advanceTimersByTime(250)
            expect(score.volume).toBeCloseTo(0)
            expect(score.muted).toBe(true)
            mixer.setDuck(0, { fadeMs: 400 })
            vi.advanceTimersByTime(450)
            expect(score.volume).toBeCloseTo(0.5)
            expect(score.muted).toBe(false)
        })
    })

    it("releases everything on dispose()", async () => {
        const mixer = makeMixer()
        mixer.playSoundscape(CHAPTER, { fadeMs: 0 })
        mixer.setAtmosphere(RAIN, { fadeMs: 0 })
        await settle()
        mixer.playCue(GROWL)
        const listener = vi.fn()
        mixer.subscribe(listener)

        mixer.dispose()
        expect(mixer.isDisposed()).toBe(true)
        expect(FakeAudio.created.filter((audio) => audio.src !== "")).toHaveLength(0)
        mixer.playSoundscape(BATTLE)
        expect(mixer.playCue(GROWL)).toBe(false)
        document.dispatchEvent(new Event("pointerup"))
        expect(FakeAudio.withSrc("https://a.test/battle.mp3")).toHaveLength(0)
        expect(listener).not.toHaveBeenCalled()
    })
})
