// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSceneMixEngine } from "../SceneMixEngine"
import { createOneShotEngine } from "../OneShotEngine"
import type { MediaGainSink } from "../mediaRouting"
import type { Track } from "../../types"
import { FakeAudio, flushMicrotasks } from "./fakeMedia"

vi.mock("../../automix/silenceAnalysis", () => ({
    ensureSourceAnalysis: vi.fn(() => Promise.resolve(null)),
}))

const A: Track = { id: "a", title: "A", artist: "", audioFile: "https://a.test/a.mp3" }
const B: Track = { id: "b", title: "B", artist: "", audioFile: "https://a.test/b.mp3" }

const last = (values: number[]): number => values[values.length - 1]

type RecordingSink = MediaGainSink & { gains: number[]; disposed: boolean; element: unknown }

function sinkRecorder() {
    const sinks: RecordingSink[] = []
    const factory = (element: HTMLAudioElement): MediaGainSink => {
        const sink: RecordingSink = {
            element,
            gains: [],
            disposed: false,
            setGain(value) {
                sink.gains.push(value)
            },
            dispose() {
                sink.disposed = true
            },
        }
        sinks.push(sink)
        return sink
    }
    return { sinks, factory }
}

describe("narrative engine routing hooks", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        FakeAudio.reset()
        vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    describe("SceneMixEngine", () => {
        it("fades through a gain sink, even where element volume is locked", async () => {
            FakeAudio.volumeLocked = true
            const { sinks, factory } = sinkRecorder()
            const mix = createSceneMixEngine({ createGainSink: factory, analysisPolicy: "off" })
            mix.setLevel(0.5)
            mix.crossfadeTo(A, { fadeMs: 0 })
            await flushMicrotasks()
            vi.advanceTimersByTime(40)
            mix.crossfadeTo(B, { fadeMs: 1000 })
            await flushMicrotasks()
            vi.advanceTimersByTime(500)

            const [first, second] = sinks
            expect(last(first.gains)).toBeGreaterThan(0)
            expect(last(first.gains)).toBeLessThan(0.5)
            expect(last(second.gains)).toBeGreaterThan(0)
            expect(last(second.gains)).toBeLessThan(0.5)
            expect(mix.getVolumeWritesUnsupported()).toBe(false)

            vi.advanceTimersByTime(600)
            expect(first.disposed).toBe(true)
            expect(last(second.gains)).toBeCloseTo(0.5)
            mix.dispose()
            expect(second.disposed).toBe(true)
        })

        it("falls back to element volume when the factory declines", async () => {
            const mix = createSceneMixEngine({ createGainSink: () => null, analysisPolicy: "off" })
            mix.setLevel(0.4)
            mix.crossfadeTo(A, { fadeMs: 0 })
            await flushMicrotasks()
            vi.advanceTimersByTime(40)
            expect(FakeAudio.withSrc("https://a.test/a.mp3")[0].volume).toBeCloseTo(0.4)
            mix.dispose()
        })

        it("pauses in place, defers switches, and resumes", async () => {
            const mix = createSceneMixEngine({ analysisPolicy: "off" })
            mix.crossfadeTo(A, { fadeMs: 0 })
            await flushMicrotasks()
            vi.advanceTimersByTime(40)
            const deck = FakeAudio.withSrc("https://a.test/a.mp3")[0]

            mix.pause()
            expect(mix.isPaused()).toBe(true)
            expect(deck.paused).toBe(true)
            mix.crossfadeTo(B)
            expect(FakeAudio.withSrc("https://a.test/b.mp3")).toHaveLength(0)
            expect(mix.getStatusSnapshot().requestedTrackKey).toBe("id:b")

            mix.resume()
            await flushMicrotasks()
            expect(deck.paused).toBe(false)
            expect(FakeAudio.withSrc("https://a.test/b.mp3")).toHaveLength(1)
            mix.dispose()
        })

        it("finishes an in-flight fade when paused", async () => {
            const mix = createSceneMixEngine({ analysisPolicy: "off" })
            mix.crossfadeTo(A, { fadeMs: 0 })
            await flushMicrotasks()
            vi.advanceTimersByTime(40)
            mix.crossfadeTo(B, { fadeMs: 2000 })
            await flushMicrotasks()
            vi.advanceTimersByTime(500)

            mix.pause()
            expect(FakeAudio.withSrc("https://a.test/a.mp3")).toHaveLength(0)
            expect(FakeAudio.withSrc("https://a.test/b.mp3")[0].volume).toBe(1)
            mix.dispose()
        })

        it("reports a blocked resume and retries it on the next gesture", async () => {
            const mix = createSceneMixEngine({ analysisPolicy: "off" })
            mix.crossfadeTo(A, { fadeMs: 0 })
            await flushMicrotasks()
            mix.pause()
            FakeAudio.playBehavior = "not-allowed"
            mix.resume()
            await flushMicrotasks()
            expect(mix.getStatusSnapshot().state).toBe("autoplay-blocked")

            FakeAudio.playBehavior = "resolve"
            document.dispatchEvent(new Event("touchend"))
            await flushMicrotasks()
            expect(mix.getStatusSnapshot().state).toBe("playing")
            mix.dispose()
        })

        it("retries a blocked resume and a blocked deferred switch on one gesture", async () => {
            const mix = createSceneMixEngine({ analysisPolicy: "off" })
            mix.crossfadeTo(A, { fadeMs: 0 })
            await flushMicrotasks()
            vi.advanceTimersByTime(40)
            mix.pause()
            mix.crossfadeTo(B, { fadeMs: 0 })

            FakeAudio.playBehavior = "not-allowed"
            mix.resume()
            await flushMicrotasks()
            const deckA = FakeAudio.withSrc("https://a.test/a.mp3")[0]
            const deckB = FakeAudio.withSrc("https://a.test/b.mp3")[0]
            expect(deckA.paused).toBe(true)
            expect(deckB.paused).toBe(true)
            expect(mix.getStatusSnapshot().state).toBe("autoplay-blocked")

            FakeAudio.playBehavior = "resolve"
            document.dispatchEvent(new Event("pointerup"))
            await flushMicrotasks()
            expect(deckA.paused).toBe(false)
            expect(deckB.paused).toBe(false)
            expect(mix.getStatusSnapshot()).toMatchObject({
                state: "playing",
                audibleTrackKey: "id:b",
            })
            mix.dispose()
        })

        it("stops immediately while paused", () => {
            const mix = createSceneMixEngine({ analysisPolicy: "off" })
            mix.pause()
            mix.crossfadeTo(A)
            mix.stop()
            mix.resume()
            expect(FakeAudio.withSrc("https://a.test/a.mp3")).toHaveLength(0)
            expect(mix.getStatusSnapshot().state).toBe("stopped")
            mix.dispose()
        })

        it("takes the next deck from the elements unlock() primed", () => {
            const mix = createSceneMixEngine({ analysisPolicy: "off", unlockPoolSize: 1 })
            mix.unlock()
            const [spare] = FakeAudio.created
            expect(spare.loadCalls).toBe(1)
            mix.crossfadeTo(A)
            expect(spare.src).toBe("https://a.test/a.mp3")
            expect(FakeAudio.created).toHaveLength(1)
            mix.dispose()
        })
    })

    describe("OneShotEngine", () => {
        it("applies level × per-play volume through a gain sink", () => {
            const { sinks, factory } = sinkRecorder()
            const shots = createOneShotEngine({ createGainSink: factory, level: 0.5 })
            shots.playOneShot("https://a.test/hit.mp3", { volume: 0.5 })
            expect(last(sinks[0].gains)).toBeCloseTo(0.25)
            shots.setLevel(1)
            expect(last(sinks[0].gains)).toBeCloseTo(0.5)
            shots.dispose()
            expect(sinks[0].disposed).toBe(true)
        })

        it("reports refused cues and the number playing", async () => {
            const onPlaybackError = vi.fn()
            const onActiveCountChange = vi.fn()
            const shots = createOneShotEngine({ onPlaybackError, onActiveCountChange })

            shots.playOneShot("https://a.test/hit.mp3")
            shots.playOneShot("https://a.test/hit.mp3")
            expect(shots.getActiveCount()).toBe(2)
            expect(onActiveCountChange).toHaveBeenLastCalledWith(2)

            await flushMicrotasks()
            FakeAudio.withSrc("https://a.test/hit.mp3")[0].dispatch("ended")
            expect(onActiveCountChange).toHaveBeenLastCalledWith(1)

            FakeAudio.playBehavior = "not-allowed"
            shots.playOneShot("https://a.test/blocked.mp3")
            await flushMicrotasks()
            expect(onPlaybackError).toHaveBeenCalledWith({
                url: "https://a.test/blocked.mp3",
                reason: "autoplay-blocked",
            })

            FakeAudio.playBehavior = "reject"
            shots.playOneShot("https://a.test/broken.mp3")
            await flushMicrotasks()
            expect(onPlaybackError).toHaveBeenLastCalledWith({
                url: "https://a.test/broken.mp3",
                reason: "failed",
            })
            shots.dispose()
        })

        it("uses primed spares for new cues", () => {
            const shots = createOneShotEngine({ unlockPoolSize: 2 })
            shots.unlock()
            expect(FakeAudio.created).toHaveLength(2)
            shots.playOneShot("https://a.test/one.mp3")
            shots.playOneShot("https://a.test/two.mp3")
            expect(FakeAudio.created).toHaveLength(2)
            shots.playOneShot("https://a.test/three.mp3")
            expect(FakeAudio.created).toHaveLength(3)
            shots.dispose()
        })
    })
})
