/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import AgentScoutWorkspace from "../AgentScoutWorkspace"
import { useAudioSession } from "../../../session/AudioSessionContext"
import { ensureProTrackAnalysis } from "../../../automix/trackAnalysis"

vi.mock("../../../session/AudioSessionContext", () => ({
    useAudioSession: vi.fn(),
}))

vi.mock("../../../automix/trackAnalysis", () => ({
    ensureProTrackAnalysis: vi.fn(),
}))

// Mock sessionStorage
const mockSessionStorage = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value
        },
        removeItem: (key: string) => {
            delete store[key]
        },
        clear: () => {
            store = {}
        },
    }
})()

Object.defineProperty(window, "sessionStorage", { value: mockSessionStorage })

function mockAudioSession(value: Partial<ReturnType<typeof useAudioSession>>) {
    vi.mocked(useAudioSession).mockReturnValue(value as ReturnType<typeof useAudioSession>)
}

function completedAnalysis() {
    return {
        durationMs: 120_000,
        sampleRateHz: 44_100,
        channelCount: 2,
        peakDbfs: -1,
        rmsDbfs: -14,
        crestFactorDb: 13,
        rmsRangeDb: 8,
        clippingSampleRatio: 0,
        silenceRatio: 0.02,
        stereoCorrelation: 0.5,
        waveformRmsDbfs: Array(32).fill(-18),
        energy: 0.6,
        bpm: 120,
        beats: [500, 1_000],
        confidence: 0.9,
        trimStartMs: 200,
        trimEndMs: 500,
    }
}

describe("AgentScoutWorkspace Security", () => {
    beforeAll(() => {
        window.HTMLElement.prototype.scrollIntoView = vi.fn()
    })

    beforeEach(() => {
        mockSessionStorage.clear()
        vi.mocked(ensureProTrackAnalysis).mockReset()
    })

    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it("should escape HTML tags and not render them as elements", () => {
        const maliciousContent = "Hello <img src=x onerror=alert(1)> **bold**"

        mockAudioSession({
            currentTrack: { id: "1", title: "Test Track", artist: "Test Artist" },
            queue: [],
        })

        const storageKey = "sap-agent-chat:demo-scout:1"
        sessionStorage.setItem(
            storageKey,
            JSON.stringify([{ role: "assistant", content: maliciousContent }])
        )

        render(<AgentScoutWorkspace variant="demo-scout" />)

        const p = screen.getByText(/Hello <img/)
        expect(p).toBeDefined()

        // React handles escaping automatically. InnerHTML will show the escaped entities.
        expect(p.innerHTML).toContain("Hello &lt;img src=x onerror=alert(1)&gt;")
        expect(p.innerHTML).toContain("<strong>bold</strong>")
    })

    it("should handle nested bold correctly and safely", () => {
        const content = "Normal **bold **still bold**** normal"

        mockAudioSession({
            currentTrack: { id: "1", title: "Test Track", artist: "Test Artist" },
            queue: [],
        })

        const storageKey = "sap-agent-chat:demo-scout:1"
        sessionStorage.setItem(
            storageKey,
            JSON.stringify([{ role: "assistant", content: content }])
        )

        render(<AgentScoutWorkspace variant="demo-scout" />)

        const p = screen.getByText(/Normal/)
        expect(p.innerHTML).toContain(
            "Normal <strong>bold </strong>still bold<strong></strong> normal"
        )
    })

    it("measures the resolved audio source and sends evidence only to the same-origin API", async () => {
        mockAudioSession({
            currentTrack: {
                id: "1",
                title: "Test Track",
                artist: "Test Artist",
                audioFile: "https://cdn.example/original.mp3",
                lyrics: "Test lyrics",
            },
            currentSrc: "https://cdn.example/resolved.mp3",
            queue: [],
        })
        vi.mocked(ensureProTrackAnalysis).mockResolvedValue(completedAnalysis())
        const fetchMock = vi.fn<typeof fetch>(async () =>
            Response.json({ content: "Evidence-based review" })
        )
        vi.stubGlobal("fetch", fetchMock)

        render(<AgentScoutWorkspace variant="demo-scout" />)
        fireEvent.click(screen.getByRole("button", { name: "Analyze Demo Audio" }))

        await screen.findByText("Evidence-based review")
        expect(ensureProTrackAnalysis).toHaveBeenCalledWith({
            title: "Test Track",
            artist: "Test Artist",
            audioFile: "https://cdn.example/resolved.mp3",
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe("/api/agent-scout")
        expect(new Headers(init?.headers).has("Authorization")).toBe(false)
        const body = JSON.parse(String(init?.body))
        expect(body.audio).toMatchObject({
            peakDbfs: -1,
            rmsDbfs: -14,
            bpm: 120,
            beatCount: 2,
        })
        expect(String(init?.body)).not.toContain("https://cdn.example/resolved.mp3")
        expect(String(init?.body)).not.toContain("https://cdn.example/original.mp3")
    })

    it("shows the stable empty-response error for malformed success bodies", async () => {
        mockAudioSession({
            currentTrack: {
                id: "1",
                title: "Malformed Response Track",
                artist: "Test Artist",
                audioFile: "https://cdn.example/track.mp3",
            },
            currentSrc: "https://cdn.example/track.mp3",
            queue: [],
        })
        vi.mocked(ensureProTrackAnalysis).mockResolvedValue(completedAnalysis())
        vi.stubGlobal(
            "fetch",
            vi.fn<typeof fetch>(
                async () =>
                    new Response("<html>not json</html>", {
                        status: 200,
                        headers: { "Content-Type": "text/html" },
                    })
            )
        )
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

        render(<AgentScoutWorkspace variant="demo-scout" />)
        fireEvent.click(screen.getByRole("button", { name: "Analyze Demo Audio" }))

        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toBe(
                "Agent Scout returned an empty response."
            )
        )
        expect(screen.getByRole("alert").textContent).not.toMatch(/unexpected token/i)
        consoleError.mockRestore()
    })

    it("stops instead of requesting speculative text feedback when decoding fails", async () => {
        mockAudioSession({
            currentTrack: {
                id: "1",
                title: "Blocked Track",
                artist: "Test Artist",
                audioFile: "https://cdn.example/blocked.mp3",
            },
            currentSrc: "https://cdn.example/blocked.mp3",
            queue: [],
        })
        vi.mocked(ensureProTrackAnalysis).mockResolvedValue(null)
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        render(<AgentScoutWorkspace variant="demo-scout" />)
        fireEvent.click(screen.getByRole("button", { name: "Analyze Demo Audio" }))

        await waitFor(() =>
            expect(screen.getByRole("alert").textContent).toMatch(/couldn't decode/i)
        )
        expect(fetchMock).not.toHaveBeenCalled()
        expect(
            (screen.getByRole("button", { name: "Analyze Demo Audio" }) as HTMLButtonElement)
                .disabled
        ).toBe(false)
    })
})
