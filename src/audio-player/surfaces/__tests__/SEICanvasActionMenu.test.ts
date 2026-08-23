import { describe, expect, it } from "vitest"
import { arcOffsets, ARC_RADIUS } from "../SEICanvasActionMenu"
import { isNodeInteractive } from "../../menu/menuData"

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

describe("isNodeInteractive", () => {
    it("treats available (and unset) nodes as interactive", () => {
        expect(isNodeInteractive({ id: "a", label: "A", icon: () => null })).toBe(true)
        expect(
            isNodeInteractive({ id: "a", label: "A", icon: () => null, state: "available" })
        ).toBe(true)
        expect(isNodeInteractive({ id: "a", label: "A", icon: () => null, state: "active" })).toBe(
            true
        )
    })

    it("blocks disabled and locked nodes", () => {
        expect(
            isNodeInteractive({ id: "a", label: "A", icon: () => null, state: "disabled" })
        ).toBe(false)
        expect(isNodeInteractive({ id: "a", label: "A", icon: () => null, state: "locked" })).toBe(
            false
        )
    })
})
