import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }))

vi.mock("@vercel/firewall", () => ({ checkRateLimit }))

import handler from "../../api/agent-scout"

function request(): Request {
    return new Request("https://player.example/api/agent-scout", {
        method: "POST",
        headers: { Origin: "https://player.example" },
        body: "{}",
    })
}

beforeEach(() => {
    checkRateLimit.mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("Agent Scout Vercel rate-limit adapter", () => {
    it("fails closed when the configured Firewall rule is missing", async () => {
        checkRateLimit.mockResolvedValue({ rateLimited: false, error: "not-found" })
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
        const incoming = request()

        const response = await handler.fetch(incoming)

        expect(response.status).toBe(503)
        expect(checkRateLimit).toHaveBeenCalledWith("agent-scout", { request: incoming })
        consoleError.mockRestore()
    })

    it("returns 429 when Vercel Firewall blocks the request", async () => {
        checkRateLimit.mockResolvedValue({ rateLimited: true })

        const response = await handler.fetch(request())

        expect(response.status).toBe(429)
        expect(response.headers.get("Retry-After")).toBe("60")
    })
})
