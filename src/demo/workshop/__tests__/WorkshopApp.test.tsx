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
    it("is the entry point, with the five categories as tabs", () => {
        openAt("")
        const tabs = within(screen.getByRole("tablist", { name: "Workshop categories" }))
            .getAllByRole("tab")
            .map((tab) => tab.firstChild?.textContent)
        expect(tabs).toEqual(["Players", "Systems", "Customization", "Testing Lab", "SEN"])
        expect(screen.getByRole("heading", { level: 1, name: "Players" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Players")
    })

    it("switches category through the URL", () => {
        openAt("")
        fireEvent.click(screen.getByRole("tab", { name: /Systems/ }))
        expect(window.location.search).toBe("?category=systems")
        expect(screen.getByRole("heading", { level: 1, name: "Systems" })).toBeInTheDocument()
        expect(cardFor("Automix")).toHaveAttribute("href", "?workspace=automix")
    })

    it("moves between tabs with the arrow keys", () => {
        openAt("?category=customization")
        fireEvent.keyDown(screen.getByRole("tab", { selected: true }), { key: "ArrowRight" })
        expect(window.location.search).toBe("?category=testing-lab")
        expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Testing Lab")
    })

    it("opens the SEN tab and its Reader Mixer card", () => {
        openAt("?category=testing-lab")
        fireEvent.keyDown(screen.getByRole("tab", { selected: true }), { key: "ArrowRight" })
        expect(window.location.search).toBe("?category=sen")
        expect(screen.getByRole("heading", { level: 1, name: "SEN" })).toBeInTheDocument()
        expect(cardFor("Reader Mixer")).toHaveAttribute("href", "?workspace=reader-mixer")
    })

    it("shows roadmap pieces honestly, as records that open nothing", () => {
        openAt("?category=players")
        const roadmap = cardFor("QueueRowPlayer")
        expect(roadmap.tagName).toBe("ARTICLE")
        expect(roadmap).toHaveAccessibleName("QueueRowPlayer (not built)")
        expect(within(roadmap).getByText("Nothing to open yet")).toBeInTheDocument()
        expect(cardFor("FullCardPlayer").tagName).toBe("A")
    })

    it("sends scenario cards to a Mix & Match Lab preset", () => {
        openAt("?category=testing-lab")
        expect(cardFor("Mobile checks")).toHaveAttribute(
            "href",
            "?workspace=testing-lab&scenario=mobile"
        )
        expect(cardFor("Showcase fixture")).toHaveAttribute("href", "?workspace=showcase-fixture")
    })
})

describe("Workspaces", () => {
    it("opens a card as its own workspace and comes back to the same category", async () => {
        openAt("?category=systems")
        fireEvent.click(cardFor("Queue"))
        expect(window.location.search).toBe("?workspace=queue")
        await workspaceLoaded("Queue")
        expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
            "Systems/Queue"
        )

        fireEvent.click(screen.getByRole("link", { name: "Workshop" }))
        expect(window.location.search).toBe("?category=systems")
        expect(screen.getByRole("heading", { level: 1, name: "Systems" })).toBeInTheDocument()
    })

    it("opens directly from a link, with its working list and placeholders", async () => {
        openAt("?workspace=vault-row")
        await workspaceLoaded("VaultRowPlayer")
        expect(screen.getByRole("heading", { name: "Working here" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Placeholders & limits" })).toBeInTheDocument()
        expect(document.title).toBe("VaultRowPlayer · Audio Player Workshop")
    })

    it("stops its audio when you leave", async () => {
        openAt("?workspace=full-card")
        await workspaceLoaded("FullCardPlayer")
        await vi.waitFor(() => expect(document.querySelectorAll("audio").length).toBeGreaterThan(0))

        fireEvent.click(screen.getByRole("link", { name: "Workshop" }))
        expect(screen.getByRole("heading", { level: 1, name: "Players" })).toBeInTheDocument()
        expect(document.querySelectorAll("audio")).toHaveLength(0)
    })

    it("follows the browser's back button", async () => {
        openAt("?category=customization")
        fireEvent.click(cardFor("Themes"))
        await workspaceLoaded("Themes")
        act(() => {
            window.history.replaceState(null, "", "/?category=customization")
            window.dispatchEvent(new PopStateEvent("popstate"))
        })
        expect(screen.getByRole("heading", { level: 1, name: "Customization" })).toBeInTheDocument()
    })

    it("explains an unknown workspace link and offers a way back", () => {
        openAt("?workspace=not-a-piece")
        expect(
            screen.getByRole("heading", { name: "No workspace called “not-a-piece”" })
        ).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Back to the Workshop" })).toHaveAttribute(
            "href",
            "?category=players"
        )
    })

    it("never opens a roadmap record from a typed link", () => {
        openAt("?workspace=canvas-mode")
        expect(screen.getByRole("heading", { name: /No workspace called/ })).toBeInTheDocument()
    })

    it("redirects a scenario card's own id to its Lab preset", async () => {
        openAt("?workspace=lab-errors")
        await workspaceLoaded("Mix & Match Lab")
        expect(window.location.search).toBe("?workspace=testing-lab&scenario=errors")
    })
})
