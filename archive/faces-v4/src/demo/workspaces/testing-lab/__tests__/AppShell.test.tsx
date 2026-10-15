/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppHeaderBar, AppShell, BottomNavigation } from "../AppShell"

afterEach(() => {
    cleanup()
})

describe("AppShell (ported from the UI repo's SEIAppShell)", () => {
    it("renders header, sidebar, main, and footer landmarks", () => {
        render(
            <AppShell
                data-testid="shell"
                header={<span>Top bar</span>}
                sidebar={<span>Side rail</span>}
                footer={<span>Bottom bar</span>}
                mainId="content"
                mainAriaLabel="Content"
            >
                Page body
            </AppShell>
        )
        expect(screen.getByRole("banner")).toHaveTextContent("Top bar")
        expect(screen.getByRole("complementary", { name: "Primary" })).toHaveTextContent(
            "Side rail"
        )
        const main = screen.getByRole("main", { name: "Content" })
        expect(main).toHaveTextContent("Page body")
        expect(main).toHaveAttribute("id", "content")
        expect(main).toHaveAttribute("tabindex", "-1")
        expect(screen.getByRole("contentinfo")).toHaveTextContent("Bottom bar")

        const shell = screen.getByTestId("shell")
        expect(shell).toHaveClass(
            "sh-app-shell",
            "sh-app-shell--rows-hmf",
            "sh-app-shell--sidebar-md"
        )
        expect(shell.style.getPropertyValue("--sh-shell-sidebar")).toBe("16rem")
    })

    it("drops empty slots from the grid, like hasRenderableContent upstream", () => {
        render(
            <AppShell data-testid="shell" header={false} sidebar={null} footer="">
                Only content
            </AppShell>
        )
        expect(screen.queryByRole("banner")).toBeNull()
        expect(screen.queryByRole("complementary")).toBeNull()
        expect(screen.queryByRole("contentinfo")).toBeNull()
        const shell = screen.getByTestId("shell")
        expect(shell).toHaveClass("sh-app-shell--rows-m")
        expect(shell.className).not.toContain("--sidebar-")
        expect(screen.getByRole("main")).not.toHaveAttribute("tabindex")
    })

    it("moves the sidebar breakpoint and width when asked", () => {
        render(
            <AppShell
                data-testid="shell"
                sidebar={<nav aria-label="Library">Links</nav>}
                sidebarBreakpoint="xl"
                sidebarWidth="20rem"
                sidebarLabel="Library rail"
            />
        )
        const shell = screen.getByTestId("shell")
        expect(shell).toHaveClass("sh-app-shell--sidebar-xl", "sh-app-shell--rows-m")
        expect(shell.style.getPropertyValue("--sh-shell-sidebar")).toBe("20rem")
        expect(screen.getByRole("complementary", { name: "Library rail" })).toBeInTheDocument()
    })

    it("keeps the header bar free of headings so the page owns its h1", () => {
        render(
            <AppHeaderBar
                appName="SEA Portal"
                branding="SEA"
                contextLabel="Release · No Luck"
                actions={<button type="button">Search</button>}
                profile={<span>SE</span>}
            />
        )
        expect(screen.queryByRole("heading")).toBeNull()
        expect(screen.getByText("SEA Portal")).toBeInTheDocument()
        expect(screen.getByText("Release · No Luck")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument()
    })

    it("marks the active bottom-navigation destination and reports taps", () => {
        const onSelect = vi.fn()
        render(
            <BottomNavigation
                label="App navigation"
                onSelect={onSelect}
                items={[
                    { id: "home", label: "Home", icon: "⌂", active: true },
                    { id: "vault", label: "Vault", icon: "▣" },
                ]}
            />
        )
        const nav = screen.getByRole("navigation", { name: "App navigation" })
        expect(nav).toHaveClass("sh-bottom-nav--hide-md")
        expect(within(nav).getByRole("button", { name: "Home" })).toHaveAttribute(
            "aria-current",
            "page"
        )
        const vault = within(nav).getByRole("button", { name: "Vault" })
        expect(vault).not.toHaveAttribute("aria-current")
        fireEvent.click(vault)
        expect(onSelect).toHaveBeenCalledWith("vault")
    })
})
