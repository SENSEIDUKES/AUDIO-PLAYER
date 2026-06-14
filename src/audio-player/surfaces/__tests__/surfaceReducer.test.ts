import { describe, expect, it } from "vitest"
import {
    INITIAL_SURFACE_STATE,
    canEnterCanvas,
    deriveHeroCollapsed,
    surfaceReducer,
} from "../surfaceReducer"

describe("surfaceReducer", () => {
    it("starts in default mode", () => {
        expect(INITIAL_SURFACE_STATE.mode).toBe("default")
    })

    it("rejects canvas on a face that doesn't support it", () => {
        const next = surfaceReducer(
            INITIAL_SURFACE_STATE,
            { type: "toggleCanvas" },
            "miniSidebar"
        )
        expect(next.mode).toBe("default")
        expect(canEnterCanvas("miniSidebar")).toBe(false)
    })

    it("toggles canvas on a supported face: default -> canvas -> default", () => {
        const opened = surfaceReducer(
            INITIAL_SURFACE_STATE,
            { type: "toggleCanvas" },
            "fullCard"
        )
        expect(opened.mode).toBe("canvas")
        const closed = surfaceReducer(opened, { type: "toggleCanvas" }, "fullCard")
        expect(closed.mode).toBe("default")
    })

    it("toggles queue on any face: default -> queue -> default", () => {
        const opened = surfaceReducer(
            INITIAL_SURFACE_STATE,
            { type: "toggleQueue" },
            "miniSidebar"
        )
        expect(opened.mode).toBe("queue")
        const closed = surfaceReducer(opened, { type: "toggleQueue" }, "miniSidebar")
        expect(closed.mode).toBe("default")
    })

    it("keeps only one surface open: opening canvas while queue is open", () => {
        const queueOpen = surfaceReducer(
            INITIAL_SURFACE_STATE,
            { type: "toggleQueue" },
            "fullCard"
        )
        expect(queueOpen.mode).toBe("queue")
        const canvasOpen = surfaceReducer(
            queueOpen,
            { type: "toggleCanvas" },
            "fullCard"
        )
        expect(canvasOpen.mode).toBe("canvas")
    })

    it("guards open action the same as toggle", () => {
        expect(
            surfaceReducer(INITIAL_SURFACE_STATE, { type: "open", mode: "canvas" }, "miniSidebar").mode
        ).toBe("default")
        expect(
            surfaceReducer(INITIAL_SURFACE_STATE, { type: "open", mode: "canvas" }, "fullCard").mode
        ).toBe("canvas")
        expect(
            surfaceReducer(INITIAL_SURFACE_STATE, { type: "open", mode: "queue" }, "miniSidebar").mode
        ).toBe("queue")
    })

    it("close always returns to default", () => {
        const queueOpen = surfaceReducer(
            INITIAL_SURFACE_STATE,
            { type: "toggleQueue" },
            "fullCard"
        )
        expect(surfaceReducer(queueOpen, { type: "close" }, "fullCard").mode).toBe(
            "default"
        )
    })
})

describe("deriveHeroCollapsed", () => {
    it("is true only when canvas is open on a hero-collapse face", () => {
        expect(deriveHeroCollapsed("canvas", "fullCard")).toBe(true)
        expect(deriveHeroCollapsed("queue", "fullCard")).toBe(false)
        expect(deriveHeroCollapsed("default", "fullCard")).toBe(false)
        // miniSidebar can't even reach canvas, and doesn't collapse.
        expect(deriveHeroCollapsed("canvas", "miniSidebar")).toBe(false)
    })
})
