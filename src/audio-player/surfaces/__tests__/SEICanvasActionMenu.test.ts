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

    it("disables the Canvas node on faces without canvas support", () => {
        const tree = buildMenuTree({ canvasSupported: false, isCanvasActive: false })
        expect(findNode(tree, "canvas")?.state).toBe("disabled")
    })

    it("marks the Canvas node active when the canvas surface is open", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: true })
        expect(findNode(tree, "canvas")?.state).toBe("active")
    })

    it("keeps coming-soon placeholders non-interactive", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        const agent = findNode(tree, "agent")!
        expect(agent.state).toBe("coming-soon")
        expect(isNodeInteractive(agent)).toBe(false)
    })

    it("treats available and inactive nodes as interactive", () => {
        const tree = buildMenuTree({ canvasSupported: true, isCanvasActive: false })
        expect(isNodeInteractive(findNode(tree, "up-next")!)).toBe(true)
        expect(isNodeInteractive(findNode(tree, "lyrics")!)).toBe(true)
    })
})
