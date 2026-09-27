/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installBrowserStubs } from "../../../workshop/__tests__/browserStubs"
import { PARENT_SOURCE, isFrameMessage, isParentMessage } from "../bridge"
import type { ParentMessage } from "../bridge"
import { LabContextView } from "../contexts"
import { LabFrameApp, findOverflow } from "../LabFrameApp"
import { CONTEXTS, SCENARIO_PRESETS, normalizeLabConfig } from "../labConfig"
import type { ContextId, LabConfig } from "../labConfig"

/* The preview pages the Mix & Match Lab loads in its <iframe>s. */

const configFor = (context: ContextId, patch: Partial<LabConfig> = {}): LabConfig =>
    normalizeLabConfig({ ...SCENARIO_PRESETS.free, context, ...patch })

function rect(right: number, width = 100): DOMRect {
    return {
        x: right - width,
        y: 0,
        left: right - width,
        top: 0,
        right,
        bottom: 20,
        width,
        height: 20,
        toJSON: () => ({}),
    }
}

beforeEach(() => {
    installBrowserStubs()
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.className = ""
    window.history.replaceState(null, "", "/")
})

describe("preview contexts", () => {
    it.each(Object.keys(CONTEXTS) as ContextId[])("%s renders its surface", (context) => {
        const { unmount } = render(<LabContextView config={configFor(context)} fid="test" />)
        if (context === "states") {
            expect(document.querySelectorAll(".lab-state-panel")).toHaveLength(5)
        } else {
            expect(document.querySelectorAll("audio").length).toBeGreaterThan(0)
        }
        unmount()
        expect(document.querySelectorAll("audio")).toHaveLength(0)
    })

    it("places the players in the app shell's landmarks", () => {
        render(<LabContextView config={configFor("shell")} fid="test" />)
        expect(document.querySelector('[data-slot="app-shell-header"]')).toHaveTextContent(
            "SEA Portal"
        )
        const sidebar = screen.getByRole("complementary", { name: "Primary" })
        expect(within(sidebar).getByText("Now playing")).toBeInTheDocument()
        expect(screen.getByRole("main")).toHaveAttribute("id", "lab-main")
        expect(
            screen.getByRole("heading", { level: 1, name: "No Luck — SENSEI" })
        ).toBeInTheDocument()
        expect(screen.getAllByRole("navigation", { name: "App navigation" })).toHaveLength(2)
    })

    it("leaves the sidebar player out when it is switched off", () => {
        render(<LabContextView config={configFor("shell", { sidebar: false })} fid="test" />)
        const sidebar = screen.getByRole("complementary", { name: "Primary" })
        expect(within(sidebar).queryByText("Now playing")).toBeNull()
    })

    it("lays out one panel per failure on the error board", () => {
        render(<LabContextView config={configFor("states")} fid="test" />)
        const panels = Array.from(document.querySelectorAll(".lab-state-panel"))
        expect(panels.map((panel) => panel.getAttribute("aria-label"))).toEqual([
            "Broken audio URL",
            "Empty audio source",
            "Playlist with mixed validity",
            "Fallback recovery",
            "Skip policy (shared session)",
        ])
    })
})

describe("overflow detection", () => {
    it("reports the first element that escapes the viewport", () => {
        document.body.innerHTML = `<div class="row wide"><span class="ok">fine</span></div>`
        vi.spyOn(document.querySelector(".ok") as Element, "getBoundingClientRect").mockReturnValue(
            rect(300)
        )
        vi.spyOn(
            document.querySelector(".wide") as Element,
            "getBoundingClientRect"
        ).mockReturnValue(rect(412, 412))
        expect(findOverflow(document, 375)).toEqual({ px: 37, target: "div.row" })
    })

    it("ignores content clipped by a scrolling container inside the viewport", () => {
        document.body.innerHTML = `<div class="scroller" style="overflow-x: auto"><div class="strip">cards</div></div>`
        vi.spyOn(
            document.querySelector(".scroller") as Element,
            "getBoundingClientRect"
        ).mockReturnValue(rect(375, 375))
        vi.spyOn(
            document.querySelector(".strip") as Element,
            "getBoundingClientRect"
        ).mockReturnValue(rect(900, 900))
        expect(findOverflow(document, 375)).toBeNull()
    })

    it("finds nothing when everything fits", () => {
        document.body.innerHTML = `<div class="a">a</div>`
        vi.spyOn(document.querySelector(".a") as Element, "getBoundingClientRect").mockReturnValue(
            rect(375, 375)
        )
        expect(findOverflow(document, 375)).toBeNull()
    })
})

describe("preview page", () => {
    const fromLab = (data: ParentMessage, origin = window.location.origin) =>
        act(() => {
            window.dispatchEvent(new MessageEvent("message", { data, origin, source: window }))
        })

    it("renders the context from its URL and marks itself as a preview", () => {
        window.history.replaceState(null, "", "/?frame=lab&fid=solo&scenario=errors")
        render(<LabFrameApp />)
        expect(document.title).toBe("Testing Lab preview")
        expect(document.body).toHaveClass("lab-frame-body")
        expect(screen.getByRole("region", { name: "Fallback recovery" })).toBeInTheDocument()
    })

    it("pauses its players when the lab says another preview started", () => {
        window.history.replaceState(null, "", "/?frame=lab&fid=w375&context=bare")
        render(<LabFrameApp />)
        const audios = Array.from(document.querySelectorAll("audio"))
        expect(audios.length).toBeGreaterThan(0)
        // Pretend every engine is playing.
        for (const audio of audios) {
            Object.defineProperty(audio, "paused", { configurable: true, get: () => false })
        }
        const pause = vi.mocked(HTMLMediaElement.prototype.pause)
        pause.mockClear()
        fromLab({ source: PARENT_SOURCE, type: "pause-all" }, "https://elsewhere.example")
        expect(pause).not.toHaveBeenCalled()
        fromLab({ source: PARENT_SOURCE, type: "pause-all" })
        expect(pause).toHaveBeenCalledTimes(audios.length)
    })

    it("hands stress requests to the preview's session", () => {
        window.history.replaceState(null, "", "/?frame=lab&fid=main&context=bare")
        render(<LabFrameApp />)
        const requested: string[] = []
        const onStress = (event: Event) => requested.push(String((event as CustomEvent).detail))
        window.addEventListener("sap-lab:stress", onStress)
        fromLab({ source: PARENT_SOURCE, type: "stress", action: "skip-storm" })
        window.removeEventListener("sap-lab:stress", onStress)
        expect(requested).toEqual(["skip-storm"])
    })
})

describe("lab bridge", () => {
    it("only accepts well-formed messages from its own side", () => {
        expect(isFrameMessage({ source: "sap-lab-frame", fid: "main", type: "playing" })).toBe(true)
        expect(isFrameMessage({ source: "sap-lab-frame", type: "playing" })).toBe(false)
        expect(isFrameMessage({ source: PARENT_SOURCE, fid: "main", type: "playing" })).toBe(false)
        expect(isParentMessage({ source: PARENT_SOURCE, type: "pause-all" })).toBe(true)
        expect(isParentMessage("pause-all")).toBe(false)
        expect(isParentMessage(null)).toBe(false)
    })
})
