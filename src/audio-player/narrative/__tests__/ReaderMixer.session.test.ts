// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReaderMixer, type ReaderMixer, type ReaderMixerOptions } from "../ReaderMixer"
import { FakeAudio, flushMicrotasks, setVisibility } from "./fakeMedia"

const score = { id: "score", title: "Score", artist: "", audioFile: "https://a.test/score.mp3" }
const rain = { id: "rain", label: "Rain", sources: [{ url: "https://a.test/rain.mp3" }] }
const mixers: ReaderMixer[] = []
function make(options: ReaderMixerOptions = {}) {
    const mixer = createReaderMixer({
        atmospheres: [rain],
        initialPreferences: { atmosphereId: "rain" },
        fadeMs: 0,
        atmosphereFadeMs: 0,
        idleTimeoutMs: null,
        ...options,
    })
    mixers.push(mixer)
    return mixer
}
async function start(mixer: ReaderMixer) {
    mixer.playSoundscape(score, { scene: "chapter-1" })
    mixer.startAtmosphere()
    await settle()
    return {
        music: FakeAudio.withSrc(score.audioFile)[0],
        bed: FakeAudio.withSrc(rain.sources[0].url)[0],
    }
}
async function settle(ms = 40) {
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(ms)
}
beforeEach(() => {
    vi.useFakeTimers()
    FakeAudio.reset()
    vi.stubGlobal("Audio", FakeAudio)
    setVisibility("visible")
})
afterEach(() => {
    mixers.splice(0).forEach((mixer) => mixer.dispose())
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("sleep", () => {
    it("coalesces countdown updates during input bursts without delaying expiration", () => {
        const mixer = make({
            sleepFadeMs: 0,
            sleepTimerChoices: [
                { id: "quick", label: "Five seconds", kind: "duration", durationMs: 5000 },
            ],
        })
        mixer.setSleepTimer("quick")
        const startedAt = Date.now()
        const changed = vi.fn()
        const fired = vi.fn()
        mixer.subscribe(() => changed())
        mixer.subscribeSleep(fired)
        for (let i = 0; i < 100; i++) {
            vi.setSystemTime(startedAt + i * 10)
            document.dispatchEvent(new Event("pointermove"))
            document.dispatchEvent(new Event("scroll"))
        }
        expect(changed).not.toHaveBeenCalled()
        vi.setSystemTime(startedAt + 1000)
        document.dispatchEvent(new Event("scroll"))
        expect(changed).toHaveBeenCalledTimes(1)
        expect(mixer.getState().sleepTimer.remainingMs).toBe(4000)
        vi.setSystemTime(startedAt + 5000)
        document.dispatchEvent(new Event("pointermove"))
        expect(mixer.getState().sleepTimer.status).toBe("fired")
        expect(fired).toHaveBeenCalledTimes(1)
    })

    it.each([15, 30, 45, 60])(
        "fires after %i wall-clock minutes without saving preferences",
        async (minutes) => {
            const onSleepTimer = vi.fn()
            const mixer = make({ sleepFadeMs: 0, onSleepTimer })
            await start(mixer)
            const prefs = mixer.getPreferences()
            expect(mixer.getState().sleepTimer.status).toBe("off")
            mixer.setSleepTimer(`${minutes}-minutes`)
            await settle(minutes * 60000 - 1)
            expect(onSleepTimer).not.toHaveBeenCalled()
            await settle(2)
            expect(mixer.getState().sleepTimer.status).toBe("fired")
            expect(onSleepTimer).toHaveBeenCalledTimes(1)
            expect(mixer.getPreferences()).toBe(prefs)
        }
    )

    it("fades both beds for twenty seconds, pauses Voice, skips cues, and waits for intent", async () => {
        const mixer = make({
            sleepTimerChoices: [
                { id: "quick", label: "One second", kind: "duration", durationMs: 1000 },
            ],
        })
        const { music, bed } = await start(mixer)
        const voice = {
            getState: () => ({ status: "playing" as const }),
            subscribe: () => () => {},
            setLevel: vi.fn(),
            setEnabled: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
        }
        mixer.connectVoice(voice)
        mixer.setSleepTimer("quick")
        await settle(1100)
        expect(voice.pause).toHaveBeenCalledTimes(1)
        expect(mixer.playCue("https://a.test/cue.mp3")).toBe(false)
        await settle(10000)
        expect(music.volume).toBeGreaterThan(0)
        expect(music.volume).toBeLessThan(0.25)
        expect(bed.volume).toBeLessThan(0.3)
        await settle(10100)
        expect(music.paused).toBe(true)
        expect(bed.paused).toBe(true)
        document.dispatchEvent(new Event("scroll"))
        document.dispatchEvent(new Event("pointerup"))
        mixer.playSoundscape(score, { scene: "chapter-2" })
        mixer.startAtmosphere()
        setVisibility("hidden")
        setVisibility("visible")
        await settle()
        expect(FakeAudio.withSrc(score.audioFile)).toHaveLength(0)
        expect(mixer.getState().sleepTimer.status).toBe("fired")
        mixer.resumeAudio()
        await settle()
        expect(mixer.getState().sleepTimer.status).toBe("off")
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        expect(mixer.getState().layers.atmosphere.status).toBe("playing")
    })

    it("honors expiration while hidden even when no timeout ran", async () => {
        const mixer = make({ sleepFadeMs: 0 })
        const { music } = await start(mixer)
        mixer.setSleepTimer("15-minutes")
        setVisibility("hidden")
        vi.setSystemTime(Date.now() + 16 * 60000)
        setVisibility("visible")
        await settle()
        expect(music.playCalls).toBe(1)
        expect(mixer.getState().sleepTimer.status).toBe("fired")
        expect(mixer.getState().layers.soundscapes.status).toBe("idle")
    })

    it("does not start narration that the reader had already paused when sleep resumes", async () => {
        const mixer = make({ sleepFadeMs: 0 })
        const voice = {
            getState: () => ({ status: "paused" as const }),
            subscribe: () => () => {},
            setLevel: vi.fn(),
            setEnabled: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
        }
        mixer.connectVoice(voice)
        await start(mixer)
        mixer.setSleepTimer("chapter-end")
        mixer.notifyChapterEnd()
        mixer.resumeAudio()
        await settle()
        expect(voice.resume).not.toHaveBeenCalled()
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
    })

    it("fires End of chapter only on the host signal; emits an event and resumes on a new choice", async () => {
        const mixer = make({ sleepFadeMs: 0 })
        const fired = vi.fn()
        const unsubscribe = mixer.subscribeSleep(fired)
        await start(mixer)
        mixer.setSleepTimer("chapter-end")
        await settle(3600000)
        expect(fired).not.toHaveBeenCalled()
        mixer.notifyChapterEnd()
        mixer.notifyChapterEnd()
        expect(fired).toHaveBeenCalledTimes(1)
        unsubscribe()
        mixer.setSleepTimer("30-minutes")
        await settle()
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        expect(mixer.getState().sleepTimer.status).toBe("running")
    })

    it("cancels, rejects unknown choices, and clears all session timers on stopAll", async () => {
        const mixer = make({ idleTimeoutMs: 1000 })
        await start(mixer)
        mixer.setSleepTimer("15-minutes")
        mixer.setSleepTimer("unknown")
        expect(mixer.getState().sleepTimer.choiceId).toBe("15-minutes")
        mixer.cancelSleepTimer()
        expect(mixer.getState().sleepTimer.status).toBe("off")
        mixer.setSleepTimer("chapter-end")
        mixer.stopAll({ fadeMs: 0 })
        await settle(100000)
        expect(mixer.getState().sleepTimer.status).toBe("off")
        expect(mixer.getState().idle).toBe(false)
        mixer.notifyChapterEnd()
        expect(mixer.getState().sleepTimer.status).toBe("off")
        expect(mixer.getState().soundscapePlays).toBe(0)
    })

    it("starts a fresh idle window when a new timer explicitly resumes sleep after idle", async () => {
        const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 0, sleepFadeMs: 0 })
        await start(mixer)
        await settle(1100)
        expect(mixer.getState().idle).toBe(true)
        mixer.setSleepTimer("chapter-end")
        mixer.notifyChapterEnd()
        mixer.setSleepTimer("15-minutes")
        await settle()
        expect(mixer.getState().idle).toBe(false)
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        await settle(700)
        expect(mixer.getState().idle).toBe(false)
        await settle(400)
        expect(mixer.getState().idle).toBe(true)
    })
})

describe("idle", () => {
    it("fades, pauses in place and resumes on container scroll in capture phase", async () => {
        const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 1000 })
        const { music, bed } = await start(mixer)
        music.currentTime = 12
        bed.currentTime = 15
        await settle(1400)
        expect(music.volume).toBeGreaterThan(0)
        expect(music.volume).toBeLessThan(0.25)
        await settle(1000)
        expect(music.paused).toBe(true)
        expect(bed.paused).toBe(true)
        const container = document.createElement("div")
        document.body.append(container)
        container.dispatchEvent(new Event("scroll", { bubbles: false }))
        await settle()
        expect(music.paused).toBe(false)
        expect(bed.paused).toBe(false)
        expect(music.currentTime).toBe(12)
        expect(bed.currentTime).toBe(15)
        expect(mixer.getState().idle).toBe(false)
        container.remove()
    })

    it.each(["wheel", "touchstart", "touchmove", "pointerdown", "pointermove", "keydown"])(
        "%s holds off idle",
        async (type) => {
            const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 0 })
            await start(mixer)
            await settle(700)
            document.dispatchEvent(new Event(type))
            await settle(700)
            expect(mixer.getState().idle).toBe(false)
            await settle(400)
            expect(mixer.getState().idle).toBe(true)
        }
    )

    it("retains independent Listen activity until every holder releases", async () => {
        const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 0 })
        await start(mixer)
        const release = mixer.retainActivity()
        const other = mixer.retainActivity()
        await settle(3000)
        release()
        release()
        await settle(3000)
        expect(mixer.getState().idle).toBe(false)
        other()
        await settle(1100)
        expect(mixer.getState().idle).toBe(true)
    })

    it("playing connected Voice holds activity automatically, then restarts the idle clock", async () => {
        const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 0 })
        await start(mixer)
        let status: "playing" | "paused" = "playing"
        let update = () => {}
        mixer.connectVoice({
            getState: () => ({ status }),
            subscribe: (listener) => {
                update = listener
                return () => {}
            },
            setLevel: vi.fn(),
            setEnabled: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
        })
        await settle(10000)
        expect(mixer.getState().idle).toBe(false)
        status = "paused"
        update()
        await settle(1100)
        expect(mixer.getState().idle).toBe(true)
    })

    it("does not resume stale idle loops on returning to a hidden page", async () => {
        const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 0 })
        const { music } = await start(mixer)
        setVisibility("hidden")
        vi.setSystemTime(Date.now() + 2000)
        setVisibility("visible")
        await settle()
        expect(music.playCalls).toBe(1)
        expect(mixer.getState().idle).toBe(true)
        document.dispatchEvent(new Event("scroll"))
        await settle()
        expect(music.playCalls).toBe(2)
    })

    it("reports a blocked idle resume and recovers on the next activation", async () => {
        const mixer = make({ idleTimeoutMs: 1000, idleFadeMs: 0 })
        await start(mixer)
        await settle(1100)
        FakeAudio.playBehavior = "not-allowed"
        document.dispatchEvent(new Event("scroll"))
        await settle()
        expect(mixer.getState().layers.soundscapes.status).toBe("blocked")
        FakeAudio.playBehavior = "resolve"
        document.dispatchEvent(new Event("pointerup"))
        await settle()
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
    })
})

describe("music rest", () => {
    it("rests after two plays while Atmosphere continues; a new scene or track restarts", async () => {
        const mixer = make({ soundscapeRestFadeMs: 1000 })
        const { music, bed } = await start(mixer)
        music.duration = 4
        music.dispatch("loadedmetadata")
        const standby = FakeAudio.withSrc(score.audioFile)[1]
        standby.duration = 4
        standby.dispatch("loadedmetadata")
        await settle(3790)
        expect(mixer.getState().soundscapePlays).toBe(1)
        await settle(3400)
        expect(mixer.getState().layers.soundscapes.status).toBe("resting")
        expect(mixer.getState().soundscapePlays).toBe(2)
        await settle(1100)
        expect(music.paused).toBe(true)
        expect(standby.paused).toBe(true)
        expect(bed.paused).toBe(false)
        mixer.playSoundscape(score, { scene: "chapter-1" })
        await settle()
        expect(mixer.getState().layers.soundscapes.status).toBe("resting")
        mixer.playSoundscape(score, { scene: "chapter-2" })
        await settle()
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        expect(mixer.getState().soundscapePlays).toBe(0)
        mixer.playSoundscape({ ...score, id: "different" }, { scene: "chapter-2" })
        await settle()
        expect(mixer.getState().layers.soundscapes.current).toBe("id:different")
    })

    it("allows configurable single-play rests", async () => {
        const mixer = make({ soundscapeMaxPlays: 1, soundscapeRestFadeMs: 0 })
        const { music } = await start(mixer)
        music.duration = 4
        music.dispatch("loadedmetadata")
        await settle(4050)
        expect(mixer.getState().layers.soundscapes.status).toBe("resting")
    })

    it("keeps repeating beyond the default limit when never-rest is selected", async () => {
        const mixer = make({ soundscapeMaxPlays: null })
        const { music } = await start(mixer)
        music.duration = 4
        music.dispatch("loadedmetadata")
        const standby = FakeAudio.withSrc(score.audioFile)[1]
        standby.duration = 4
        standby.dispatch("loadedmetadata")
        await settle(17000)
        expect(mixer.getState().soundscapePlays).toBeGreaterThanOrEqual(4)
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        expect(FakeAudio.withSrc(score.audioFile).some((deck) => !deck.paused)).toBe(true)
    })

    it("lets the old score rest without cancelling a replacement still waiting to start", async () => {
        const mixer = make({ soundscapeMaxPlays: 1, soundscapeRestFadeMs: 1000 })
        const { music } = await start(mixer)
        music.duration = 4
        music.dispatch("loadedmetadata")
        let resolveReplacement = () => {}
        FakeAudio.playBehavior = () =>
            new Promise<void>((resolve) => {
                resolveReplacement = resolve
            })
        const next = { ...score, id: "next", audioFile: "https://a.test/next.mp3" }
        mixer.playSoundscape(next, { scene: "chapter-2" })
        await settle(4100)
        expect(music.paused).toBe(true)
        expect(mixer.getState().layers.soundscapes.status).toBe("resting")
        resolveReplacement()
        await settle()
        expect(mixer.getState().layers.soundscapes.current).toBe("id:next")
        expect(mixer.getState().layers.soundscapes.status).toBe("playing")
        expect(mixer.getState().soundscapePlays).toBe(0)
    })
})
