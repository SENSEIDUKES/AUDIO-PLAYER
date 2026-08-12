import { describe, expect, it } from "vitest"
import { WORKSPACE_ROUTES, isWorkspaceRoute, parseWorkspaceRoute } from "../workspaceRoutes"

describe("isWorkspaceRoute", () => {
    it("accepts every known route", () => {
        for (const route of WORKSPACE_ROUTES) {
            expect(isWorkspaceRoute(route)).toBe(true)
        }
    })

    it("rejects unknown strings", () => {
        expect(isWorkspaceRoute("nope")).toBe(false)
        expect(isWorkspaceRoute("library:")).toBe(false)
        expect(isWorkspaceRoute("plugin-settings:unknown")).toBe(false)
        expect(isWorkspaceRoute("")).toBe(false)
    })
})

describe("parseWorkspaceRoute", () => {
    it("returns null for invalid / empty input", () => {
        expect(parseWorkspaceRoute(undefined)).toBeNull()
        expect(parseWorkspaceRoute(null)).toBeNull()
        expect(parseWorkspaceRoute("")).toBeNull()
        expect(parseWorkspaceRoute("bogus:route")).toBeNull()
    })

    it("parses the bare options route with no target", () => {
        expect(parseWorkspaceRoute("options")).toEqual({
            route: "options",
            category: "options",
            target: null,
        })
    })

    it("splits a category:target route", () => {
        expect(parseWorkspaceRoute("plugin-settings:lyrics")).toEqual({
            route: "plugin-settings:lyrics",
            category: "plugin-settings",
            target: "lyrics",
        })
        expect(parseWorkspaceRoute("library:queue")).toEqual({
            route: "library:queue",
            category: "library",
            target: "queue",
        })
    })

    it("categorizes every known non-options route", () => {
        for (const route of WORKSPACE_ROUTES) {
            if (route === "options") continue
            const parsed = parseWorkspaceRoute(route)
            expect(parsed).not.toBeNull()
            expect(parsed!.category).toBe(route.slice(0, route.indexOf(":")))
            expect(parsed!.target).toBe(route.slice(route.indexOf(":") + 1))
        }
    })
})
