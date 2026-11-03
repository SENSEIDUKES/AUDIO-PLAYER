// @vitest-environment jsdom
import { createElement, useEffect, type ReactNode } from "react"
import { act, render, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioSessionProvider, useAudioSessionCueTarget } from "../../session/AudioSessionContext"
import { createCueManifestPlugin } from "../CueManifestPlugin"
import { CueRuntime } from "../cueRuntime"
import { CUE_ACTION_SUPPORT, describeCueManifestSupport } from "../cueSupport"
import { useNarrativeCueController } from "../useNarrativeCueController"
import type { CueAction, CueManifest } from "../cueTypes"
import type { PluginPlayerContext, PluginSoundScope } from "../../core/plugins/PluginInterface"
import type { Track } from "../../types"
import type { ReaderMixer } from "../../narrative/ReaderMixer"
import { flushMicrotasks } from "../../narrative/__tests__/fakeMedia"

const sceneManifest: CueManifest = {
    version: "sap-cues/1",
    id: "scene",
    cues: [
        {
            id: "tavern",
            trigger: { kind: "scene", value: "tavern" },
            actions: [{ command: "event.emit", eventName: "scene:hit" }],
        },
    ],
}
const track = (cueManifest: CueManifest): Track => ({
    id: "t",
    title: "t",
    artist: "",
    audioFile: "/voice.mp3",
    cueManifest,
})

function Probe({ onTarget }: { onTarget: (target: EventTarget | null) => void }) {
    const target = useAudioSessionCueTarget()
    useEffect(() => onTarget(target), [target, onTarget])
    return null
}

describe("cue events are scoped to their session", () => {
    afterEach(() => vi.restoreAllMocks())

    function mountReaders(options: { shareWindow?: boolean } = {}) {
        const targets: Array<EventTarget | null> = [null, null]
        const hits = [vi.fn(), vi.fn()]
        const tree: ReactNode[] = [0, 1].map((index) =>
            createElement(AudioSessionProvider, {
                key: index,
                initialQueue: [track(sceneManifest)],
                plugins: [createCueManifestPlugin()],
                cueEventTarget: options.shareWindow && index === 0 ? window : undefined,
                children: createElement(Probe, {
                    onTarget: (target: EventTarget | null) => {
                        targets[index] = target
                    },
                }),
            })
        )
        return { tree, targets, hits }
    }

    it("one reader's scene dispatch cannot trigger another reader", async () => {
        const { tree, targets, hits } = mountReaders()
        render(createElement("div", null, ...tree))
        await act(async () => {
            await flushMicrotasks()
        })
        const [a, b] = targets as [EventTarget, EventTarget]
        expect(a).not.toBe(b)
        a.addEventListener("scene:hit", hits[0])
        b.addEventListener("scene:hit", hits[1])

        act(() => {
            a.dispatchEvent(
                new CustomEvent("sap-dispatch-cue", { detail: { kind: "scene", value: "tavern" } })
            )
        })
        expect(hits[0]).toHaveBeenCalledTimes(1)
        expect(hits[1]).not.toHaveBeenCalled()

        // Nothing is listening on the page-wide target any more.
        const onWindow = vi.fn()
        window.addEventListener("scene:hit", onWindow)
        act(() => {
            window.dispatchEvent(
                new CustomEvent("sap-dispatch-cue", { detail: { kind: "scene", value: "tavern" } })
            )
        })
        window.removeEventListener("scene:hit", onWindow)
        expect(hits[0]).toHaveBeenCalledTimes(1)
        expect(hits[1]).not.toHaveBeenCalled()
        expect(onWindow).not.toHaveBeenCalled()
    })

    it("a host can opt back into the page-wide window channel", async () => {
        const { tree, targets } = mountReaders({ shareWindow: true })
        render(createElement("div", null, ...tree))
        await act(async () => {
            await flushMicrotasks()
        })
        expect(targets[0]).toBe(window)
        const onWindow = vi.fn()
        window.addEventListener("scene:hit", onWindow)
        act(() => {
            window.dispatchEvent(
                new CustomEvent("sap-dispatch-cue", { detail: { kind: "scene", value: "tavern" } })
            )
        })
        window.removeEventListener("scene:hit", onWindow)
        expect(onWindow).toHaveBeenCalledTimes(1)
    })
})

describe("narrative cue actions", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    function mountController(options: Parameters<typeof useNarrativeCueController>[0] = {}) {
        const wrapper = ({ children }: { children: ReactNode }) =>
            createElement(AudioSessionProvider, null, children)
        return renderHook(
            () => ({
                controller: useNarrativeCueController(options),
                target: useAudioSessionCueTarget(),
            }),
            { wrapper }
        )
    }

    /** Dispatch the way the runtime does and report whether a handler claimed it. */
    const send = (target: EventTarget, action: CueAction) => {
        let claimed = false
        act(() => {
            claimed = !target.dispatchEvent(
                new CustomEvent("sap-narrative-cue", { detail: action, cancelable: true })
            )
        })
        return claimed
    }

    it("applies and claims crossfade (with duration), ducking and layers", () => {
        const { result } = mountController()
        const target = result.current.target!

        expect(
            send(target, { command: "ambience.crossfade", profile: "rain", durationMs: 2500 })
        ).toBe(true)
        expect(result.current.controller.narrativeOptions).toMatchObject({
            ambientProfile: "rain",
            crossfadeMs: 2500,
        })
        // A crossfade without a duration returns to the default rather than keeping the last one.
        send(target, { command: "ambience.crossfade", profile: "wind" })
        expect(result.current.controller.narrativeOptions.crossfadeMs).toBeUndefined()

        expect(send(target, { command: "duck.set", amount: 0.3 })).toBe(true)
        expect(result.current.controller.narrativeOptions.duckAmount).toBe(0.3)

        expect(send(target, { command: "layer.set", layer: "intensity", state: 0.4 })).toBe(true)
        expect(send(target, { command: "layer.set", layer: "mood", state: "dread" })).toBe(true)
        expect(send(target, { command: "layer.set", layer: "crowd", state: "loud" })).toBe(true)
        expect(result.current.controller.narrativeOptions).toMatchObject({
            intensity: 0.4,
            sceneMood: "dread",
        })
        expect(result.current.controller.layers).toEqual({
            intensity: 0.4,
            mood: "dread",
            crowd: "loud",
        })
    })

    it("ramps narration volume over the requested duration", () => {
        const { result } = mountController()
        const target = result.current.target!

        expect(
            send(target, { command: "volume.fadeNarration", volume: 0.2, durationMs: 1000 })
        ).toBe(true)
        act(() => {
            vi.advanceTimersByTime(500)
        })
        const mid = result.current.controller.narrativeOptions.narrationVolume!
        expect(mid).toBeGreaterThan(0.2)
        expect(mid).toBeLessThan(1)
        act(() => {
            vi.advanceTimersByTime(600)
        })
        expect(result.current.controller.narrativeOptions.narrationVolume).toBeCloseTo(0.2)
    })

    it("starts a narration fade from the mixer's Voice level, not the session volume", () => {
        const mixer = {
            getState: () => ({ preferences: { layers: { voice: { level: 0.2 } } } }),
        } as unknown as ReaderMixer
        const { result } = mountController({ mixer })

        send(result.current.target!, {
            command: "volume.fadeNarration",
            volume: 0,
            durationMs: 1000,
        })
        act(() => {
            vi.advanceTimersByTime(50)
        })
        const first = result.current.controller.narrativeOptions.narrationVolume!
        expect(first).toBeLessThanOrEqual(0.2) // session volume (1) would have jumped to ~0.95
        expect(first).toBeGreaterThan(0.1)
        act(() => {
            vi.advanceTimersByTime(1100)
        })
        expect(result.current.controller.narrativeOptions.narrationVolume).toBeCloseTo(0)
    })

    it("leaves spatial.pan unclaimed so the runtime reports it as unhandled", () => {
        const { result } = mountController()
        expect(send(result.current.target!, { command: "spatial.pan", x: -1, y: 0, z: 0 })).toBe(
            false
        )
    })

    it("the runtime reports claimed actions as executed and unclaimed ones as skipped", () => {
        const { result } = mountController()
        const target = result.current.target!
        const outcome = vi.fn()
        const context: PluginPlayerContext = {
            getEngine: () => ({}) as never,
            getRootElement: () => null,
            getEventTarget: () => target,
            getAudioElement: () => null,
            getCurrentTrack: () => null,
            getNextTrack: () => null,
            getSourceKey: () => "test",
        }
        const runtime = new CueRuntime(
            context,
            {
                version: "sap-cues/1",
                cues: [
                    {
                        id: "all",
                        trigger: { kind: "scene", value: "x" },
                        actions: [
                            { command: "ambience.crossfade", profile: "rain" },
                            { command: "spatial.pan", x: 1, y: 0, z: 0 },
                        ],
                    },
                ],
            },
            { onOutcome: outcome }
        )
        act(() => runtime.executeCueByTrigger("scene", "x"))

        expect(outcome).toHaveBeenCalledWith(
            expect.objectContaining({ command: "ambience.crossfade", outcome: "executed" })
        )
        expect(outcome).toHaveBeenCalledWith(
            expect.objectContaining({
                command: "spatial.pan",
                outcome: "skipped",
                reason: "no-host-handler",
            })
        )
    })
})

describe("sprite fades and the support map", () => {
    afterEach(() => vi.restoreAllMocks())

    it("starts a fade-in sprite from silence and ramps it to the target volume", async () => {
        const sound: PluginSoundScope = {
            loadSpritePack: vi.fn().mockResolvedValue(undefined),
            playSprite: vi.fn().mockReturnValue("id-1"),
            stopSprite: vi.fn(),
            fadeSprite: vi.fn(),
            stopAllSprites: vi.fn(),
            dispose: vi.fn(),
        }
        const context: PluginPlayerContext = {
            sounds: { ...sound, createScope: () => sound },
            getEngine: () => ({}) as never,
            getRootElement: () => null,
            getEventTarget: () => new EventTarget(),
            getAudioElement: () => null,
            getCurrentTrack: () => null,
            getNextTrack: () => null,
            getSourceKey: () => "test",
        }
        const runtime = new CueRuntime(context, {
            version: "sap-cues/1",
            assets: {
                spritePacks: { p: { src: "/p.wav", clips: { hit: { offset: 0, duration: 1 } } } },
            },
            cues: [
                {
                    id: "in",
                    trigger: { kind: "scene", value: "x" },
                    actions: [
                        {
                            command: "sprite.play",
                            pack: "p",
                            clip: "hit",
                            volume: 0.7,
                            fadeInMs: 800,
                        },
                    ],
                },
            ],
        })
        await flushMicrotasks()
        runtime.executeCueByTrigger("scene", "x")

        expect(sound.playSprite).toHaveBeenCalledWith("hit", expect.objectContaining({ volume: 0 }))
        expect(sound.fadeSprite).toHaveBeenCalledWith("id-1", 0.7, 800)
    })

    it("every cue command has a documented handler, and gaps are flagged", () => {
        const commands: CueAction["command"][] = [
            "sprite.play",
            "sprite.stop",
            "sprite.fade",
            "ambience.crossfade",
            "duck.set",
            "volume.fadeNarration",
            "player.seek",
            "player.pause",
            "event.emit",
            "layer.set",
            "spatial.pan",
        ]
        expect(Object.keys(CUE_ACTION_SUPPORT).sort()).toEqual([...commands].sort())

        const report = describeCueManifestSupport({
            version: "sap-cues/1",
            cues: [
                {
                    id: "c",
                    trigger: { kind: "scene", value: "x" },
                    actions: [
                        { command: "event.emit", eventName: "e" },
                        { command: "duck.set", amount: 0.5 },
                        { command: "spatial.pan", x: 0, y: 0, z: 0 },
                    ],
                },
            ],
        })
        expect(report.byHandler).toEqual({
            runtime: ["event.emit"],
            controller: ["duck.set"],
            host: ["spatial.pan"],
        })
        expect(report.needsAttention.map((item) => item.command)).toEqual([
            "duck.set",
            "spatial.pan",
        ])
    })
})
