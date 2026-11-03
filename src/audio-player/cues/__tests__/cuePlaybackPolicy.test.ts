// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CueRuntime } from "../cueRuntime"
import { createCueManifestPlugin } from "../CueManifestPlugin"
import type { CueEvent, CueManifest } from "../cueTypes"
import type { PluginPlayerContext, PluginSoundScope } from "../../core/plugins/PluginInterface"
import type { Track } from "../../types"
import { flushMicrotasks, setVisibility } from "../../narrative/__tests__/fakeMedia"

/** Cue that emits `cue:<id>` on the context's private event target when it fires. */
const cue = (id: string, at: number, extra: Partial<CueEvent> = {}): CueEvent => ({
    id,
    trigger: { kind: "time", at },
    actions: [{ command: "event.emit", eventName: `cue:${id}` }],
    ...extra,
})
const manifestOf = (...cues: CueEvent[]): CueManifest => ({ version: "sap-cues/1", cues })

interface Harness {
    target: EventTarget
    fired: string[]
    context: PluginPlayerContext
    engine: { isPlaying: boolean; isSeeking: boolean; duration: number; currentTime: number }
    position: { value: number }
}

function harness(extra: Partial<PluginPlayerContext> = {}): Harness {
    const target = new EventTarget()
    const fired: string[] = []
    // Listen for every cue name we might use.
    for (const name of ["zero", "a", "b", "c", "five", "end", "x"]) {
        target.addEventListener(`cue:${name}`, () => fired.push(name))
    }
    const engine = { isPlaying: false, isSeeking: false, duration: 60, currentTime: 0 }
    const position = { value: 0 }
    const context = {
        getEngine: () => engine as never,
        getRootElement: () => null,
        getEventTarget: () => target,
        getPlaybackPosition: () => position.value,
        getAudioElement: () => null,
        getCurrentTrack: () => null,
        getNextTrack: () => null,
        getSourceKey: () => "test",
        ...extra,
    } satisfies PluginPlayerContext
    return { target, fired, context, engine, position }
}

describe("CueRuntime playback policy", () => {
    it("does not fire a cue at 0:00 while paused, and fires it when playback starts", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("zero", 0)))
        runtime.setPlaying(false)

        runtime.handleTimeUpdate(0)
        runtime.handleTimeUpdate(0.05)
        expect(h.fired).toEqual([])

        runtime.setPlaying(true, 0)
        expect(h.fired).toEqual(["zero"])
        runtime.setPlaying(false)
        runtime.setPlaying(true, 0)
        expect(h.fired).toEqual(["zero"]) // never twice for one playthrough
    })

    it("ignores position updates while paused", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("five", 5)))
        runtime.setPlaying(true, 3)
        runtime.setPlaying(false)
        runtime.handleTimeUpdate(6)
        expect(h.fired).toEqual([])

        runtime.setPlaying(true, 3)
        runtime.handleTimeUpdate(6)
        expect(h.fired).toEqual(["five"])
    })

    it("treats cues before the resume position as passed; a cue exactly there fires", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("a", 5), cue("b", 30)))
        runtime.setPlaying(true, 30)
        expect(h.fired).toEqual(["b"])
        runtime.handleTimeUpdate(31)
        expect(h.fired).toEqual(["b"])
    })

    it("catches up on a delayed update: every crossed cue fires once, in time order", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("c", 3), cue("a", 1), cue("b", 2)))
        runtime.setPlaying(true, 0)
        runtime.handleTimeUpdate(0.5)
        runtime.handleTimeUpdate(12) // page was hidden: no updates for 11.5s
        expect(h.fired).toEqual(["a", "b", "c"])
        runtime.handleTimeUpdate(13)
        expect(h.fired).toEqual(["a", "b", "c"])
    })

    it("does not play an overdue sprite but still applies its state actions", async () => {
        const sound: PluginSoundScope = {
            loadSpritePack: vi.fn().mockResolvedValue(undefined),
            playSprite: vi.fn().mockReturnValue("sound"),
            stopSprite: vi.fn(),
            fadeSprite: vi.fn(),
            stopAllSprites: vi.fn(),
            dispose: vi.fn(),
        }
        const h = harness({ sounds: { ...sound, createScope: () => sound } })
        const outcome = vi.fn()
        const manifest: CueManifest = {
            version: "sap-cues/1",
            assets: {
                spritePacks: { p: { src: "/p.wav", clips: { hit: { offset: 0, duration: 1 } } } },
            },
            cues: [
                cue("a", 1, {
                    actions: [
                        { command: "sprite.play", pack: "p", clip: "hit" },
                        { command: "event.emit", eventName: "cue:a" },
                    ],
                }),
                cue("b", 20, {
                    actions: [{ command: "sprite.play", pack: "p", clip: "hit" }],
                }),
            ],
        }
        const runtime = new CueRuntime(h.context, manifest, { onOutcome: outcome })
        await flushMicrotasks()
        runtime.setPlaying(true, 0)

        runtime.handleTimeUpdate(10) // cue "a" fires 9s late
        expect(sound.playSprite).not.toHaveBeenCalled()
        expect(outcome).toHaveBeenCalledWith(
            expect.objectContaining({ cueId: "a", outcome: "skipped", reason: "late" })
        )
        expect(h.fired).toEqual(["a"])

        runtime.handleTimeUpdate(20.5) // on time
        expect(sound.playSprite).toHaveBeenCalledTimes(1)
    })

    it("seek: consumes cues behind the target unless fireOnSeek", () => {
        const h = harness()
        const runtime = new CueRuntime(
            h.context,
            manifestOf(cue("a", 5), cue("b", 8, { fireOnSeek: true }))
        )
        runtime.setPlaying(true, 0)
        runtime.handleTimeUpdate(20, true)
        expect(h.fired).toEqual(["b"])
        runtime.handleTimeUpdate(21)
        expect(h.fired).toEqual(["b"])
    })

    it("seek while paused holds fireOnSeek cues until playback resumes", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("b", 8, { fireOnSeek: true })))
        runtime.setPlaying(false)
        runtime.handleTimeUpdate(20, true)
        expect(h.fired).toEqual([])
        runtime.setPlaying(true, 20)
        expect(h.fired).toEqual(["b"])
    })

    it("a newer paused seek supersedes held cues", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("b", 8, { fireOnSeek: true })))
        runtime.setPlaying(false)
        runtime.handleTimeUpdate(20, true)
        runtime.handleTimeUpdate(2, true) // back before the cue
        runtime.setPlaying(true, 2)
        expect(h.fired).toEqual([])
        runtime.handleTimeUpdate(9)
        expect(h.fired).toEqual(["b"])
    })

    it("re-arms a replayable cue at 0:00 when playback loops", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("zero", 0, { replayable: true })))
        runtime.setPlaying(true, 0)
        runtime.handleTimeUpdate(30)
        expect(h.fired).toEqual(["zero"])
        runtime.handleTimeUpdate(0) // loop restart without a seek event
        expect(h.fired).toEqual(["zero", "zero"])
    })

    it("does not mistake small backward jitter for a rewind", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("five", 5, { replayable: true })))
        runtime.setPlaying(true, 4)
        runtime.handleTimeUpdate(5.0)
        runtime.handleTimeUpdate(4.97)
        runtime.handleTimeUpdate(5.2)
        expect(h.fired).toEqual(["five"])
    })

    it("track end flushes the remaining cues once and nothing fires afterwards", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("end", 59.9)))
        runtime.setPlaying(true, 0)
        runtime.handleTimeUpdate(30)
        runtime.handleTrackEnd(60)
        expect(h.fired).toEqual(["end"])
        runtime.handleTimeUpdate(61)
        expect(h.fired).toEqual(["end"])
    })

    it("fires same-id cues in a hand-built manifest independently", () => {
        const h = harness()
        const runtime = new CueRuntime(h.context, manifestOf(cue("x", 1), cue("x", 2)))
        runtime.setPlaying(true, 0)
        runtime.handleTimeUpdate(3)
        expect(h.fired).toEqual(["x", "x"])
    })
})

describe("CueManifestPlugin playback clock", () => {
    const track = (manifest: CueManifest, id = "t"): Track => ({
        id,
        title: id,
        artist: "",
        audioFile: "/voice.mp3",
        cueManifest: manifest,
    })

    beforeEach(() => {
        vi.useFakeTimers()
        setVisibility("visible")
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it("does not fire a cue at zero when the track loads paused, and fires it on play", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("zero", 0))))
        plugin.onTimeUpdate(0)
        vi.advanceTimersByTime(1000)
        expect(h.fired).toEqual([])

        plugin.onPlay()
        expect(h.fired).toEqual(["zero"])
        plugin.destroy()
    })

    it("does not skip a cue at zero when onPlay runs after audio has already advanced", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("zero", 0), cue("a", 0.01))))

        // onPlay is delivered from a React effect: the backend is already 20 ms in.
        h.position.value = 0.02
        plugin.onPlay()
        expect(h.fired).toEqual(["zero", "a"])
        plugin.destroy()
    })

    it("resumes from the pause position so cues crossed before onPlay still fire", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 3.01))))
        plugin.onPlay()
        h.position.value = 3
        plugin.onPause()

        h.position.value = 3.03
        plugin.onPlay()
        expect(h.fired).toEqual(["a"])
        plugin.destroy()
    })

    it("times cues from the live position without any onTimeUpdate calls", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 1))))
        plugin.onPlay()

        h.position.value = 0.5
        vi.advanceTimersByTime(100)
        expect(h.fired).toEqual([])
        h.position.value = 1.05
        vi.advanceTimersByTime(100)
        expect(h.fired).toEqual(["a"])
        plugin.destroy()
    })

    it("prefers the live position over a stale onTimeUpdate argument", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 50))))
        plugin.onPlay()
        h.position.value = 2
        plugin.onTimeUpdate(100) // throttled state would be wrong either way
        expect(h.fired).toEqual([])
        plugin.destroy()
    })

    it("catches up immediately when the page becomes visible again", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 1), cue("b", 2))))
        plugin.onPlay()

        // Timers frozen (backgrounded); audio kept playing.
        h.position.value = 9
        setVisibility("visible")
        expect(h.fired).toEqual(["a", "b"])
        plugin.destroy()
    })

    it("catches up to the pause position, then stops timing", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 3), cue("b", 8))))
        plugin.onPlay()

        h.position.value = 3.05
        plugin.onPause()
        expect(h.fired).toEqual(["a"])

        h.position.value = 9
        vi.advanceTimersByTime(1000)
        expect(h.fired).toEqual(["a"])
        plugin.destroy()
    })

    it("does not sample while a seek is still pending", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 1, { replayable: true }))))
        plugin.onPlay()
        h.position.value = 2
        vi.advanceTimersByTime(100)
        expect(h.fired).toEqual(["a"])

        h.engine.isSeeking = true
        h.position.value = 0 // stale position while the seek settles
        vi.advanceTimersByTime(500)
        expect(h.fired).toEqual(["a"]) // no false rewind re-armed the cue
        plugin.destroy()
    })

    it("a track change mid-gap discards the old manifest's cues", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 5)), "one"))
        plugin.onPlay()
        h.position.value = 4

        h.position.value = 0
        plugin.onTrackLoad(track(manifestOf(cue("b", 1)), "two"))
        plugin.onPlay() // the new source started playing
        h.position.value = 6
        vi.advanceTimersByTime(100)
        expect(h.fired).toEqual(["b"]) // "a" belonged to the previous track
        plugin.destroy()
    })

    it("does not activate a new track's cues from the previous track's stale playing flag", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 5)), "one"))
        h.engine.isPlaying = true
        plugin.onPlay()

        // Track change: the engine flag has not re-rendered yet and the new source is loading.
        plugin.onTrackLoad(track(manifestOf(cue("zero", 0)), "two"))
        h.position.value = 0.02
        vi.advanceTimersByTime(1000)
        expect(h.fired).toEqual([])

        plugin.onPlay() // playback of the new source confirmed
        expect(h.fired).toEqual(["zero"])
        plugin.destroy()
    })

    it("confirms a new source from the media element when no play hook arrives", () => {
        const element = { paused: true, readyState: 0, seeking: false }
        const h = harness({ getAudioElement: () => element as unknown as HTMLAudioElement })
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 5)), "one"))
        h.engine.isPlaying = true
        plugin.onPlay()

        plugin.onTrackLoad(track(manifestOf(cue("zero", 0)), "two"))
        vi.advanceTimersByTime(500)
        expect(h.fired).toEqual([]) // still loading

        element.paused = false
        element.readyState = 4
        h.position.value = 0.03
        vi.advanceTimersByTime(100)
        expect(h.fired).toEqual(["zero"])
        plugin.destroy()
    })

    it("fires cues up to the end on track end, never claims the advance, and stops", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("end", 59.9))))
        plugin.onPlay()
        h.position.value = 30
        vi.advanceTimersByTime(100)

        h.engine.duration = 60
        expect(plugin.onTrackEnded()).toBe(false)
        expect(h.fired).toEqual(["end"])
        h.position.value = 61
        vi.advanceTimersByTime(1000)
        expect(h.fired).toEqual(["end"])
        plugin.destroy()
    })

    it("a seek event is applied even while paused (held), then fires on play", () => {
        const h = harness()
        const plugin = createCueManifestPlugin()
        plugin.init(h.context)
        plugin.onTrackLoad(track(manifestOf(cue("a", 8, { fireOnSeek: true }))))
        h.position.value = 20
        plugin.onSeek(20)
        expect(h.fired).toEqual([])
        plugin.onPlay()
        expect(h.fired).toEqual(["a"])
        plugin.destroy()
    })
})
