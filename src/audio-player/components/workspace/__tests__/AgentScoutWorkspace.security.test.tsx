/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeAll } from "vitest"
import AgentScoutWorkspace from "../AgentScoutWorkspace"
import { useAudioSession } from "../../../session/AudioSessionContext"

vi.mock("../../../session/AudioSessionContext", () => ({
    useAudioSession: vi.fn(),
}))

// Mock sessionStorage
const mockSessionStorage = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} }
    }
})()

Object.defineProperty(window, "sessionStorage", { value: mockSessionStorage })

describe("AgentScoutWorkspace Security", () => {
    beforeAll(() => {
        window.HTMLElement.prototype.scrollIntoView = vi.fn()
    })

    it("should escape HTML tags and not render them as elements", () => {
        const maliciousContent = "Hello <img src=x onerror=alert(1)> **bold**"

        ;(useAudioSession as any).mockReturnValue({
            currentTrack: { id: "1", title: "Test Track", artist: "Test Artist" },
            queue: []
        })

        const storageKey = "sap-agent-chat:demo-scout:1"
        sessionStorage.setItem(storageKey, JSON.stringify([{ role: "assistant", content: maliciousContent }]))

        render(<AgentScoutWorkspace variant="demo-scout" />)

        const p = screen.getByText(/Hello <img/)
        expect(p).toBeDefined()

        // React handles escaping automatically. InnerHTML will show the escaped entities.
        expect(p.innerHTML).toContain("Hello &lt;img src=x onerror=alert(1)&gt;")
        expect(p.innerHTML).toContain("<strong>bold</strong>")
    })

    it("should handle nested bold correctly and safely", () => {
        const content = "Normal **bold **still bold**** normal"

        ;(useAudioSession as any).mockReturnValue({
            currentTrack: { id: "1", title: "Test Track", artist: "Test Artist" },
            queue: []
        })

        const storageKey = "sap-agent-chat:demo-scout:1"
        sessionStorage.setItem(storageKey, JSON.stringify([{ role: "assistant", content: content }]))

        render(<AgentScoutWorkspace variant="demo-scout" />)

        const p = screen.getByText(/Normal/)
        expect(p.innerHTML).toContain("Normal <strong>bold </strong>still bold<strong></strong> normal")
    })
})
