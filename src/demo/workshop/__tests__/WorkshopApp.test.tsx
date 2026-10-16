/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WorkshopApp } from "../WorkshopApp"
import { installBrowserStubs } from "./browserStubs"

function openAt(search: string) {
    window.history.replaceState(null, "", `/${search}`)
    return render(<WorkshopApp />)
}

/** Resolves once the lazy workspace has loaded and rendered. */
async function workspaceLoaded(title: string) {
    const heading = await screen.findByRole("heading", { level: 1, name: title })
    await vi.waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull(), {
        timeout: 10_000,
    })
    return heading
}

function cardFor(title: string): HTMLElement {
    const heading = screen.getByRole("heading", { level: 2, name: title })
    const card = heading.closest("a, article")
    if (!(card instanceof HTMLElement)) throw new Error(`No card for ${title}`)
    return card
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

describe("Workshop home", () => {
    it("is the entry point, with the three tabs", () => {
        openAt("")
        const tabs = within(screen.getByRole("tablist", { name: "Workshop categories" }))
            .getAllByRole("tab")
            .map((tab) => tab.firstChild?.textContent)
        expect(tabs).toEqual(["Player", "Novels (SEN)", "Engine"])
        expect(screen.getByRole("heading", { level: 1, name: "Player" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Player")
        expect(cardFor("New player")).toHaveAttribute("href", "?workspace=new-player")
    })

    it("switches tab through the URL", () => {
        openAt("")
        fireEvent.click(screen.getByRole("tab", { name: /Engine/ }))
        expect(window.location.search).toBe("?category=engine")
        expect(screen.getByRole("heading", { level: 1, name: "Engine" })).toBeInTheDocument()
        expect(cardFor("Automix")).toHaveAttribute("href", "?workspace=automix")
    })

    it("moves between tabs with the arrow keys", () => {
        openAt("?category=player")
        fireEvent.keyDown(screen.getByRole("tab", { selected: true }), { key: "ArrowRight" })
        expect(window.location.search).toBe("?category=novels")
        expect(screen.getByRole("heading", { level: 1, name: "Novels (SEN)" })).toBeInTheDocument()
        expect(cardFor("Reader mixer")).toHaveAttribute("href", "?workspace=reader-mixer")
    })
})

describe("Workspaces", () => {
    it("opens a card as its own workspace and comes back to the same tab", async () => {
        openAt("?category=engine")
        fireEvent.click(cardFor("Up next"))
        expect(window.location.search).toBe("?workspace=queue")
        await workspaceLoaded("Up next")
        expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
            "Engine/Up next"
        )

        fireEvent.click(screen.getByRole("link", { name: "Workshop" }))
        expect(window.location.search).toBe("?category=engine")
        expect(screen.getByRole("heading", { level: 1, name: "Engine" })).toBeInTheDocument()
    })

    it("opens directly from a link, with what works and what doesn't yet", async () => {
        openAt("?workspace=narrative-face")
        await workspaceLoaded("Narrator face")
        expect(screen.getByRole("heading", { name: "What you can do here" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Not working yet" })).toBeInTheDocument()
        expect(document.title).toBe("Narrator face · Audio Player Workshop")
    })

    it("stops its audio when you leave", async () => {
        openAt("?workspace=new-player")
        await workspaceLoaded("New player")
        await vi.waitFor(() => expect(document.querySelectorAll("audio").length).toBeGreaterThan(0))

        fireEvent.click(screen.getByRole("link", { name: "Workshop" }))
        expect(screen.getByRole("heading", { level: 1, name: "Player" })).toBeInTheDocument()
        expect(document.querySelectorAll("audio")).toHaveLength(0)
    })

    it("follows the browser's back button", async () => {
        openAt("?category=engine")
        fireEvent.click(cardFor("Playback"))
        await workspaceLoaded("Playback")
        act(() => {
            window.history.replaceState(null, "", "/?category=engine")
            window.dispatchEvent(new PopStateEvent("popstate"))
        })
        expect(screen.getByRole("heading", { level: 1, name: "Engine" })).toBeInTheDocument()
    })

    it("explains an unknown workspace link and offers a way back", () => {
        openAt("?workspace=not-a-piece")
        expect(
            screen.getByRole("heading", { name: "No workspace called “not-a-piece”" })
        ).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Back to the Workshop" })).toHaveAttribute(
            "href",
            "?category=player"
        )
    })

    it("treats a link to an archived v4 face as unknown", () => {
        openAt("?workspace=full-card")
        expect(screen.getByRole("heading", { name: /No workspace called/ })).toBeInTheDocument()
    })
})
