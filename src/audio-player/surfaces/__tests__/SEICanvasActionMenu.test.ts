import { describe, expect, it } from "vitest"
import { arcOffsets, ARC_RADIUS } from "../SEICanvasActionMenu"
import { buildMenuTree, isNodeInteractive } from "../../menu/menuData"
import type { MenuNode } from "../../menu/menuData"

const APPROX = 1e-9

describe("arcOffsets", () => {
    it("returns nothing for a non-positive count", () => {
        expect(arcOffsets(0)).toEqual([])
        expect(arcOffsets(-3)).toEqual([])
    })

    it("places a single item straight above the pivot", () => {
        expect(arcOffsets(1)).toEqual([{ x: 0, y: -ARC_RADIUS }])
    })

    it("fans items across a half-circle opening upward (left → right)", () => {
        const pts = arcOffsets(3, 100)
        expect(pts).toHaveLength(3)
        // First at 180° (left), last at 0° (right), middle at the top.
        expect(pts[0].x).toBeCloseTo(-100)
        expect(pts[0].y).toBeCloseTo(0)
        expect(pts[1].x).toBeCloseTo(0)
        expect(pts[1].y).toBeCloseTo(-100)
        expect(pts[2].x).toBeCloseTo(100)
        expect(pts[2].y).toBeCloseTo(0)
    })

    it("keeps every point on the circle and above the pivot", () => {
        for (const p of arcOffsets(6, 130)) {
            expect(Math.hypot(p.x, p.y)).toBeCloseTo(130)
            expect(p.y).toBeLessThanOrEqual(APPROX)
        }
    })
})

describe("buildMenuTree", () => {
    function findNode(items: MenuNode[], id: string): MenuNode | undefined {
        for (const node of items) {
            if (node.id === id) return node
            if (node.children) {
                const hit = findNode(node.children, id)
                if (hit) return hit
            }
        }
        return undefined
    }

    it("builds the standardized arms — Plugins | Playback | Share | Agents — on a fully wired host", () => {
        const tree = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
            canShareLink: true,
        })
        expect(tree.map((n) => n.label)).toEqual([
            "Plugins",
            "Playback",
            "Share",
            "Agents",
        ])
    })

    it("exposes Up Next and Canvas as leaf actions in the expected places", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        expect(findNode(tree, "up-next")?.actionId).toBe("open-queue")
        expect(findNode(tree, "canvas")?.actionId).toBe("activate-canvas")
    })

    it("omits the Canvas node entirely on faces without canvas support (no dead buttons)", () => {
        const tree = buildMenuTree({ canvasSupported: false, isCanvasActive: false })
        expect(findNode(tree, "canvas")).toBeUndefined()
        // With no plugin leaves left either, the whole Plugins branch disappears.
        expect(findNode(tree, "plugins")).toBeUndefined()
    })

    it("marks the Canvas node active when the canvas surface is open", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: true })
        expect(findNode(tree, "canvas")?.state).toBe("active")
    })

    it("ships no coming-soon placeholders anywhere in the tree", () => {
        const collect = (nodes: MenuNode[], out: MenuNode[] = []): MenuNode[] => {
            for (const n of nodes) {
                out.push(n)
                if (n.children) collect(n.children, out)
            }
            return out
        }
        const tree = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
            activePluginIds: ["lyrics", "automix", "analytics"],
            canShareLink: true,
            canFavorite: true,
        })
        for (const node of collect(tree)) {
            expect(node.state).not.toBe("coming-soon")
        }
    })

    it("shows only currently active plugins, bucketed under Audio / Visual / Analytics", () => {
        const tree = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
            activePluginIds: ["registry-lyrics", "registry-automix", "analytics"],
        })
        const plugins = findNode(tree, "plugins")!
        const byLabel = Object.fromEntries(
            plugins.children!.map((b) => [b.label, b.children!.map((c) => c.label)])
        )
        expect(byLabel["Audio"]).toEqual(["Automix"])
        expect(byLabel["Visual"]).toEqual(["Lyrics", "Canvas"])
        expect(byLabel["Analytics"]).toEqual(["Analytics"])
        expect(findNode(tree, "plugin-lyrics")?.workspaceRoute).toBe(
            "plugin-settings:lyrics"
        )
        expect(findNode(tree, "plugin-automix")?.workspaceRoute).toBe(
            "playback:automix"
        )
        // An inactive plugin never surfaces.
        expect(findNode(tree, "plugin-waveform")).toBeUndefined()
    })

    it("includes workspace-only nodes only when the host routes workspaces", () => {
        const unrouted = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            activePluginIds: ["lyrics"],
        })
        for (const id of [
            "plugin-lyrics",
            "controls",
            "debug",
            "share-add-to",
            "agents",
        ]) {
            expect(findNode(unrouted, id)).toBeUndefined()
        }
        const routed = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
            activePluginIds: ["lyrics"],
        })
        expect(findNode(routed, "plugin-lyrics")?.workspaceRoute).toBe(
            "plugin-settings:lyrics"
        )
        expect(findNode(routed, "controls")?.workspaceRoute).toBe(
            "playback:controls"
        )
        expect(findNode(routed, "debug")?.workspaceRoute).toBe(
            "diagnostics:activity-log"
        )
        expect(findNode(routed, "share-add-to")?.workspaceRoute).toBe(
            "library:vault"
        )
        expect(isNodeInteractive(findNode(routed, "agents")!)).toBe(true)
    })

    it("points Agents › Scout at the Demo tier by default and the Studio tier when entitled", () => {
        const base = { canvasSupported: true, isCanvasActive: false, canRouteWorkspaces: true }
        const demo = buildMenuTree(base)
        expect(findNode(demo, "agent-scout")?.workspaceRoute).toBe("agent:demo-scout")
        expect(findNode(demo, "agent-memoir")?.workspaceRoute).toBe("agent:memoir")
        const studio = buildMenuTree({
            ...base,
            entitlements: { studioScout: true },
        })
        expect(findNode(studio, "agent-scout")?.workspaceRoute).toBe(
            "agent:studio-scout"
        )
    })

    it("adds Share leaves only when the host wires them (Link / Favorite)", () => {
        const none = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        expect(findNode(none, "share")).toBeUndefined()
        const wired = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canShareLink: true,
            canFavorite: true,
            isFavorite: true,
        })
        const share = findNode(wired, "share")!
        expect(share.children!.map((c) => c.label)).toEqual(["Link", "Favorite"])
        expect(findNode(wired, "share-link")?.actionId).toBe("share-link")
        expect(findNode(wired, "share-favorite")?.state).toBe("active")
    })

    it("treats available and inactive nodes as interactive", () => {
        const tree = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
            activePluginIds: ["lyrics"],
        })
        expect(isNodeInteractive(findNode(tree, "up-next")!)).toBe(true)
        expect(isNodeInteractive(findNode(tree, "plugin-lyrics")!)).toBe(true)
    })

    it("attaches the focused workspace route to Up Next", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        expect(findNode(tree, "up-next")?.workspaceRoute).toBe("library:queue")
    })

    it("keeps Up Next's legacy open-queue action as a backward-compat fallback", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        // Hosts without onOpenWorkspace still resolve the queue via actionId.
        expect(findNode(tree, "up-next")?.actionId).toBe("open-queue")
    })

    it("leaves Canvas on its activate-canvas action with no workspace route", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        const canvas = findNode(tree, "canvas")!
        expect(canvas.actionId).toBe("activate-canvas")
        expect(canvas.workspaceRoute).toBeUndefined()
    })
})
