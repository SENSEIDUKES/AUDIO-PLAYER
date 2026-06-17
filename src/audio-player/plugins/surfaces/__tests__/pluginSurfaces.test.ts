import { describe, expect, it } from "vitest"
import {
    hasSettingsSurface,
    hasCanvasSurface,
    isHeadlessPlugin,
    getPluginSettingsRoute,
    getPluginCanvasSurfaceId,
    sortPluginSurfaceDefinitions,
} from "../pluginSurfaceHelpers"
import {
    DEFAULT_PLUGIN_SURFACES,
    getPluginSurfaceDefinition,
    getPluginSurfaceDefinitionsByCategory,
    getPluginSurfaceDefinitionsForMenuBranch,
} from "../defaultPluginSurfaces"
import type { PluginSurfaceDefinition } from "../pluginSurfaceTypes"

const byId = (id: string): PluginSurfaceDefinition => {
    const def = getPluginSurfaceDefinition(id)
    if (!def) throw new Error(`missing fixture: ${id}`)
    return def
}

describe("surface helpers", () => {
    it("headless plugins report no settings or canvas surface", () => {
        const keyboard = byId("keyboard-shortcuts")
        expect(hasSettingsSurface(keyboard)).toBe(false)
        expect(hasCanvasSurface(keyboard)).toBe(false)
        expect(isHeadlessPlugin(keyboard)).toBe(true)
        expect(getPluginSettingsRoute(keyboard)).toBeUndefined()
        expect(getPluginCanvasSurfaceId(keyboard)).toBeUndefined()
    })

    it("lyrics reports both a settings and a canvas surface", () => {
        const lyrics = byId("lyrics")
        expect(hasSettingsSurface(lyrics)).toBe(true)
        expect(hasCanvasSurface(lyrics)).toBe(true)
        expect(isHeadlessPlugin(lyrics)).toBe(false)
        expect(getPluginCanvasSurfaceId(lyrics)).toBe("lyrics")
        expect(getPluginSettingsRoute(lyrics)).toBe("plugin-settings:lyrics")
    })

    it("automix reports settings only", () => {
        const automix = byId("automix")
        expect(hasSettingsSurface(automix)).toBe(true)
        expect(hasCanvasSurface(automix)).toBe(false)
        expect(getPluginSettingsRoute(automix)).toBe("playback:automix")
    })

    it("waveform has no SEI Canvas surface", () => {
        const waveform = byId("waveform")
        expect(hasCanvasSurface(waveform)).toBe(false)
        expect(getPluginCanvasSurfaceId(waveform)).toBeUndefined()
        expect(hasSettingsSurface(waveform)).toBe(true)
    })
})

describe("sortPluginSurfaceDefinitions", () => {
    it("sorts by menu order then pluginId without mutating the input", () => {
        const input = [...DEFAULT_PLUGIN_SURFACES]
        const snapshot = input.map((d) => d.pluginId)
        const sorted = sortPluginSurfaceDefinitions(input)

        // input untouched
        expect(input.map((d) => d.pluginId)).toEqual(snapshot)
        // new array
        expect(sorted).not.toBe(input)

        // ascending by order, with undefined-order entries last
        const orders = sorted.map((d) => d.menu?.order ?? Number.MAX_SAFE_INTEGER)
        for (let i = 1; i < orders.length; i++) {
            expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1])
        }
    })

    it("is stable / deterministic across repeated calls", () => {
        const a = sortPluginSurfaceDefinitions(DEFAULT_PLUGIN_SURFACES).map((d) => d.pluginId)
        const b = sortPluginSurfaceDefinitions(DEFAULT_PLUGIN_SURFACES).map((d) => d.pluginId)
        expect(a).toEqual(b)
    })

    it("tie-breaks equal orders by pluginId", () => {
        const tie: PluginSurfaceDefinition[] = [
            { pluginId: "zeta", label: "Z", category: "utility", kind: "headless", menu: { order: 1 } },
            { pluginId: "alpha", label: "A", category: "utility", kind: "headless", menu: { order: 1 } },
        ]
        expect(sortPluginSurfaceDefinitions(tie).map((d) => d.pluginId)).toEqual([
            "alpha",
            "zeta",
        ])
    })
})

describe("lookup functions", () => {
    it("returns undefined for an unknown plugin id", () => {
        expect(getPluginSurfaceDefinition("does-not-exist")).toBeUndefined()
    })

    it("lists visual plugins by category", () => {
        const ids = getPluginSurfaceDefinitionsByCategory("visual").map((d) => d.pluginId)
        expect(ids).toContain("lyrics")
        expect(ids).toContain("auto-theme")
        expect(ids).toContain("waveform")
        expect(ids).not.toContain("keyboard-shortcuts")
    })

    it("returns no entries for the reserved agent category", () => {
        expect(getPluginSurfaceDefinitionsByCategory("agent")).toEqual([])
    })

    it("lists plugins for a menu branch in sorted order", () => {
        const visual = getPluginSurfaceDefinitionsForMenuBranch("plugin:visual")
        const ids = visual.map((d) => d.pluginId)
        expect(ids).toEqual(["lyrics", "auto-theme", "waveform"])
    })
})
