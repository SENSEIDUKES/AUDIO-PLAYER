import { expect, it } from "vitest"
import { computeLoudnessGain } from "../../audio-player"
import catalog from "../readerLoudness.json"

it("reports seven measured beds without changing any catalog source gain", () => {
    const flagged: string[] = []
    for (const item of catalog) {
        const kind = item.kind as "integrated" | "momentary-max"
        const result = computeLoudnessGain({ ...item.loudness, kind }, kind)
        // Exponentiation can round differently across supported Node versions.
        expect(result.gain).toBeCloseTo(item.leveling.gain, 12)
        expect(result.appliedGainDb).toBe(item.leveling.appliedGainDb)
        if (result.tooQuietToLevel) flagged.push(item.id)
    }
    expect(flagged.sort()).toEqual([
        "cave",
        "forest",
        "gentle-rain",
        "gentle-wind",
        "strong-wind",
        "village",
        "waves",
    ])
})
