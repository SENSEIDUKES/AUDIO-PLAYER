// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { formatCueManifestIssue, parseCueManifest, validateCueManifest } from "../cueManifestSchema"
import { createCueManifestPlugin } from "../CueManifestPlugin"
import type { PluginPlayerContext } from "../../core/plugins/PluginInterface"

const good = {
    id: "good",
    trigger: { kind: "time", at: 1 },
    actions: [{ command: "event.emit", eventName: "ping" }],
}

afterEach(() => vi.restoreAllMocks())

describe("parseCueManifest", () => {
    it("reports a clean manifest as valid with no issues", () => {
        const result = parseCueManifest({ version: "sap-cues/1", cues: [good] })
        expect(result.status).toBe("valid")
        expect(result.issues).toEqual([])
        expect(result.omittedCueCount + result.omittedActionCount).toBe(0)
        expect(result.manifest?.cues).toHaveLength(1)
    })

    it("an ambience action missing its profile is reported with cue, action and field and the cue is dropped", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [
                good,
                {
                    id: "rain",
                    trigger: { kind: "time", at: 2 },
                    actions: [{ command: "ambience.crossfade" }],
                },
            ],
        })
        expect(result.status).toBe("accepted-with-omissions")
        expect(result.manifest?.cues.map((c) => c.id)).toEqual(["good"])
        expect(result.omittedCueCount).toBe(1)
        expect(result.omittedActionCount).toBe(1)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                severity: "error",
                code: "invalid-action",
                path: "cues[1].actions[0].profile",
                cueIndex: 1,
                cueId: "rain",
                actionIndex: 0,
                command: "ambience.crossfade",
                field: "profile",
                message: expect.stringContaining("required"),
            })
        )
        expect(result.issues).toContainEqual(
            expect.objectContaining({ code: "cue-no-valid-actions", cueId: "rain" })
        )
    })

    it("a manifest whose only cue has no usable action is invalid, not a success with zero cues", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [
                {
                    trigger: { kind: "time", at: 0 },
                    actions: [{ command: "ambience.crossfade" }],
                },
            ],
        })
        expect(result.status).toBe("invalid")
        expect(result.manifest).toBeNull()
    })

    it("keeps a cue's valid actions and omits only the bad ones", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [
                {
                    id: "mixed",
                    trigger: { kind: "time", at: 1 },
                    actions: [
                        { command: "duck.set", amount: 0.5 },
                        { command: "duck.set", amount: 3 },
                    ],
                },
            ],
        })
        expect(result.status).toBe("accepted-with-omissions")
        expect(result.manifest?.cues[0].actions).toEqual([{ command: "duck.set", amount: 0.5 }])
        expect(result.omittedActionCount).toBe(1)
        expect(result.issues[0]).toEqual(
            expect.objectContaining({ path: "cues[0].actions[1].amount", field: "amount" })
        )
    })

    it("detects duplicate cue ids and keeps the first", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [
                { ...good, id: "same", trigger: { kind: "time", at: 1 } },
                { ...good, id: "same", trigger: { kind: "time", at: 2 } },
            ],
        })
        expect(result.status).toBe("accepted-with-omissions")
        expect(result.manifest?.cues).toHaveLength(1)
        expect(result.manifest?.cues[0].trigger).toEqual({ kind: "time", at: 1 })
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                code: "duplicate-cue-id",
                cueIndex: 1,
                cueId: "same",
                path: "cues[1].id",
                message: expect.stringContaining("cues[0]"),
            })
        )
    })

    it.each([
        ["a negative trigger time", { trigger: { kind: "time", at: -1 } }, "cues[0].trigger.at"],
        [
            "a negative duration",
            { actions: [{ command: "sprite.stop", fadeOutMs: -5 }] },
            "cues[0].actions[0].fadeOutMs",
        ],
        [
            "a narration volume above 1",
            { actions: [{ command: "volume.fadeNarration", volume: 2, durationMs: 100 }] },
            "cues[0].actions[0].volume",
        ],
        [
            "a non-numeric seek target",
            { actions: [{ command: "player.seek", time: "soon" }] },
            "cues[0].actions[0].time",
        ],
    ])("rejects %s with its location", (_name, patch, path) => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [good, { ...good, id: "bad", ...patch }],
        })
        expect(result.status).toBe("accepted-with-omissions")
        expect(result.issues.map((issue) => issue.path)).toContain(path.replace("[0]", "[1]"))
    })

    it("names the supported commands for an unknown command", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [
                good,
                { id: "x", trigger: { kind: "time", at: 1 }, actions: [{ command: "boom" }] },
            ],
        })
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                code: "unknown-command",
                command: "boom",
                message: expect.stringContaining("sprite.play"),
            })
        )
    })

    it("warns, without omitting, about sprites that point at missing assets", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            assets: {
                spritePacks: { p: { src: "/p.wav", clips: { hit: { offset: 0, duration: 1 } } } },
            },
            cues: [
                {
                    id: "s",
                    trigger: { kind: "time", at: 1 },
                    actions: [
                        { command: "sprite.play", pack: "p", clip: "nope" },
                        { command: "sprite.play", pack: "missing", clip: "hit" },
                    ],
                },
            ],
        })
        expect(result.status).toBe("valid")
        expect(result.manifest?.cues[0].actions).toHaveLength(2)
        expect(result.issues.map((issue) => [issue.severity, issue.field])).toEqual([
            ["warning", "clip"],
            ["warning", "pack"],
        ])
    })

    it("an omitted cue does not reserve its id for a later valid cue", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [
                {
                    id: "same",
                    trigger: { kind: "time", at: 1 },
                    actions: [{ command: "duck.set" }],
                },
                { ...good, id: "same" },
            ],
        })
        expect(result.status).toBe("accepted-with-omissions")
        expect(result.manifest?.cues.map((c) => c.id)).toEqual(["same"])
        expect(result.issues.map((issue) => issue.code)).not.toContain("duplicate-cue-id")
    })

    it("treats inherited property names as undeclared packs and clips instead of throwing", () => {
        const action = (pack: string, clip: string) => ({ command: "sprite.play", pack, clip })
        const result = parseCueManifest({
            version: "sap-cues/1",
            assets: {
                spritePacks: { p: { src: "/p.wav", clips: { hit: { offset: 0, duration: 1 } } } },
            },
            cues: [
                {
                    id: "proto",
                    trigger: { kind: "time", at: 1 },
                    actions: [action("constructor", "hit"), action("p", "toString")],
                },
            ],
        })
        expect(result.status).toBe("valid")
        expect(result.issues.map((issue) => [issue.severity, issue.field])).toEqual([
            ["warning", "pack"],
            ["warning", "clip"],
        ])
        expect(() =>
            parseCueManifest({
                version: "sap-cues/1",
                cues: [{ ...good, actions: [action("__proto__", "x")] }],
            })
        ).not.toThrow()
    })

    it("rejects an unsupported version at the manifest level", () => {
        const result = parseCueManifest({ version: "sap-cues/2", cues: [] })
        expect(result.status).toBe("invalid")
        expect(result.issues[0]).toEqual(
            expect.objectContaining({ code: "invalid-manifest", path: "version" })
        )
    })

    it("formats an issue with its location and cue id", () => {
        const result = parseCueManifest({
            version: "sap-cues/1",
            cues: [good, { ...good, id: "good" }],
        })
        expect(formatCueManifestIssue(result.issues[0])).toContain('cues[1].id (cue "good")')
    })
})

describe("validateCueManifest (compatibility)", () => {
    it("still returns the usable manifest for omissions and null when invalid, and logs errors", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        const partial = validateCueManifest({
            version: "sap-cues/1",
            cues: [good, { ...good, id: "dup" }, { ...good, id: "dup" }],
        })
        expect(partial?.cues.map((c) => c.id)).toEqual(["good", "dup"])
        expect(warn).toHaveBeenCalled()
        expect(validateCueManifest({ version: "nope" })).toBeNull()
    })
})

describe("CueManifestPlugin validation reporting", () => {
    const context = {
        getEngine: () => ({}) as never,
        getRootElement: () => null,
        getEventTarget: () => new EventTarget(),
        getAudioElement: () => null,
        getCurrentTrack: () => null,
        getNextTrack: () => null,
        getSourceKey: () => "test",
    } satisfies PluginPlayerContext
    const track = (cueManifest: unknown) =>
        ({ id: "t", title: "t", artist: "", audioFile: "/a.mp3", cueManifest }) as never

    it("reports omissions before installing and rejects invalid manifests with their issues", () => {
        const onStatus = vi.fn()
        const plugin = createCueManifestPlugin({ onStatus })
        plugin.init(context)

        plugin.onTrackLoad(
            track({ version: "sap-cues/1", id: "partial", cues: [good, { ...good, id: "good" }] })
        )
        const statuses = onStatus.mock.calls.map(([event]) => event.status)
        expect(statuses.slice(0, 2)).toEqual(["accepted-with-omissions", "installed"])
        expect(onStatus.mock.calls[0][0].issues[0].code).toBe("duplicate-cue-id")

        onStatus.mockClear()
        plugin.onTrackLoad(track({ version: "sap-cues/1", id: "broken", cues: [{ trigger: 1 }] }))
        expect(onStatus).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "failed",
                manifestId: "broken",
                issues: expect.arrayContaining([expect.objectContaining({ code: "invalid-cue" })]),
            })
        )
        plugin.destroy()
    })
})
