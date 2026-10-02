// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSceneMixEngine, type SceneMixEngine } from "../SceneMixEngine"
import { FakeAudio, flushMicrotasks } from "./fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))
const RAIN = { id: "rain", title: "Rain", artist: "", audioFile: "https://audio.test/rain.mp3" }
const NEXT = { id: "next", title: "Next", artist: "", audioFile: "https://audio.test/next.mp3" }
const engines: SceneMixEngine[] = []
function engine(options: Parameters<typeof createSceneMixEngine>[0] = {}) {
    const instance = createSceneMixEngine({
        analysisPolicy: "off",
        fadeMs: 0,
        loopCrossfadeMs: 250,
        ...options,
    })
    engines.push(instance)
    return instance
}
async function settle(ms = 40) {
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(ms)
}
function metadata(audio: FakeAudio) {
    audio.duration = 4
    audio.dispatch("loadedmetadata")
}
async function start(instance: SceneMixEngine) {
    instance.crossfadeTo(RAIN, { trimStartMs: 1000 })
    const first = FakeAudio.withSrc(RAIN.audioFile)[0]
    metadata(first)
    await settle()
    const second = FakeAudio.withSrc(RAIN.audioFile)[1]
    if (second) metadata(second)
    return { first, second }
}

describe("SceneMixEngine loop boundaries", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeAudio.reset()
        vi.stubGlobal("Audio", FakeAudio)
    })
    afterEach(() => {
        for (const instance of engines.splice(0)) instance.dispose()
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it("prepares a silent trimmed deck and overlaps before the end, reusing two elements for repeated loops", async () => {
        const instance = engine()
        const { first, second } = await start(instance)
        expect(first.loop).toBe(false)
        expect(second.paused).toBe(true)
        expect(second.currentTime).toBe(1)
        expect(second.volume).toBe(0)
        first.currentTime = 3.75
        await settle(2750)
        expect(first.paused).toBe(false)
        expect(second.paused).toBe(false)
        await settle(125)
        expect(first.volume).toBeGreaterThan(0)
        expect(first.volume).toBeLessThan(1)
        expect(second.volume).toBeGreaterThan(0)
        expect(second.volume).toBeLessThan(1)
        await settle(165)
        expect(first.paused).toBe(true)
        expect(first.currentTime).toBe(1)
        expect(second.volume).toBe(1)
        expect(FakeAudio.withSrc(RAIN.audioFile)).toHaveLength(2)
        await settle(2750)
        expect(first.paused).toBe(false)
        await settle(300)
        expect(second.currentTime).toBe(1)
        expect(FakeAudio.created).toHaveLength(2)
        instance.dispose()
        expect(FakeAudio.withSrc(RAIN.audioFile)).toHaveLength(0)
        expect(vi.getTimerCount()).toBe(0)
    })

    it("keeps self-looping the old score while a requested score has not started", async () => {
        const instance = engine()
        const { first, second } = await start(instance)
        let finish: (() => void) | undefined
        FakeAudio.playBehavior = (audio) =>
            audio.src === NEXT.audioFile
                ? new Promise<void>((resolve) => {
                      finish = resolve
                  })
                : Promise.resolve()
        instance.crossfadeTo(NEXT)
        await settle(2750)
        expect(second.paused).toBe(false)
        expect(instance.getStatusSnapshot()).toMatchObject({
            state: "loading",
            requestedTrackKey: "id:next",
            audibleTrackKey: "id:rain",
        })
        expect(first.src).toBe(RAIN.audioFile)
        finish!()
        await settle()
        expect(instance.getCurrentTrackKey()).toBe("id:next")
        await settle(300)
        expect(FakeAudio.withSrc(RAIN.audioFile)).toHaveLength(0)
    })

    it("cancels standby deadlines and the boundary timer while paused, and resumes at the saved position", async () => {
        const instance = engine({ attemptTimeoutMs: 1000 })
        const { first, second } = await start(instance)
        first.currentTime = 2
        instance.pause()
        expect(second.src).toBe("")
        await settle(5000)
        expect(first.playCalls).toBe(1)
        expect(vi.getTimerCount()).toBe(0)
        instance.resume()
        await settle()
        expect(first.currentTime).toBe(2)
        expect(first.paused).toBe(false)
        expect(FakeAudio.withSrc(RAIN.audioFile)).toHaveLength(2)
    })

    it("keeps the bed alive when a standby load fails and honors trim on the ended recovery", async () => {
        const instance = engine({ attemptTimeoutMs: 1000, maxRetries: 0 })
        const { first, second } = await start(instance)
        second.dispatch("error")
        expect(first.paused).toBe(false)
        expect(instance.getStatusSnapshot().state).toBe("playing")
        first.currentTime = 4
        first.dispatch("ended")
        await settle()
        expect(first.currentTime).toBe(1)
        expect(first.paused).toBe(false)
        expect(first.playCalls).toBe(2)
    })

    it("reconciles a mid-loop failure without promoting a silent standby to the audible owner", async () => {
        const instance = engine({ maxRetries: 1, retryDelayMs: 10 })
        const { first, second } = await start(instance)
        first.currentTime = 2.5
        first.dispatch("error")
        expect(second.src).toBe("")
        await settle(10)
        const retry = FakeAudio.withSrc(RAIN.audioFile)[0]
        metadata(retry)
        await settle()
        expect(retry.currentTime).toBe(2.5)
        expect(retry.paused).toBe(false)
    })

    it("does not park or revive a loop deck when a host gain callback stops the engine during retirement", async () => {
        let stopOnZero = false
        let retiring: unknown
        const instance = engine({
            createGainSink: (element) => ({
                setGain: (gain) => {
                    if (stopOnZero && element === retiring && gain === 0) instance.stop(0)
                },
                dispose: () => {},
            }),
        })
        const { first } = await start(instance)
        retiring = first
        await settle(2750)
        stopOnZero = true
        await settle(300)
        expect(FakeAudio.withSrc(RAIN.audioFile)).toHaveLength(0)
        expect(vi.getTimerCount()).toBe(0)
        expect(instance.getStatusSnapshot().state).toBe("stopped")
    })

    it("retains the standalone native-loop default", async () => {
        const instance = engine({ loopCrossfadeMs: 0 })
        const { first } = await start(instance)
        expect(first.loop).toBe(true)
        expect(FakeAudio.withSrc(RAIN.audioFile)).toHaveLength(1)
    })
})
