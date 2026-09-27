/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installBrowserStubs } from "../../../workshop/__tests__/browserStubs"
import { FRAME_SOURCE, PARENT_SOURCE } from "../bridge"
import type { FrameMessageBody, FrameStatus } from "../bridge"
import { TestingLabWorkspace } from "../TestingLabWorkspace"

/* The lab side of the Mix & Match Lab: previews as real <iframe> viewports,
   settings in the URL, and the message bridge to the preview pages. */

const STATUS: FrameStatus = {
    width: 375,
    height: 667,
    overflowPx: 0,
    overflowTarget: null,
    engines: 1,
    playing: 0,
    errors: 0,
}

function openLab(query = "") {
    window.history.replaceState(null, "", `/?workspace=testing-lab${query}`)
    return render(<TestingLabWorkspace />)
}

function previews(): HTMLIFrameElement[] {
    return Array.from(document.querySelectorAll("iframe"))
}

function previewParams(frame: HTMLIFrameElement): URLSearchParams {
    return new URLSearchParams((frame.getAttribute("src") ?? "").replace(/^\?/, ""))
}

function fromPreview(
    frame: HTMLIFrameElement,
    fid: string,
    body: FrameMessageBody,
    source: MessageEventSource | null = frame.contentWindow
) {
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { source: FRAME_SOURCE, fid, ...body },
                origin: window.location.origin,
                source,
            })
        )
    })
}

function spyOnPreview(frame: HTMLIFrameElement) {
    const view = frame.contentWindow
    if (!view) throw new Error("preview has no window")
    return vi.spyOn(view, "postMessage").mockImplementation(() => {})
}

beforeEach(() => {
    installBrowserStubs()
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.history.replaceState(null, "", "/")
})

describe("Mix & Match Lab", () => {
    it("shows the scenario in one real-viewport preview", () => {
        openLab("&scenario=mobile")
        const [frame] = previews()
        expect(previews()).toHaveLength(1)
        expect(frame).toHaveAttribute("title", "Testing Lab preview 375 × 667")
        const params = previewParams(frame)
        expect(params.get("frame")).toBe("lab")
        expect(params.get("fid")).toBe("main")
        expect(params.get("scenario")).toBe("mobile")
        expect(params.has("viewport")).toBe(false)
        expect(screen.getByRole("heading", { name: "Mobile checklist" })).toBeInTheDocument()
    })

    it("renders the phone matrix as four previews", () => {
        openLab()
        fireEvent.click(screen.getByRole("button", { name: "Matrix" }))
        expect(window.location.search).toBe("?workspace=testing-lab&viewport=matrix")
        expect(previews().map((frame) => previewParams(frame).get("fid"))).toEqual([
            "w320",
            "w375",
            "w390",
            "w430",
        ])
    })

    it("combines features through the URL and hands them to the preview", () => {
        openLab()
        fireEvent.click(screen.getByRole("switch", { name: /^Shuffle/ }))
        fireEvent.click(screen.getByRole("switch", { name: /^Lyrics sync/ }))
        fireEvent.change(screen.getByLabelText("Where the players live"), {
            target: { value: "marketplace" },
        })
        const search = new URLSearchParams(window.location.search)
        expect(search.get("shuffle")).toBe("1")
        expect(search.get("plugins")).toBe("lyrics")
        expect(search.get("context")).toBe("marketplace")
        // The marketplace does not offer FullCardPlayer, so the main face falls back to its first.
        expect(search.get("main")).toBe("sea-grid")
        const params = previewParams(previews()[0])
        expect(params.get("shuffle")).toBe("1")
        expect(params.get("context")).toBe("marketplace")
    })

    it("resets to a scenario preset and hides controls the context cannot use", () => {
        openLab("&shuffle=1")
        fireEvent.click(screen.getByRole("button", { name: "Errors" }))
        expect(window.location.search).toBe("?workspace=testing-lab&scenario=errors")
        expect(screen.queryByRole("heading", { name: "Players" })).toBeNull()
        expect(
            screen.getByText(/The error board has no shared session to stress/)
        ).toBeInTheDocument()
    })

    it("fills the automatic checks from the preview's own measurements", () => {
        openLab("&scenario=mobile")
        const [frame] = previews()
        expect(screen.getByRole("cell", { name: "Loading…" })).toBeInTheDocument()

        fromPreview(
            frame,
            "main",
            { type: "status", status: { ...STATUS, overflowPx: 12 } },
            window
        )
        expect(screen.getByRole("cell", { name: "Loading…" })).toBeInTheDocument()

        fromPreview(frame, "main", {
            type: "status",
            status: { ...STATUS, overflowPx: 12, overflowTarget: "div.ap-row" },
        })
        fromPreview(frame, "main", {
            type: "session",
            session: {
                title: "No Luck",
                state: "paused",
                position: "0:00 / 3:12",
                queue: "1 of 5",
                backend: "html5",
            },
        })
        const row = screen.getByRole("row", { name: /375 × 667/ })
        expect(within(row).getByText("12px · div.ap-row")).toBeInTheDocument()
        expect(within(row).getByText("1 on page · 0 playing")).toBeInTheDocument()
        expect(
            within(row).getByText("paused · No Luck · 0:00 / 3:12 · 1 of 5 · html5")
        ).toBeInTheDocument()
        expect(screen.getByText("Overflow 12px")).toBeInTheDocument()
    })

    it("pauses the other previews when one starts playing", () => {
        openLab("&viewport=matrix")
        const frames = previews()
        const spies = frames.map(spyOnPreview)
        fromPreview(frames[1], "w375", { type: "playing" })
        expect(spies[1]).not.toHaveBeenCalled()
        for (const index of [0, 2, 3]) {
            expect(spies[index]).toHaveBeenCalledWith(
                { source: PARENT_SOURCE, type: "pause-all" },
                window.location.origin
            )
        }
        expect(screen.getByText("Preview w375 started; paused the other 3")).toBeInTheDocument()
    })

    it("runs stress routines in the preview and lists the result", () => {
        openLab("&scenario=stress")
        const [frame] = previews()
        const spy = spyOnPreview(frame)
        fireEvent.click(screen.getByRole("button", { name: "Seek ×30" }))
        expect(spy).toHaveBeenCalledWith(
            { source: PARENT_SOURCE, type: "stress", action: "seek-storm" },
            window.location.origin
        )

        fromPreview(frame, "main", {
            type: "stress-result",
            result: {
                action: "seek-storm",
                passed: true,
                checks: ["✓ Last seek wins (asked 30.0 s)"],
                durationMs: 1840,
            },
        })
        expect(screen.getByText(/Seek ×30 · consistent · 1\.8 s/)).toBeInTheDocument()
        expect(screen.getByText("✓ Last seek wins (asked 30.0 s)")).toBeInTheDocument()
        expect(screen.getByText("Seek ×30: consistent")).toBeInTheDocument()
    })

    it("opens the same preview on its own, for a real phone", () => {
        openLab("&scenario=playback&theme=green")
        const link = screen.getByRole("link", { name: /Open on its own/ })
        expect(link).toHaveAttribute("target", "_blank")
        const params = new URLSearchParams((link.getAttribute("href") ?? "").replace(/^\?/, ""))
        expect(params.get("frame")).toBe("lab")
        expect(params.get("scenario")).toBe("playback")
        expect(params.get("theme")).toBe("green")
    })
})
