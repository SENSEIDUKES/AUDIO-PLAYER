import { describe, expect, it } from "vitest"
import { buildVaultTrackArcActions } from "../vaultTrackMenu"
import { buildStandardTrackArcActions } from "../standardArcActions"
import { isWorkspaceRoute } from "../../components/workspace/workspaceRoutes"
import { pruneDeadArcActions } from "../arcRouting"
import type { ArcAction } from "../arcRouting"

function collectLeaves(actions: ArcAction[], out: ArcAction[] = []): ArcAction[] {
    for (const a of actions) {
        if (a.children && a.children.length > 0) collectLeaves(a.children, out)
        else out.push(a)
    }
    return out
}

describe("buildVaultTrackArcActions", () => {
    it("matches the standardized Vault-face command wheel (Vault replaces Plugins)", () => {
        const tree = buildVaultTrackArcActions()
        expect(tree.map((a) => a.label)).toEqual([
            "Vault",
            "Playback",
            "Share",
            "Agents",
        ])
        const byLabel = Object.fromEntries(
            tree.map((a) => [a.label, a.children!.map((c) => c.label)])
        )
        expect(byLabel["Vault"]).toEqual(["Tag", "Rename", "Playlist", "Radio"])
        expect(byLabel["Playback"]).toEqual(["Up Next", "Controls", "Debug"])
        expect(byLabel["Share"]).toEqual(["Link", "Add to", "Favorite"])
        expect(byLabel["Agents"]).toEqual(["Scout", "Memoir"])
    })

    it("gives every leaf an explicit routing target with a resolvable destination", () => {
        for (const leaf of collectLeaves(buildVaultTrackArcActions())) {
            expect(leaf.target, leaf.id).toBeDefined()
            if (leaf.target === "immediate-action") {
                expect(leaf.action, leaf.id).toBeDefined()
            }
            if (leaf.target === "sap-controller") {
                expect(leaf.workspaceRoute, leaf.id).toBeDefined()
                expect(isWorkspaceRoute(leaf.workspaceRoute!)).toBe(true)
            }
        }
    })

    it("routes every Vault arm leaf to its dedicated '…' menu section", () => {
        const leaves = collectLeaves(buildVaultTrackArcActions())
        const routeOf = (id: string) => leaves.find((l) => l.id === id)!.workspaceRoute
        expect(routeOf("vault-tag")).toBe("vault:tag")
        expect(routeOf("vault-rename")).toBe("vault:rename")
        expect(routeOf("vault-playlist")).toBe("library:playlists")
        expect(routeOf("vault-radio")).toBe("vault:radio")
    })

    it("routes the Playback arm to Up Next / Controls / Debug sections", () => {
        const leaves = collectLeaves(buildVaultTrackArcActions())
        const routeOf = (id: string) => leaves.find((l) => l.id === id)!.workspaceRoute
        expect(routeOf("up-next")).toBe("library:queue")
        expect(routeOf("controls")).toBe("playback:controls")
        expect(routeOf("debug")).toBe("diagnostics:activity-log")
    })

    it("binds Share › Link and Favorite to immediate host commands, Add to to a section", () => {
        const leaves = collectLeaves(buildVaultTrackArcActions())
        const leaf = (id: string) => leaves.find((l) => l.id === id)!
        expect(leaf("share-link").action).toBe("share.url")
        expect(leaf("share-favorite").action).toBe("track.favorite")
        expect(leaf("share-add-to").workspaceRoute).toBe("library:vault")
    })

    it("points Scout at the Demo tier by default and the Studio tier when entitled", () => {
        const scout = (entitled?: boolean) =>
            collectLeaves(
                buildVaultTrackArcActions(
                    entitled === undefined
                        ? undefined
                        : { entitlements: { studioScout: entitled } }
                )
            ).find((l) => l.id === "agent-scout")!
        expect(scout().workspaceRoute).toBe("agent:demo-scout")
        expect(scout(false).workspaceRoute).toBe("agent:demo-scout")
        expect(scout(true).workspaceRoute).toBe("agent:studio-scout")
        expect(
            collectLeaves(buildVaultTrackArcActions()).find(
                (l) => l.id === "agent-memoir"
            )!.workspaceRoute
        ).toBe("agent:memoir")
    })

    it("prunes every workspace arm on a host without SAP routing, keeping wired immediates", () => {
        const pruned = pruneDeadArcActions(buildVaultTrackArcActions(), {
            commands: {
                "share.url": () => {},
            },
        })
        // Only Share survives, holding just the wired Link leaf.
        expect(pruned.map((a) => a.id)).toEqual(["share"])
        expect(pruned[0].children!.map((c) => c.id)).toEqual(["share-link"])
    })

    it("keeps the full wheel on a fully wired host", () => {
        const pruned = pruneDeadArcActions(buildVaultTrackArcActions(), {
            commands: {
                "share.url": () => {},
                "track.favorite": () => {},
            },
            openWorkspace: () => {},
        })
        expect(pruned.map((a) => a.id)).toEqual([
            "vault",
            "playback",
            "share",
            "agents",
        ])
        expect(collectLeaves(pruned)).toHaveLength(12)
    })
})

describe("buildStandardTrackArcActions", () => {
    it("matches the standardized wheel for non-Vault faces (Plugins | Playback | Share | Agents)", () => {
        const tree = buildStandardTrackArcActions({
            activePluginIds: ["lyrics"],
        })
        expect(tree.map((a) => a.label)).toEqual([
            "Plugins",
            "Playback",
            "Share",
            "Agents",
        ])
    })

    it("shows only currently active plugins, bucketed under Audio / Visual / Analytics", () => {
        const tree = buildStandardTrackArcActions({
            activePluginIds: ["registry-lyrics", "registry-automix", "analytics"],
        })
        const plugins = tree.find((a) => a.id === "plugins")!
        const byLabel = Object.fromEntries(
            plugins.children!.map((b) => [b.label, b.children!.map((c) => c.label)])
        )
        // Automix is an audio-affecting (playback) plugin; Lyrics is visual
        // (joined by the built-in Canvas toggle); Analytics is analytics.
        expect(byLabel["Audio"]).toEqual(["Automix"])
        expect(byLabel["Visual"]).toEqual(["Lyrics", "Canvas"])
        expect(byLabel["Analytics"]).toEqual(["Analytics"])
    })

    it("keeps inactive plugins out of the wheel (only Canvas remains without active plugins)", () => {
        const tree = buildStandardTrackArcActions()
        const plugins = tree.find((a) => a.id === "plugins")!
        expect(plugins.children!.map((b) => b.label)).toEqual(["Visual"])
        expect(plugins.children![0].children!.map((c) => c.label)).toEqual([
            "Canvas",
        ])
    })

    it("shares the standardized Playback / Share / Agents arms with the Vault wheel", () => {
        const standard = buildStandardTrackArcActions()
        const vault = buildVaultTrackArcActions()
        for (const id of ["playback", "share", "agents"]) {
            expect(standard.find((a) => a.id === id)).toEqual(
                vault.find((a) => a.id === id)
            )
        }
    })

    it("gives every plugin leaf a registered workspace route", () => {
        const tree = buildStandardTrackArcActions({
            activePluginIds: [
                "lyrics",
                "automix",
                "analytics",
                "sleep-timer",
                "auto-theme",
                "waveform",
                "keyboard-shortcuts", // headless: must not surface
            ],
        })
        const plugins = tree.find((a) => a.id === "plugins")!
        const leaves = collectLeaves([plugins])
        expect(leaves.map((l) => l.id)).not.toContain("plugin-keyboard-shortcuts")
        for (const leaf of leaves) {
            if (leaf.id === "canvas") {
                expect(leaf.target).toBe("sei-canvas")
                continue
            }
            expect(leaf.target).toBe("sap-controller")
            expect(isWorkspaceRoute(leaf.workspaceRoute!)).toBe(true)
        }
    })
})
