import { describe, expect, it } from "vitest"
import { isCanonicalPlayerMenu, resolvePlayerMenu } from "../menuProfile"
import { buildCanonicalPlayerActions } from "../canonicalActions"
import { buildStandardTrackArcActions, buildVaultTrackArcActions } from "../compatActions"
import { collectArcLeaves, describeArcRoutes, pruneDeadArcActions } from "../arcRouting"
import type { ArcAction, ArcCommandHost } from "../arcRouting"
import { isWorkspaceRoute } from "../../components/workspace/workspaceRoutes"

const HOST_TREE: ArcAction[] = [
    {
        id: "label",
        label: "Label",
        children: [
            {
                id: "label-roster",
                label: "Roster",
                target: "sap-controller",
                workspaceRoute: "library:playlists",
            },
        ],
    },
    { id: "buy", label: "Buy", target: "immediate-action", action: "commerce.buy" },
]

const armLabels = (actions: ArcAction[]) => actions.map((a) => a.label)

describe("resolvePlayerMenu — host ownership", () => {
    it("returns the canonical hierarchy when the host supplies nothing", () => {
        expect(resolvePlayerMenu()).toEqual(buildCanonicalPlayerActions())
        expect(resolvePlayerMenu({ activePluginIds: ["lyrics"] })).toEqual(
            buildCanonicalPlayerActions({ activePluginIds: ["lyrics"] })
        )
    })

    it("renders a host tree verbatim, with no canonical category merged in", () => {
        const resolved = resolvePlayerMenu({
            actions: HOST_TREE,
            // Canonical inputs are present and must be ignored entirely.
            activePluginIds: ["lyrics", "automix", "analytics"],
            entitlements: { studioScout: true },
        })
        expect(resolved).toBe(HOST_TREE)
        expect(armLabels(resolved)).toEqual(["Label", "Buy"])
        for (const canonicalArm of ["Plugins", "Playback", "Queue", "Share", "Agents", "Vault"]) {
            expect(armLabels(resolved)).not.toContain(canonicalArm)
        }
    })

    it("treats a profile's own tree the same way", () => {
        const resolved = resolvePlayerMenu({ menuProfile: { actions: HOST_TREE } })
        expect(resolved).toBe(HOST_TREE)
    })

    it("lets `actions` win over a profile, so the most explicit wins", () => {
        const other: ArcAction[] = [{ id: "x", label: "X", onSelect: () => {} }]
        expect(resolvePlayerMenu({ actions: HOST_TREE, menuProfile: { actions: other } })).toBe(
            HOST_TREE
        )
    })

    it("selects and orders canonical categories from a profile", () => {
        const resolved = resolvePlayerMenu({
            menuProfile: { categories: ["share", "playback"] },
        })
        expect(armLabels(resolved)).toEqual(["Share", "Playback"])
    })

    it("ignores unknown category ids rather than inventing empty arms", () => {
        const resolved = resolvePlayerMenu({
            menuProfile: { categories: ["share", "not-a-category"] },
        })
        expect(armLabels(resolved)).toEqual(["Share"])
    })

    it("adds host arms alongside the canonical ones, on the requested side", () => {
        const extra: ArcAction[] = [{ id: "buy", label: "Buy", onSelect: () => {} }]
        const appended = armLabels(resolvePlayerMenu({ menuProfile: { extraActions: extra } }))
        expect(appended[appended.length - 1]).toBe("Buy")
        expect(
            armLabels(
                resolvePlayerMenu({ menuProfile: { extraActions: extra, placement: "prepend" } })
            )[0]
        ).toBe("Buy")
    })

    it("combines category selection with host arms", () => {
        const resolved = resolvePlayerMenu({
            menuProfile: {
                categories: ["queue"],
                extraActions: [{ id: "buy", label: "Buy", onSelect: () => {} }],
            },
        })
        expect(armLabels(resolved)).toEqual(["Queue", "Buy"])
    })

    it("reports whether the menu is still SAP's canonical one", () => {
        expect(isCanonicalPlayerMenu({})).toBe(true)
        expect(isCanonicalPlayerMenu({ menuProfile: {} })).toBe(true)
        expect(isCanonicalPlayerMenu({ actions: HOST_TREE })).toBe(false)
        expect(isCanonicalPlayerMenu({ menuProfile: { actions: HOST_TREE } })).toBe(false)
        expect(isCanonicalPlayerMenu({ menuProfile: { categories: ["share"] } })).toBe(false)
        expect(isCanonicalPlayerMenu({ menuProfile: { extraActions: HOST_TREE } })).toBe(false)
    })
})

describe("host menus keep the shared machinery", () => {
    it("routes host leaves through the same router and controller", () => {
        const opened: string[] = []
        const ran: string[] = []
        const host: ArcCommandHost = {
            openWorkspace: (route) => opened.push(route),
            commands: { "commerce.buy": () => ran.push("commerce.buy") },
        }
        const live = pruneDeadArcActions(resolvePlayerMenu({ actions: HOST_TREE }), host)
        expect(armLabels(live)).toEqual(["Label", "Buy"])
        const routes = describeArcRoutes(live)
        expect(routes.find((r) => r.id === "label-roster")?.workspaceRoute).toBe(
            "library:playlists"
        )
        expect(routes.find((r) => r.id === "buy")?.command).toBe("commerce.buy")
    })

    it("still prunes a host leaf the host itself left unwired", () => {
        // Capability pruning is SAP's, not the host's, so a host tree cannot
        // introduce dead buttons either.
        const live = pruneDeadArcActions(resolvePlayerMenu({ actions: HOST_TREE }), {
            commands: { "commerce.buy": () => {} },
        })
        expect(armLabels(live)).toEqual(["Buy"])
    })

    it("honors capability requirements declared by a host action", () => {
        const gated: ArcAction[] = [
            {
                id: "pro",
                label: "Pro",
                target: "sap-controller",
                workspaceRoute: "vault:radio",
                requires: ["proTier"],
            },
        ]
        const base: ArcCommandHost = { openWorkspace: () => {} }
        expect(pruneDeadArcActions(resolvePlayerMenu({ actions: gated }), base)).toEqual([])
        expect(
            pruneDeadArcActions(resolvePlayerMenu({ actions: gated }), {
                ...base,
                capabilities: { proTier: true },
            })
        ).toHaveLength(1)
    })
})

describe("restored pre-consolidation builders", () => {
    it("buildVaultTrackArcActions has exactly its original four categories", () => {
        const tree = buildVaultTrackArcActions()
        expect(tree).toHaveLength(4)
        expect(armLabels(tree)).toEqual(["Vault", "Playback", "Share", "Agents"])
        const byLabel = Object.fromEntries(
            tree.map((a) => [a.label, a.children!.map((c) => c.label)])
        )
        expect(byLabel["Vault"]).toEqual(["Tag", "Rename", "Playlist", "Radio"])
        expect(byLabel["Playback"]).toEqual(["Up Next", "Controls", "Debug"])
        expect(byLabel["Share"]).toEqual(["Link", "Add to", "Favorite"])
        expect(byLabel["Agents"]).toEqual(["Scout", "Memoir"])
    })

    it("keeps the Vault menu free of canonical-only categories", () => {
        const labels = armLabels(buildVaultTrackArcActions())
        expect(labels).not.toContain("Plugins")
        expect(labels).not.toContain("Queue")
    })

    it("routes every original Vault leaf to its original destination", () => {
        const leaves = collectArcLeaves(buildVaultTrackArcActions())
        const routeOf = (id: string) => leaves.find((l) => l.id === id)?.workspaceRoute
        expect(routeOf("vault-tag")).toBe("vault:tag")
        expect(routeOf("vault-rename")).toBe("vault:rename")
        expect(routeOf("vault-playlist")).toBe("library:playlists")
        expect(routeOf("vault-radio")).toBe("vault:radio")
        expect(routeOf("up-next")).toBe("library:queue")
        expect(routeOf("controls")).toBe("playback:controls")
        expect(routeOf("debug")).toBe("diagnostics:activity-log")
        expect(routeOf("share-add-to")).toBe("library:vault")
        expect(routeOf("agent-scout")).toBe("agent:demo-scout")
        expect(routeOf("agent-memoir")).toBe("agent:memoir")
    })

    it("points the Vault menu's Scout leaf at the Studio tier when entitled", () => {
        const leaves = collectArcLeaves(
            buildVaultTrackArcActions({ entitlements: { studioScout: true } })
        )
        expect(leaves.find((l) => l.id === "agent-scout")?.workspaceRoute).toBe(
            "agent:studio-scout"
        )
    })

    it("renders the Vault arm without needing the vault capability", () => {
        // A host asking for this menu by name has already asserted the surface
        // is a vault track; requiring the capability would make the restored
        // builder unusable on every face but one.
        const live = pruneDeadArcActions(buildVaultTrackArcActions(), {
            openWorkspace: () => {},
        })
        expect(armLabels(live)).toContain("Vault")
    })

    it("buildStandardTrackArcActions has its original four categories", () => {
        const tree = buildStandardTrackArcActions({ activePluginIds: ["lyrics"] })
        expect(armLabels(tree)).toEqual(["Plugins", "Playback", "Share", "Agents"])
        const playback = tree.find((a) => a.id === "playback")!
        expect(playback.children!.map((c) => c.label)).toEqual(["Up Next", "Controls", "Debug"])
    })

    it("drops the Plugins arm when nothing is active, as it always did", () => {
        expect(armLabels(buildStandardTrackArcActions())).toEqual([
            "Plugins",
            "Playback",
            "Share",
            "Agents",
        ])
        // With no plugins the arm survives only on the Canvas leaf, which
        // requires the capability — so it prunes on a face without one.
        const live = pruneDeadArcActions(buildStandardTrackArcActions(), {
            openWorkspace: () => {},
        })
        expect(armLabels(live)).toEqual(["Playback", "Share", "Agents"])
    })

    it("gives every restored leaf a resolvable destination", () => {
        for (const tree of [buildVaultTrackArcActions(), buildStandardTrackArcActions()]) {
            for (const leaf of collectArcLeaves(tree)) {
                expect(leaf.target, leaf.id).toBeDefined()
                if (leaf.target === "sap-controller") {
                    expect(isWorkspaceRoute(leaf.workspaceRoute!), leaf.id).toBe(true)
                }
                if (leaf.target === "immediate-action") {
                    expect(leaf.action, leaf.id).toBeDefined()
                }
            }
        }
    })
})
