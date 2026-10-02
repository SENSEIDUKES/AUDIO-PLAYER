import { describe, expect, it } from "vitest"
import { SEN_SOUNDSCAPES_VOLUME_1, SEN_SOUNDSCAPE_CATEGORIES } from "../senSoundscapes"

describe("SEN Soundscapes Volume 1", () => {
    it("lists all 43 scores from the pack, each with a unique id", () => {
        expect(SEN_SOUNDSCAPES_VOLUME_1).toHaveLength(43)
        const ids = SEN_SOUNDSCAPES_VOLUME_1.map((score) => score.id)
        expect(new Set(ids).size).toBe(43)
    })

    it("keeps the pack's five categories, in order", () => {
        const counts = SEN_SOUNDSCAPE_CATEGORIES.map(
            (category) =>
                SEN_SOUNDSCAPES_VOLUME_1.filter((score) => score.category === category).length
        )
        expect(counts).toEqual([10, 10, 10, 10, 3])
    })

    it("plays from the CORS-enabled SEIHouse media host", () => {
        for (const score of SEN_SOUNDSCAPES_VOLUME_1) {
            expect(score.url).toMatch(/^https:\/\/media\.seihouse\.org\/SEN\/AUDIO\/SOUNDSCAPE\//)
            expect(score.durationSeconds).toBeGreaterThan(0)
        }
    })
})
