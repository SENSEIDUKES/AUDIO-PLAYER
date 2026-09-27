/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    homeHref,
    navigate,
    parseRoute,
    useWorkshopRoute,
    useWorkspaceParam,
    workspaceHref,
} from "../routing"

beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, "", "/")
})

describe("Workshop routing", () => {
    it("opens the Players home when there is no query", () => {
        expect(parseRoute("")).toEqual({ kind: "home", category: "players" })
    })

    it("reads a category tab, falling back on unknown ones", () => {
        expect(parseRoute("?category=systems")).toEqual({ kind: "home", category: "systems" })
        expect(parseRoute("?category=nope")).toEqual({ kind: "home", category: "players" })
    })

    it("reads a workspace and keeps its own params", () => {
        const route = parseRoute("?workspace=full-card&tracks=long")
        expect(route.kind).toBe("workspace")
        if (route.kind !== "workspace") return
        expect(route.id).toBe("full-card")
        expect(route.params.get("tracks")).toBe("long")
        expect(route.params.has("workspace")).toBe(false)
    })

    it("builds shareable links", () => {
        expect(homeHref("customization")).toBe("?category=customization")
        expect(workspaceHref({ workspace: "testing-lab", params: { scenario: "mobile" } })).toBe(
            "?workspace=testing-lab&scenario=mobile"
        )
    })

    it("pushes history and re-renders route subscribers", () => {
        const { result } = renderHook(() => useWorkshopRoute())
        expect(result.current).toEqual({ kind: "home", category: "players" })
        const before = window.history.length
        act(() => navigate("?workspace=queue"))
        expect(window.location.search).toBe("?workspace=queue")
        expect(window.history.length).toBe(before + 1)
        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
        expect(result.current.kind).toBe("workspace")
        act(() => navigate("?category=systems", { replace: true }))
        expect(result.current).toEqual({ kind: "home", category: "systems" })
    })

    it("keeps workspace state in the URL without default noise", () => {
        window.history.replaceState(null, "", "/?workspace=waveforms")
        const { result } = renderHook(() => useWorkspaceParam("backend", "html5"))
        expect(result.current[0]).toBe("html5")
        act(() => result.current[1]("webaudio"))
        expect(window.location.search).toBe("?workspace=waveforms&backend=webaudio")
        expect(result.current[0]).toBe("webaudio")
        act(() => result.current[1]("html5"))
        expect(window.location.search).toBe("?workspace=waveforms")
    })
})
