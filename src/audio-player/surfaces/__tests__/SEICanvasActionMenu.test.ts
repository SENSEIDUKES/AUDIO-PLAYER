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

    it("exposes Up Next and Canvas as leaf actions in the expected places", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        expect(findNode(tree, "up-next")?.actionId).toBe("open-queue")
        expect(findNode(tree, "canvas")?.actionId).toBe("activate-canvas")
    })

    it("omits the Canvas node entirely on faces without canvas support (no dead buttons)", () => {
        const tree = buildMenuTree({ canvasSupported: false, isCanvasActive: false })
        expect(findNode(tree, "canvas")).toBeUndefined()
        // With no visual leaves left, the whole Plugin branch disappears too.
        expect(findNode(tree, "plugin")).toBeUndefined()
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
        })
        for (const node of collect(tree)) {
            expect(node.state).not.toBe("coming-soon")
        }
    })

    it("includes workspace-only nodes only when the host routes workspaces", () => {
        const unrouted = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        for (const id of ["lyrics", "automix", "agent", "activity-log"]) {
            expect(findNode(unrouted, id)).toBeUndefined()
        }
        const routed = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
        })
        expect(findNode(routed, "lyrics")?.workspaceRoute).toBe("plugin-settings:lyrics")
        expect(findNode(routed, "automix")?.workspaceRoute).toBe("playback:automix")
        expect(findNode(routed, "agent")?.workspaceRoute).toBe("agent:queue-director")
        expect(findNode(routed, "activity-log")?.workspaceRoute).toBe(
            "diagnostics:activity-log"
        )
        expect(isNodeInteractive(findNode(routed, "agent")!)).toBe(true)
    })

    it("treats available and inactive nodes as interactive", () => {
        const tree = buildMenuTree({
            canvasSupported: true,
            isCanvasActive: false,
            canRouteWorkspaces: true,
        })
        expect(isNodeInteractive(findNode(tree, "up-next")!)).toBe(true)
        expect(isNodeInteractive(findNode(tree, "lyrics")!)).toBe(true)
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
