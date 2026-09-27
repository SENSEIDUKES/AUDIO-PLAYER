import { describe, expect, it } from "vitest"
import { isTrackSetId } from "../../../data"
import {
    CONTEXTS,
    SCENARIO_PRESETS,
    frameSrc,
    normalizeLabConfig,
    parseLabConfig,
    serializeLabConfig,
} from "../labConfig"
import type { LabConfig, Scenario } from "../labConfig"

const parse = (query: string) => parseLabConfig(new URLSearchParams(query))

describe("Mix & Match Lab config", () => {
    it("starts from Free play in the app shell", () => {
        expect(parse("")).toEqual(SCENARIO_PRESETS.free)
        expect(parse("").context).toBe("shell")
    })

    it("links every scenario preset with just its name", () => {
        for (const scenario of Object.keys(SCENARIO_PRESETS) as Scenario[]) {
            const preset = SCENARIO_PRESETS[scenario]
            const params = serializeLabConfig(preset)
            expect(params.toString()).toBe(scenario === "free" ? "" : `scenario=${scenario}`)
            expect(parseLabConfig(params)).toEqual(preset)
        }
    })

    it("presets the four test scenarios", () => {
        expect(SCENARIO_PRESETS.mobile.viewport).toBe("375")
        expect(SCENARIO_PRESETS.errors.context).toBe("states")
        expect(SCENARIO_PRESETS.stress.context).toBe("bare")
        expect(SCENARIO_PRESETS.playback.plugins).toEqual(["keyboard", "lyrics"])
    })

    it("round-trips any combination through the URL, keeping only the changes", () => {
        const config: LabConfig = {
            ...SCENARIO_PRESETS.mobile,
            viewport: "matrix",
            context: "marketplace",
            main: "portable",
            bar: false,
            tracks: "narration",
            plugins: ["waveform", "sleep"],
            shuffle: true,
            repeat: "one",
            backend: "webaudio",
            policy: "skip",
            theme: "green",
        }
        const params = serializeLabConfig(config)
        expect(params.get("scenario")).toBe("mobile")
        expect(params.get("plugins")).toBe("waveform,sleep")
        expect(params.get("bar")).toBe("0")
        expect(params.has("sidebar")).toBe(false)
        expect(parseLabConfig(params)).toEqual(config)
    })

    it("falls back to the scenario's values for anything it does not recognize", () => {
        const config = parse(
            "scenario=stress&viewport=999&context=moon&repeat=twice&plugins=keyboard,bogus&bar=maybe"
        )
        expect(config.viewport).toBe(SCENARIO_PRESETS.stress.viewport)
        expect(config.context).toBe("bare")
        expect(config.repeat).toBe("all")
        expect(config.plugins).toEqual(["keyboard"])
        expect(config.bar).toBe(SCENARIO_PRESETS.stress.bar)
        expect(parse("scenario=nope").scenario).toBe("free")
    })

    it("only accepts real track sets, never inherited object keys", () => {
        expect(isTrackSetId("narration")).toBe(true)
        for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
            expect(isTrackSetId(key)).toBe(false)
            expect(parse(`tracks=${key}`).tracks).toBe(SCENARIO_PRESETS.free.tracks)
        }
    })

    it("keeps the main face valid for the chosen context", () => {
        const phone = normalizeLabConfig({
            ...SCENARIO_PRESETS.free,
            context: "phone",
            main: "sea-grid",
        })
        expect(phone.main).toBe(CONTEXTS.phone.mains[0])
        const shell = normalizeLabConfig({
            ...SCENARIO_PRESETS.free,
            context: "shell",
            main: "narrative",
        })
        expect(shell.main).toBe("narrative")
        expect(parse("context=vault&main=portable").main).toBe("vault-list")
    })

    it("carries a New Face composition to the preview page", () => {
        const config: LabConfig = { ...SCENARIO_PRESETS.free, main: "custom", face: "eyJ2IjoxfQ" }
        const params = serializeLabConfig(config)
        expect(params.get("main")).toBe("custom")
        expect(params.get("face")).toBe("eyJ2IjoxfQ")
        expect(parseLabConfig(params)).toEqual(config)
        const src = new URLSearchParams(frameSrc(config, "main").slice(1))
        expect(src.get("face")).toBe("eyJ2IjoxfQ")
        expect(src.get("main")).toBe("custom")
    })

    it("offers New Face where a face can stand on its own", () => {
        for (const context of ["shell", "phone", "bare"] as const) {
            expect(CONTEXTS[context].mains).toContain("custom")
            expect(parse(`context=${context}&main=custom`).main).toBe("custom")
        }
        expect(parse("context=marketplace&main=custom").main).toBe("sea-grid")
    })

    it("builds preview page links without the viewport, so resizing never reloads", () => {
        const config: LabConfig = { ...SCENARIO_PRESETS.mobile, viewport: "430", shuffle: true }
        const src = new URLSearchParams(frameSrc(config, "w430").slice(1))
        expect(src.get("frame")).toBe("lab")
        expect(src.get("fid")).toBe("w430")
        expect(src.get("scenario")).toBe("mobile")
        expect(src.get("shuffle")).toBe("1")
        expect(src.has("viewport")).toBe(false)
        expect(src.has("r")).toBe(false)
        expect(frameSrc(config, "w430")).toBe(frameSrc({ ...config, viewport: "320" }, "w430"))
        expect(new URLSearchParams(frameSrc(config, "main", 3).slice(1)).get("r")).toBe("3")
    })
})
