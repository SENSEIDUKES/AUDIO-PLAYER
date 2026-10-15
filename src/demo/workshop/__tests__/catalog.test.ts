import { describe, expect, it } from "vitest"
import {
    WORKSHOP_CATEGORIES,
    WORKSHOP_ENTRIES,
    entriesForCategory,
    entryTarget,
    workspaceEntries,
} from "../catalog"
import { WORKSPACES } from "../registry"

describe("Workshop catalog", () => {
    it("has exactly the three tabs, in order", () => {
        expect(WORKSHOP_CATEGORIES.map((c) => c.label)).toEqual([
            "Player",
            "Novels (SEN)",
            "Engine",
        ])
    })

    it("leads the Player tab with the blank New player stage", () => {
        const [first, second] = entriesForCategory("player")
        expect(first.id).toBe("new-player")
        expect(entryTarget(first)).toEqual({ workspace: "new-player" })
        expect(second.id).toBe("narrative-face")
    })

    it("opens the Reader mixer from the Novels tab", () => {
        const [first] = entriesForCategory("novels")
        expect(first.id).toBe("reader-mixer")
        expect(WORKSPACES["reader-mixer"]).toBeDefined()
    })

    it("gives every entry a unique id and a real category", () => {
        const ids = WORKSHOP_ENTRIES.map((e) => e.id)
        expect(new Set(ids).size).toBe(ids.length)
        const categories = new Set(WORKSHOP_CATEGORIES.map((c) => c.id))
        for (const entry of WORKSHOP_ENTRIES) expect(categories.has(entry.category)).toBe(true)
    })

    it("shows cards in every tab", () => {
        for (const category of WORKSHOP_CATEGORIES) {
            expect(entriesForCategory(category.id).length).toBeGreaterThan(0)
        }
    })

    it("registers exactly one workspace per entry", () => {
        const entryIds = workspaceEntries()
            .map((e) => e.id)
            .sort()
        expect(Object.keys(WORKSPACES).sort()).toEqual(entryIds)
    })

    it("no longer lists any archived v4 face or tool", () => {
        const ids = new Set(WORKSHOP_ENTRIES.map((e) => e.id))
        for (const archived of [
            "new-face",
            "portable-player",
            "full-card",
            "sea-card",
            "sticky-bottom",
            "mini-sidebar",
            "vault-row",
            "testing-lab",
            "themes",
        ]) {
            expect(ids.has(archived)).toBe(false)
        }
    })

    it("names what isn't working for every partial or unbuilt piece", () => {
        for (const entry of WORKSHOP_ENTRIES) {
            if (entry.status !== "live") {
                expect(entry.placeholders?.length ?? 0).toBeGreaterThan(0)
            }
            expect(entry.working.length).toBeGreaterThan(0)
        }
    })
})
