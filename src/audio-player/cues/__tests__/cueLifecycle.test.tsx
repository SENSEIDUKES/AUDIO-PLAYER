// @vitest-environment jsdom
import { StrictMode, useEffect, useMemo } from "react"
import { renderHook, act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CueRuntime } from "../cueRuntime"
import { createCueManifestPlugin } from "../CueManifestPlugin"
import { usePluginSoundLayer } from "../../core/audio/usePluginSoundLayer"
import { usePluginManager } from "../../core/plugins/usePluginManager"
import type { PluginPlayerContext, PluginSoundScope } from "../../core/plugins/PluginInterface"
import type { CueManifest } from "../cueTypes"
import type { Track } from "../../types"
import { FakeAudioContext, flushMicrotasks } from "../../narrative/__tests__/fakeMedia"

const manifest: CueManifest = {
    version: "sap-cues/1",
    id: "test",
    assets: {
        spritePacks: {
            first: { src: "/first.wav", clips: { chime: { offset: 0, duration: 1 } } },
            second: { src: "/second.wav", clips: { chime: { offset: 2, duration: 1 } } },
        },
    },
    cues: [
        {
            id: "first",
            trigger: { kind: "time", at: 1 },
            replayable: true,
            actions: [
                { command: "sprite.play", pack: "first", clip: "chime" },
                { command: "event.emit", eventName: "beat" },
            ],
        },
        {
            id: "second",
            trigger: { kind: "chapter", value: 2 },
            actions: [{ command: "sprite.play", pack: "second", clip: "chime" }],
        },
    ],
}
const track = (value = manifest): Track => ({
    id: "test",
    title: "test",
    artist: "",
    audioFile: "/voice.mp3",
    cueManifest: value,
})
function context(sounds?: PluginPlayerContext["sounds"]): PluginPlayerContext {
    return {
        sounds,
        getEngine: () => ({}) as never,
        getRootElement: () => null,
        getAudioElement: () => null,
        getCurrentTrack: () => null,
        getNextTrack: () => null,
        getSourceKey: () => "test",
    }
}
function scope(): PluginSoundScope {
    return {
        loadSpritePack: vi.fn().mockResolvedValue(undefined),
        playSprite: vi.fn().mockReturnValue("sound"),
        stopSprite: vi.fn(),
        fadeSprite: vi.fn(),
        stopAllSprites: vi.fn(),
        dispose: vi.fn(),
    }
}
afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("cue readiness and ownership", () => {
    it("skips loading cues once, keeps independent actions, and supports explicit retrigger and named packs", async () => {
        const sound = scope()
        let ready!: () => void
        sound.loadSpritePack = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    ready = resolve
                })
        )
        const outcome = vi.fn()
        const beat = vi.fn()
        window.addEventListener("beat", beat)
        const runtime = new CueRuntime(context({ ...sound, createScope: () => sound }), manifest, {
            onOutcome: outcome,
        })
        await flushMicrotasks()
        runtime.handleTimeUpdate(1)
        expect(sound.playSprite).not.toHaveBeenCalled()
        expect(beat).toHaveBeenCalledTimes(1)
        expect(outcome).toHaveBeenCalledWith(
            expect.objectContaining({ cueId: "first", reason: "pack-loading" })
        )
        // Resolve only the second pack. The first remains loading independently.
        ready()
        await flushMicrotasks()
        runtime.handleTimeUpdate(2)
        expect(sound.playSprite).not.toHaveBeenCalled()
        runtime.executeCueById("second")
        expect(sound.playSprite).toHaveBeenCalledWith(
            "chime",
            expect.objectContaining({ pack: "second" })
        )
        runtime.executeCueById("first")
        expect(sound.playSprite).toHaveBeenCalledTimes(1)
        runtime.dispose()
        window.removeEventListener("beat", beat)
    })

    it("bounds referenced pack loads before they enter the shared queue", async () => {
        const sound = scope(),
            status = vi.fn(),
            outcome = vi.fn()
        const packs = Object.fromEntries(
            Array.from({ length: 12 }, (_, index) => [
                `pack-${index}`,
                manifest.assets!.spritePacks!.first,
            ])
        )
        const many: CueManifest = {
            ...manifest,
            assets: { spritePacks: packs },
            cues: Object.keys(packs).map((pack) => ({
                id: pack,
                trigger: { kind: "chapter", value: pack },
                actions: [{ command: "sprite.play", pack, clip: "chime" }],
            })),
        }
        const runtime = new CueRuntime(context({ ...sound, createScope: () => sound }), many, {
            onStatus: status,
            onOutcome: outcome,
        })
        await flushMicrotasks()
        expect(sound.loadSpritePack).toHaveBeenCalledTimes(4)
        runtime.executeCueById("pack-11")
        expect(sound.playSprite).not.toHaveBeenCalled()
        expect(status).toHaveBeenCalledWith(
            expect.objectContaining({
                pack: "pack-11",
                status: "failed",
                message: "Sprite pack limit exceeded (4)",
            })
        )
        expect(outcome).toHaveBeenCalledWith(
            expect.objectContaining({ cueId: "pack-11", reason: "pack-failed" })
        )
        runtime.dispose()
        const limited = new CueRuntime(context({ ...sound, createScope: () => sound }), many, {
            maxSpritePacks: 2,
        })
        await flushMicrotasks()
        expect(sound.loadSpritePack).toHaveBeenCalledTimes(6)
        limited.dispose()
    })

    it("reports a synchronous start failure once without also reporting skipped", async () => {
        const sound = scope(),
            outcome = vi.fn()
        sound.playSprite = vi.fn((_clip, options) => {
            options?.onError?.("seek-failed")
            return null
        })
        const runtime = new CueRuntime(context({ ...sound, createScope: () => sound }), manifest, {
            onOutcome: outcome,
        })
        await flushMicrotasks()
        runtime.executeCueById("second")
        expect(outcome.mock.calls.map(([event]) => event.outcome)).toEqual(["failed"])
        runtime.dispose()
    })

    it("reports failed and missing packs without swallowing event actions", async () => {
        const sound = scope()
        sound.loadSpritePack = vi.fn().mockRejectedValue(new Error("network"))
        const outcome = vi.fn()
        const runtime = new CueRuntime(context({ ...sound, createScope: () => sound }), manifest, {
            onOutcome: outcome,
        })
        await flushMicrotasks()
        runtime.executeCueById("first")
        expect(outcome).toHaveBeenCalledWith(expect.objectContaining({ reason: "pack-failed" }))
        expect(outcome).toHaveBeenCalledWith(
            expect.objectContaining({ command: "event.emit", outcome: "executed" })
        )
        runtime.dispose()
    })

    it("a throwing cleanup cannot prevent another manifest from loading", async () => {
        const old = scope(),
            next = scope()
        old.stopSprite = vi.fn(() => {
            throw new Error("already disposed")
        })
        old.dispose = vi.fn(() => {
            throw new Error("dispose failed")
        })
        const createScope = vi.fn().mockReturnValueOnce(old).mockReturnValue(next)
        const status = vi.fn()
        const plugin = createCueManifestPlugin({ onStatus: status })
        plugin.init(context({ ...old, createScope }))
        plugin.onPlay() // time cues only fire while the player is playing
        plugin.onTrackLoad(track())
        await flushMicrotasks()
        plugin.onTimeUpdate(1)
        expect(() => plugin.onTrackLoad(track({ ...manifest, id: "replacement" }))).not.toThrow()
        await flushMicrotasks()
        plugin.onTimeUpdate(1)
        expect(next.playSprite).toHaveBeenCalled()
        expect(old.dispose).toHaveBeenCalled()
        expect(status).toHaveBeenCalledWith(expect.objectContaining({ status: "cleanup-failed" }))
        plugin.destroy()
        plugin.destroy()
    })

    it("ignores a stale manifest JSON completion and removes the original listener target", async () => {
        let finish!: (data: unknown) => void
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    new Promise((resolve) => {
                        finish = resolve
                    }),
            })
        )
        const sound = scope(),
            status = vi.fn()
        const original = document.createElement("div"),
            next = document.createElement("div")
        const ctx = context({ ...sound, createScope: () => sound })
        ctx.getRootElement = () => original
        const remove = vi.spyOn(original, "removeEventListener")
        const plugin = createCueManifestPlugin({ onStatus: status })
        plugin.init(ctx)
        plugin.onTrackLoad({ ...track(), cueManifest: undefined, cueManifestUrl: "/manifest.json" })
        await flushMicrotasks()
        plugin.onTrackLoad(track({ ...manifest, id: "new" }))
        finish({ ...manifest, id: "stale" })
        await flushMicrotasks()
        expect(status).not.toHaveBeenCalledWith(expect.objectContaining({ manifestId: "stale" }))
        ctx.getRootElement = () => next
        plugin.destroy()
        expect(remove).toHaveBeenCalledWith("sap-dispatch-cue", expect.any(Function))
    })

    it("repeated track replacement works under React Strict Mode with actual sound-layer cleanup", async () => {
        vi.stubGlobal("AudioContext", FakeAudioContext)
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(new Uint8Array(12)))
        )
        const outcome = vi.fn()
        const single: CueManifest = {
            ...manifest,
            assets: { spritePacks: { second: manifest.assets!.spritePacks!.second } },
            cues: [manifest.cues[1]],
        }
        const { rerender, unmount } = renderHook(
            ({ value }) => {
                const sounds = usePluginSoundLayer()
                const plugins = useMemo(() => [createCueManifestPlugin({ onOutcome: outcome })], [])
                const manager = usePluginManager(plugins, context(sounds))
                useEffect(() => {
                    manager.trigger("onTrackLoad", value)
                }, [manager, value])
                return manager
            },
            { initialProps: { value: track(single) }, wrapper: StrictMode }
        )
        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10))
            })
            act(() =>
                window.dispatchEvent(
                    new CustomEvent("sap-dispatch-cue", { detail: { id: "second" } })
                )
            )
            expect(outcome).toHaveBeenCalledWith(
                expect.objectContaining({ cueId: "second", outcome: "accepted" })
            )
            rerender({ value: track({ ...single, id: `replacement-${i}` }) })
        }
        unmount()
        await flushMicrotasks()
        expect(FakeAudioContext.instances[FakeAudioContext.instances.length - 1]?.state).toBe(
            "closed"
        )
    })
})
