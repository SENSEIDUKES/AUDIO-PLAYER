import { describe, expect, it } from "vitest"
import { AutomixPlugin } from "../../AutomixPlugin"
import { availablePlugins } from "../usePluginRegistry"

describe("plugin registry catalogue", () => {
    it("exposes one unified AutoMix plugin", () => {
        const automixEntries = availablePlugins.filter((entry) =>
            entry.id.includes("automix")
        )

        expect(automixEntries.map((entry) => entry.id)).toEqual(["automix"])
        expect(automixEntries[0]?.label).toBe("AutoMix")
        expect(automixEntries[0]?.description).not.toMatch(/Lite|Pro/)
        const plugin = automixEntries[0]?.factory()
        expect(plugin?.name).toBe("registry-automix")
        expect(plugin).toBeInstanceOf(AutomixPlugin)
        expect((plugin as AutomixPlugin).isSmartAnalysisEnabled()).toBe(true)
    })

    it("does not expose old split entries", () => {
        const ids = availablePlugins.map((entry) => entry.id)

        expect(ids).not.toContain("automix-lite")
        expect(ids).not.toContain("automix-pro")
    })
})
