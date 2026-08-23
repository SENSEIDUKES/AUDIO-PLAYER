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
        const next = surfaceReducer(INITIAL_SURFACE_STATE, { type: "toggleCanvas" }, "miniSidebar")
        expect(next.mode).toBe("default")
        expect(canEnterCanvas("miniSidebar")).toBe(false)
    })

    it("toggles canvas on a supported face: default -> canvas -> default", () => {
        const opened = surfaceReducer(INITIAL_SURFACE_STATE, { type: "toggleCanvas" }, "fullCard")
        expect(opened.mode).toBe("canvas")
        const closed = surfaceReducer(opened, { type: "toggleCanvas" }, "fullCard")
        expect(closed.mode).toBe("default")
    })

    it("guards open action the same as toggle", () => {
        expect(
            surfaceReducer(INITIAL_SURFACE_STATE, { type: "open", mode: "canvas" }, "miniSidebar")
                .mode
        ).toBe("default")
        expect(
            surfaceReducer(INITIAL_SURFACE_STATE, { type: "open", mode: "canvas" }, "fullCard").mode
        ).toBe("canvas")
    })

    it("close always returns to default", () => {
        const canvasOpen = surfaceReducer(
            INITIAL_SURFACE_STATE,
            { type: "toggleCanvas" },
            "fullCard"
        )
        expect(surfaceReducer(canvasOpen, { type: "close" }, "fullCard").mode).toBe("default")
    })
})

describe("deriveHeroCollapsed", () => {
    it("is true only when canvas is open on a hero-collapse face", () => {
        expect(deriveHeroCollapsed("canvas", "fullCard")).toBe(true)
        expect(deriveHeroCollapsed("default", "fullCard")).toBe(false)
        // miniSidebar can't even reach canvas, and doesn't collapse.
        expect(deriveHeroCollapsed("canvas", "miniSidebar")).toBe(false)
    })
})
