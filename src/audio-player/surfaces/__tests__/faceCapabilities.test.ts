import { describe, expect, it } from "vitest"
import {
    PLAYER_FACE_CAPABILITIES,
    faceSupportsAction,
    faceSupportsContextualActions,
    faceSupportsHeroCollapse,
    faceSupportsSEICanvas,
    faceSupportsScrubberCanvas,
    faceSupportsWaveform,
    getFaceFamily,
    getPreferredCanvasPlacement,
    getScrubberDensity,
    getScrubberHeight,
} from "../faceCapabilities"
import type { PlayerFace } from "../faceCapabilities"

const ALL_FACES: PlayerFace[] = [
    "fullCard",
    "miniSidebar",
    "seaCard",
    "stickyBottom",
    "vaultRow",
    "portable",
]

describe("PLAYER_FACE_CAPABILITIES", () => {
    it("declares an entry for every face", () => {
        for (const face of ALL_FACES) {
            expect(PLAYER_FACE_CAPABILITIES[face]).toBeDefined()
        }
    })

    it("supports SEICanvas only on large faces (fullCard, seaCard, portable)", () => {
        expect(faceSupportsSEICanvas("fullCard")).toBe(true)
        expect(faceSupportsSEICanvas("seaCard")).toBe(true)
        expect(faceSupportsSEICanvas("portable")).toBe(true)
        expect(faceSupportsSEICanvas("miniSidebar")).toBe(false)
        expect(faceSupportsSEICanvas("stickyBottom")).toBe(false)
        expect(faceSupportsSEICanvas("vaultRow")).toBe(false)
    })

    it("assigns each face to a family", () => {
        expect(getFaceFamily("fullCard")).toBe("primary")
        expect(getFaceFamily("seaCard")).toBe("primary")
        expect(getFaceFamily("portable")).toBe("primary")
        expect(getFaceFamily("miniSidebar")).toBe("compact")
        expect(getFaceFamily("stickyBottom")).toBe("compact")
        expect(getFaceFamily("vaultRow")).toBe("compact")
    })

    it("mounts ScrubberCanvas on primary faces and the compact master only", () => {
        // Compact rows/mini defer to the shared StickyBottom master scrubber, so
        // they declare no scrubber zone of their own.
        expect(faceSupportsScrubberCanvas("fullCard")).toBe(true)
        expect(faceSupportsScrubberCanvas("seaCard")).toBe(true)
        expect(faceSupportsScrubberCanvas("portable")).toBe(true)
        expect(faceSupportsScrubberCanvas("stickyBottom")).toBe(true)
        expect(faceSupportsScrubberCanvas("miniSidebar")).toBe(false)
        expect(faceSupportsScrubberCanvas("vaultRow")).toBe(false)
    })

    it("gives every face an action button (incl. the vault row)", () => {
        for (const face of ALL_FACES) {
            expect(faceSupportsAction(face)).toBe(true)
        }
        expect(faceSupportsAction("vaultRow")).toBe(true)
    })

    it("enables the contextual radial menu only on faces that render it", () => {
        // fullCard + miniSidebar host PlayerSurfaceButtons; the rest rely on the
        // SAPController three-dot sheet (or have no menu room) and must opt out.
        expect(faceSupportsContextualActions("fullCard")).toBe(true)
        expect(faceSupportsContextualActions("miniSidebar")).toBe(true)
        expect(faceSupportsContextualActions("portable")).toBe(true)
        expect(faceSupportsContextualActions("seaCard")).toBe(false)
        expect(faceSupportsContextualActions("stickyBottom")).toBe(false)
        expect(faceSupportsContextualActions("vaultRow")).toBe(false)
    })

    it("declares supportsContextualActions for every face", () => {
        for (const face of ALL_FACES) {
            expect(
                typeof PLAYER_FACE_CAPABILITIES[face].supportsContextualActions
            ).toBe("boolean")
        }
    })

    it("opts spacious faces into the waveform and compact faces out", () => {
        expect(faceSupportsWaveform("fullCard")).toBe(true)
        expect(faceSupportsWaveform("portable")).toBe(true)
        expect(faceSupportsWaveform("seaCard")).toBe(true)
        expect(faceSupportsWaveform("miniSidebar")).toBe(false)
        expect(faceSupportsWaveform("stickyBottom")).toBe(false)
        expect(faceSupportsWaveform("vaultRow")).toBe(false)
    })

    it("declares supportsWaveform for every face", () => {
        for (const face of ALL_FACES) {
            expect(typeof PLAYER_FACE_CAPABILITIES[face].supportsWaveform).toBe(
                "boolean"
            )
        }
    })

    it("maps scrubber density to a waveform height", () => {
        expect(getScrubberHeight("compact")).toBe(28)
        expect(getScrubberHeight("standard")).toBe(48)
        expect(getScrubberHeight("expanded")).toBe(64)
    })

    it("reports hero collapse from declared capability", () => {
        expect(faceSupportsHeroCollapse("fullCard")).toBe(true)
        expect(faceSupportsHeroCollapse("miniSidebar")).toBe(false)
    })

    it("returns the declared scrubber density per face", () => {
        expect(getScrubberDensity("fullCard")).toBe("standard")
        expect(getScrubberDensity("portable")).toBe("expanded")
        expect(getScrubberDensity("miniSidebar")).toBe("compact")
    })

    it("returns 'none' canvas placement for non-canvas faces", () => {
        expect(getPreferredCanvasPlacement("miniSidebar")).toBe("none")
        expect(getPreferredCanvasPlacement("stickyBottom")).toBe("none")
        expect(getPreferredCanvasPlacement("vaultRow")).toBe("none")
        expect(getPreferredCanvasPlacement("fullCard")).toBe("main")
        expect(getPreferredCanvasPlacement("seaCard")).toBe("overlay")
    })
})
