import { describe, expect, it } from "vitest"
import {
    contrastText,
    gradient,
    quantizePixels,
    relativeLuminance,
    rgbToCss,
    type Rgb,
} from "../colorExtraction"

/** Build a flat RGBA pixel buffer from a list of opaque colors. */
function pixels(colors: Rgb[]): number[] {
    const buf: number[] = []
    for (const [r, g, b] of colors) buf.push(r, g, b, 255)
    return buf
}

describe("relativeLuminance", () => {
    it("is 0 for black and 1 for white", () => {
        expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5)
        expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5)
    })

    it("ranks green brighter than blue", () => {
        expect(relativeLuminance([0, 255, 0])).toBeGreaterThan(relativeLuminance([0, 0, 255]))
    })
})

describe("contrastText", () => {
    it("uses black text on light backgrounds", () => {
        expect(contrastText([240, 240, 240])).toBe("#000000")
    })

    it("uses white text on dark backgrounds", () => {
        expect(contrastText([20, 20, 30])).toBe("#FFFFFF")
    })
})

describe("rgbToCss", () => {
    it("rounds channels into an rgb() string", () => {
        expect(rgbToCss([10.2, 20.8, 30.5])).toBe("rgb(10, 21, 31)")
    })
})

describe("gradient", () => {
    it("builds a two-stop linear gradient", () => {
        expect(gradient([255, 0, 0], [0, 0, 255])).toBe(
            "linear-gradient(135deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)"
        )
    })
})

describe("quantizePixels", () => {
    it("returns null when there are no usable pixels", () => {
        expect(quantizePixels([])).toBeNull()
    })

    it("picks the most frequent vivid color as primary", () => {
        const data = pixels([
            [200, 30, 30],
            [200, 30, 30],
            [200, 30, 30],
            [30, 60, 200],
        ])
        const palette = quantizePixels(data)
        expect(palette).not.toBeNull()
        expect(palette!.primary[0]).toBeGreaterThan(150) // dominated by red
        expect(palette!.primary[2]).toBeLessThan(80)
    })

    it("finds a distinct secondary color", () => {
        const data = pixels([
            [200, 30, 30],
            [200, 30, 30],
            [30, 60, 200],
        ])
        const palette = quantizePixels(data)!
        // secondary should be the blue-ish bucket, far from primary red
        expect(palette.secondary[2]).toBeGreaterThan(palette.primary[2])
    })

    it("flags dark dominant colors via isDark", () => {
        const dark = quantizePixels(
            pixels([
                [20, 20, 60],
                [20, 20, 60],
            ])
        )!
        const light = quantizePixels(
            pixels([
                [250, 210, 90],
                [250, 210, 90],
            ])
        )!
        expect(dark.isDark).toBe(true)
        expect(light.isDark).toBe(false)
    })

    it("skips near-transparent pixels", () => {
        const data = [
            200,
            30,
            30,
            10, // transparent red, ignored
            30,
            60,
            200,
            255, // opaque blue
        ]
        const palette = quantizePixels(data)!
        expect(palette.primary[2]).toBeGreaterThan(150) // blue won
    })
})
