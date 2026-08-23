import { describe, expect, it } from "vitest"
import { buildCanonicalPlayerActions } from "../canonicalActions"
import {
    collectArcLeaves,
    describeArcRoutes,
    pruneDeadArcActions,
    routeArcAction,
} from "../arcRouting"
import type { ArcAction, ArcCommandHost } from "../arcRouting"
import { WORKSPACE_ROUTES, isWorkspaceRoute } from "../../components/workspace/workspaceRoutes"
import type { WorkspaceRoute } from "../../components/workspace/workspaceRoutes"

/** Every plugin the catalog can surface, so the Plugins arm is fully populated. */
const ALL_PLUGIN_IDS = [
    "lyrics",
    "automix",
    "analytics",
    "waveform",
    "sleep-timer",
    "auto-theme",
    "keyboard-shortcuts",
] as const

/** Every immediate command the canonical hierarchy can carry. */
const ALL_COMMANDS = [
    "track.previous",
    "track.next",
    "track.favorite",
    "queue.insertAfterCurrent",
    "queue.append",
    "share.url",
] as const

/** A host that wires everything — the widest possible surface. */
function fullHost(openWorkspace: (route: WorkspaceRoute) => void = () => {}): ArcCommandHost {
    return {
        openWorkspace,
        commands: Object.fromEntries(ALL_COMMANDS.map((id) => [id, () => {}])),
        capabilities: { canvas: true, vault: true },
    }
}

function fullTree(): ArcAction[] {
    return buildCanonicalPlayerActions({ activePluginIds: ALL_PLUGIN_IDS })
}

function find(actions: ArcAction[], id: string): ArcAction | undefined {
    for (const action of actions) {
        if (action.id === id) return action
        if (action.children) {
            const hit = find(action.children, id)
            if (hit) return hit
        }
    }
    return undefined
}

describe("the canonical player action hierarchy", () => {
    it("declares one stable set of arms", () => {
        const tree = pruneDeadArcActions(fullTree(), fullHost())
        expect(tree.map((a) => a.label)).toEqual([
            "Plugins",
            "Playback",
            "Queue",
            "Share",
            "Agents",
            "Vault",
        ])
    })

    it("gives every leaf an explicit target with a resolvable destination", () => {
        for (const leaf of collectArcLeaves(fullTree())) {
            expect(leaf.target, leaf.id).toBeDefined()
            if (leaf.target === "immediate-action") {
                expect(leaf.action, leaf.id).toBeDefined()
            }
            if (leaf.target === "sap-controller") {
                expect(leaf.workspaceRoute, leaf.id).toBeDefined()
                expect(isWorkspaceRoute(leaf.workspaceRoute!), leaf.id).toBe(true)
            }
        }
    })

    it("routes every settings leaf into the controller and nowhere else", () => {
        // There is no third target: a leaf either opens a controller workspace
        // or runs an immediate command. Nothing can reach another surface.
        for (const row of describeArcRoutes(fullTree())) {
            expect(["sap-controller", "immediate-action"], row.id).toContain(row.target)
        }
    })

    it("keeps immediate leaves to genuine commands, never settings screens", () => {
        const immediates = describeArcRoutes(fullTree()).filter(
            (row) => row.target === "immediate-action"
        )
        expect(immediates.map((row) => row.command).sort()).toEqual(
            [
                "queue.append",
                "queue.insertAfterCurrent",
                "share.url",
                "track.favorite",
                "track.next",
                "track.previous",
            ].sort()
        )
        // No immediate leaf smuggles a workspace route alongside its command.
        for (const row of immediates) expect(row.workspaceRoute, row.id).toBeUndefined()
    })

    it("reaches every registered workspace route except the controller root", () => {
        // Both Scout tiers count: the entitlement picks which one Scout opens,
        // and every route in the shell must be reachable from some state.
        const reached = new Set(
            [false, true]
                .flatMap((studioScout) =>
                    describeArcRoutes(
                        buildCanonicalPlayerActions({
                            activePluginIds: ALL_PLUGIN_IDS,
                            entitlements: { studioScout },
                        })
                    )
                )
                .map((row) => row.workspaceRoute)
                .filter((route): route is WorkspaceRoute => Boolean(route))
        )
        // "options" is the controller's own root, opened by the "…" button.
        const expected = WORKSPACE_ROUTES.filter((route) => route !== "options")
        for (const route of expected) {
            expect(reached.has(route), `no action opens ${route}`).toBe(true)
        }
        // And nothing points at a route the shell doesn't know.
        for (const route of reached) expect(isWorkspaceRoute(route)).toBe(true)
    })

    it("never points two different actions at the same workspace twice over", () => {
        const routes = describeArcRoutes(fullTree())
            .map((row) => row.workspaceRoute)
            .filter(Boolean)
        expect(new Set(routes).size).toBe(routes.length)
    })

    it("uses unique action ids so dispatch can never be ambiguous", () => {
        const ids = collectArcLeaves(fullTree()).map((leaf) => leaf.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe("radial route matrix", () => {
    const EXPECTED_WORKSPACE_ROUTES: Record<string, WorkspaceRoute> = {
        "plugin-lyrics": "plugin-settings:lyrics",
        "plugin-waveform": "plugin-settings:waveform",
        "plugin-analytics": "plugin-settings:analytics",
        "plugin-sleep-timer": "plugin-settings:sleep-timer",
        "plugin-auto-theme": "plugin-settings:auto-theme",
        "plugin-automix": "playback:automix",
        canvas: "visual:canvas",
        controls: "playback:controls",
        debug: "diagnostics:activity-log",
        "up-next": "library:queue",
        "agent-queue-director": "agent:queue-director",
        "share-add-to": "library:vault",
        "agent-scout": "agent:demo-scout",
        "agent-memoir": "agent:memoir",
        "vault-tag": "vault:tag",
        "vault-rename": "vault:rename",
        "vault-playlist": "library:playlists",
        "vault-radio": "vault:radio",
    }

    it("opens the declared controller workspace for every settings action", () => {
        const tree = fullTree()
        for (const [id, route] of Object.entries(EXPECTED_WORKSPACE_ROUTES)) {
            const opened: WorkspaceRoute[] = []
            const action = find(tree, id)
            expect(action, `${id} is missing from the canonical hierarchy`).toBeDefined()
            expect(
                routeArcAction(
                    action!,
                    fullHost((r) => opened.push(r))
                )
            ).toBe(true)
            expect(opened, id).toEqual([route])
        }
    })

    it("covers every settings leaf in the hierarchy — no untested destinations", () => {
        const settingsIds = describeArcRoutes(fullTree())
            .filter((row) => row.target === "sap-controller")
            .map((row) => row.id)
            .sort()
        expect(settingsIds).toEqual(Object.keys(EXPECTED_WORKSPACE_ROUTES).sort())
    })

    it("runs the wired command — and only that command — for an immediate action", () => {
        const tree = fullTree()
        const cases: [string, string][] = [
            ["previous-track", "track.previous"],
            ["next-track", "track.next"],
            ["queue-play-next", "queue.insertAfterCurrent"],
            ["queue-play-later", "queue.append"],
            ["share-link", "share.url"],
            ["share-favorite", "track.favorite"],
        ]
        for (const [id, command] of cases) {
            const ran: string[] = []
            const openWorkspace = (route: WorkspaceRoute) => ran.push(`workspace:${route}`)
            const host: ArcCommandHost = {
                openWorkspace,
                capabilities: { canvas: true, vault: true },
                commands: Object.fromEntries(ALL_COMMANDS.map((c) => [c, () => ran.push(c)])),
            }
            expect(routeArcAction(find(tree, id)!, host), id).toBe(true)
            // Exactly the one command, and no workspace opened as a side effect.
            expect(ran, id).toEqual([command])
        }
    })
})

describe("capability filtering", () => {
    it("hides the Canvas leaf only where the face cannot host the canvas", () => {
        const tree = fullTree()
        const withCanvas = pruneDeadArcActions(tree, {
            ...fullHost(),
            capabilities: { canvas: true, vault: true },
        })
        expect(find(withCanvas, "canvas")).toBeDefined()
        const withoutCanvas = pruneDeadArcActions(tree, {
            ...fullHost(),
            capabilities: { canvas: false, vault: true },
        })
        expect(find(withoutCanvas, "canvas")).toBeUndefined()
        // The rest of the Visual bucket survives — only the one leaf goes.
        expect(find(withoutCanvas, "plugin-lyrics")).toBeDefined()
    })

    it("hides the Vault arm only where the surface is not a vault track", () => {
        const tree = fullTree()
        expect(
            find(
                pruneDeadArcActions(tree, { ...fullHost(), capabilities: { canvas: true } }),
                "vault"
            )
        ).toBeUndefined()
        expect(find(pruneDeadArcActions(tree, fullHost()), "vault")).toBeDefined()
    })

    it("prunes immediate leaves the host does not implement, and empty branches with them", () => {
        // A host with no commands at all: only settings leaves survive.
        const pruned = pruneDeadArcActions(fullTree(), {
            openWorkspace: () => {},
            capabilities: { canvas: true, vault: true },
        })
        for (const id of [
            "previous-track",
            "next-track",
            "queue-play-next",
            "queue-play-later",
            "share-link",
            "share-favorite",
        ]) {
            expect(find(pruned, id), id).toBeUndefined()
        }
        // Share is left with only its one settings leaf, not dropped entirely.
        expect(find(pruned, "share-add-to")).toBeDefined()
        for (const row of describeArcRoutes(pruned)) {
            expect(row.target).toBe("sap-controller")
        }
    })

    it("drops every settings leaf when the host cannot open the controller", () => {
        const pruned = pruneDeadArcActions(fullTree(), {
            commands: { "share.url": () => {} },
            capabilities: { canvas: true, vault: true },
        })
        expect(describeArcRoutes(pruned).map((row) => row.id)).toEqual(["share-link"])
    })

    it("shows only currently active plugins, bucketed under Audio / Visual / Analytics", () => {
        const tree = pruneDeadArcActions(
            buildCanonicalPlayerActions({
                activePluginIds: ["registry-lyrics", "registry-automix", "analytics"],
            }),
            fullHost()
        )
        const plugins = find(tree, "plugins")!
        const byLabel = Object.fromEntries(
            plugins.children!.map((b) => [b.label, b.children!.map((c) => c.label)])
        )
        expect(byLabel["Audio"]).toEqual(["Automix"])
        expect(byLabel["Visual"]).toEqual(["Lyrics", "Canvas"])
        expect(byLabel["Analytics"]).toEqual(["Analytics"])
        // An inactive plugin never surfaces.
        expect(find(tree, "plugin-waveform")).toBeUndefined()
    })

    it("keeps the Plugins arm alive on the Canvas leaf alone", () => {
        const tree = pruneDeadArcActions(buildCanonicalPlayerActions(), fullHost())
        expect(find(tree, "plugins")).toBeDefined()
        expect(find(tree, "canvas")).toBeDefined()
        // …and drops it entirely on a face with neither plugins nor canvas.
        const noVisual = pruneDeadArcActions(buildCanonicalPlayerActions(), {
            ...fullHost(),
            capabilities: { canvas: false, vault: true },
        })
        expect(find(noVisual, "plugins")).toBeUndefined()
    })

    it("routes Agents › Scout by entitlement, never by rendering a dead tier", () => {
        const demo = buildCanonicalPlayerActions()
        expect(find(demo, "agent-scout")?.workspaceRoute).toBe("agent:demo-scout")
        const studio = buildCanonicalPlayerActions({ entitlements: { studioScout: true } })
        expect(find(studio, "agent-scout")?.workspaceRoute).toBe("agent:studio-scout")
    })

    it("marks stateful leaves active without changing where they go", () => {
        const tree = buildCanonicalPlayerActions({ isFavorite: true, isCanvasActive: true })
        expect(find(tree, "share-favorite")?.state).toBe("active")
        expect(find(tree, "share-favorite")?.action).toBe("track.favorite")
        expect(find(tree, "canvas")?.state).toBe("active")
        expect(find(tree, "canvas")?.workspaceRoute).toBe("visual:canvas")
    })

    it("leaves no visible action dead on any host it survives", () => {
        // Sweep a matrix of host wirings: whatever survives pruning must route.
        for (const canvas of [true, false]) {
            for (const vault of [true, false]) {
                for (const wired of [true, false]) {
                    const host: ArcCommandHost = {
                        openWorkspace: () => {},
                        capabilities: { canvas, vault },
                        commands: wired
                            ? Object.fromEntries(ALL_COMMANDS.map((id) => [id, () => {}]))
                            : {},
                    }
                    const pruned = pruneDeadArcActions(fullTree(), host)
                    for (const leaf of collectArcLeaves(pruned)) {
                        expect(routeArcAction(leaf, host), leaf.id).toBe(true)
                    }
                }
            }
        }
    })
})
