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
    it("has exactly the four navigation categories, in order", () => {
        expect(WORKSHOP_CATEGORIES.map((c) => c.label)).toEqual([
            "Players",
            "Systems",
            "Customization",
            "Testing Lab",
        ])
    })

    it("gives every entry a unique id and a real category", () => {
        const ids = WORKSHOP_ENTRIES.map((e) => e.id)
        expect(new Set(ids).size).toBe(ids.length)
        const categories = new Set(WORKSHOP_CATEGORIES.map((c) => c.id))
        for (const entry of WORKSHOP_ENTRIES) expect(categories.has(entry.category)).toBe(true)
    })

    it("shows cards in every category", () => {
        for (const category of WORKSHOP_CATEGORIES) {
            expect(entriesForCategory(category.id).length).toBeGreaterThan(0)
        }
    })

    it("registers exactly one workspace per workspace entry", () => {
        const entryIds = workspaceEntries()
            .map((e) => e.id)
            .sort()
        expect(Object.keys(WORKSPACES).sort()).toEqual(entryIds)
    })

    it("leads Players with New Face, a blank surface of its own", () => {
        const [first] = entriesForCategory("players")
        expect(first.id).toBe("new-face")
        expect(entryTarget(first)).toEqual({ workspace: "new-face" })
        expect(WORKSPACES["new-face"]).toBeDefined()
    })

    it("points scenario cards at the Mix & Match Lab", () => {
        const scenarioCards = WORKSHOP_ENTRIES.filter((e) => e.opens)
        expect(scenarioCards.length).toBeGreaterThan(0)
        for (const card of scenarioCards) {
            expect(card.category).toBe("testing-lab")
            expect(card.opens?.workspace).toBe("testing-lab")
            expect(card.opens?.params?.scenario).toBeTruthy()
        }
    })

    it("never lets a roadmap record open a workspace", () => {
        const roadmap = WORKSHOP_ENTRIES.filter((e) => e.status === "roadmap")
        expect(roadmap.map((e) => e.id).sort()).toEqual(["canvas-mode", "queue-row"])
        for (const entry of roadmap) {
            expect(entryTarget(entry)).toBeNull()
            expect(WORKSPACES[entry.id]).toBeUndefined()
        }
    })

    it("names the placeholders for every partial or unbuilt piece", () => {
        for (const entry of WORKSHOP_ENTRIES) {
            if (entry.status === "partial" || entry.status === "roadmap") {
                expect(entry.placeholders?.length ?? 0).toBeGreaterThan(0)
            }
            if (!entry.opens && entry.status !== "roadmap") {
                expect(entry.working.length).toBeGreaterThan(0)
            }
        }
    })
})
