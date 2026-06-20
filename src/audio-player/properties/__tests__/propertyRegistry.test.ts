import { describe, expect, it } from "vitest"
import type { PlayerFace } from "../../surfaces/faceCapabilities"
import { PLAYER_FACE_CAPABILITIES } from "../../surfaces/faceCapabilities"
import {
    PROPERTY_REGISTRY,
    PROPERTY_GROUPS,
    MAJOR_FACES,
    getPropertiesForFace,
    getPropertiesForGroup,
    getPropertyDefaults,
    getByPropPath,
    setByPropPath,
} from "../propertyRegistry"

const ALL_FACES = Object.keys(PLAYER_FACE_CAPABILITIES) as PlayerFace[]

describe("property registry shape", () => {
    it("has unique ids", () => {
        const ids = PROPERTY_REGISTRY.map((d) => d.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("every descriptor has a valid group and a default", () => {
        for (const d of PROPERTY_REGISTRY) {
            expect(PROPERTY_GROUPS).toContain(d.group)
            expect(d).toHaveProperty("default")
            expect(d.propPath.length).toBeGreaterThan(0)
        }
    })

    it("every face exposes at least one property", () => {
        for (const face of ALL_FACES) {
            expect(getPropertiesForFace(face).length).toBeGreaterThan(0)
        }
    })
})

describe("per-face applicability", () => {
    it("exposes the six theme colors on every face", () => {
        const colorIds = [
            "accentColor",
            "playIconColor",
            "textColor",
            "progressColor",
            "trackColor",
            "backgroundColor",
        ]
        for (const face of ALL_FACES) {
            const ids = getPropertiesForFace(face).map((d) => d.id)
            for (const id of colorIds) expect(ids).toContain(id)
        }
    })

    it("exposes glow and button-fill material controls on every face", () => {
        const materialIds = ["glowColor", "glowIntensity", "buttonOpacity"]
        for (const face of ALL_FACES) {
            const ids = getPropertiesForFace(face).map((d) => d.id)
            for (const id of materialIds) expect(ids).toContain(id)
        }
    })

    it("gives the major faces parity on media, typography, and core playback", () => {
        for (const face of MAJOR_FACES) {
            const ids = getPropertiesForFace(face).map((d) => d.id)
            // at least one media property (background or art)
            expect(
                ids.includes("backgroundMedia") || ids.includes("artMedia")
            ).toBe(true)
            // typography
            expect(ids).toContain("titleFont")
            expect(ids).toContain("artistFont")
            // core playback
            expect(ids).toContain("autoPlay")
            expect(ids).toContain("repeatMode")
        }
    })

    it("keeps AudioPlayer-only surfaces off other faces", () => {
        // showTracklist / showWaveform are portable-only.
        for (const face of ALL_FACES) {
            const ids = getPropertiesForFace(face).map((d) => d.id)
            if (face === "portable") {
                expect(ids).toContain("showTracklist")
                expect(ids).toContain("showWaveform")
            } else {
                expect(ids).not.toContain("showTracklist")
                expect(ids).not.toContain("showWaveform")
            }
        }
    })
})

describe("grouping", () => {
    it("partitions a face's properties across the four sections", () => {
        const face: PlayerFace = "portable"
        const all = getPropertiesForFace(face)
        const grouped = PROPERTY_GROUPS.flatMap((g) =>
            getPropertiesForGroup(face, g)
        )
        expect(grouped.length).toBe(all.length)
    })
})

describe("defaults", () => {
    it("matches the long-standing literal defaults", () => {
        const d = getPropertyDefaults()
        expect(getByPropPath(d, "theme.accentColor")).toBe("#7C5CFF")
        expect(getByPropPath(d, "theme.glowColor")).toBe("transparent")
        expect(getByPropPath(d, "theme.glowIntensity")).toBe(100)
        expect(getByPropPath(d, "theme.buttonOpacity")).toBe(0)
        expect(getByPropPath(d, "blurSize")).toBe(20)
        expect(getByPropPath(d, "darkenAmount")).toBe(45)
        expect(getByPropPath(d, "repeatMode")).toBe("off")
        expect(getByPropPath(d, "showTracklist")).toBe(true)
        expect(getByPropPath(d, "titleFont")).toMatchObject({
            fontSize: "24px",
            fontWeight: 600,
        })
    })
})

describe("path helpers", () => {
    it("sets nested values immutably", () => {
        const base = { theme: { accentColor: "#000" }, blurSize: 0 }
        const next = setByPropPath(base, "theme.accentColor", "#fff")
        expect(next.theme.accentColor).toBe("#fff")
        // original untouched
        expect(base.theme.accentColor).toBe("#000")
        // siblings preserved
        expect(next.blurSize).toBe(0)
    })

    it("refuses to pollute the prototype chain", () => {
        setByPropPath({}, "__proto__.polluted", "yes")
        setByPropPath({}, "constructor.prototype.polluted", "yes")
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
        expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    })
})
