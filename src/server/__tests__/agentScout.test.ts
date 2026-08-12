import { describe, expect, it, vi } from "vitest"
import { createAgentScoutHandler } from "../agentScout"

const allowRequest = async () => ({ allowed: true })

function validBody() {
    return {
        variant: "studio-scout",
        track: {
            title: "Measured Track",
            artist: "Test Artist",
            lyrics: "Untrusted lyric text",
        },
        queue: [],
        audio: {
            durationMs: 180_000,
            sampleRateHz: 44_100,
            channelCount: 2,
            peakDbfs: -0.8,
            rmsDbfs: -13.2,
            crestFactorDb: 12.4,
            rmsRangeDb: 7.1,
            clippingSampleRatio: 0,
            silenceRatio: 0.03,
            stereoCorrelation: 0.42,
            waveformRmsDbfs: Array.from({ length: 32 }, (_, index) => -24 + index / 2),
            energy: 0.63,
            bpm: 122,
            beatCount: 366,
            rhythmConfidence: 0.87,
            trimStartMs: 250,
            trimEndMs: 900,
        },
        messages: [{ role: "user", content: "Review the measurements." }],
    }
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request("https://player.example/api/agent-scout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: "https://player.example",
            "x-real-ip": "192.0.2.10",
            ...headers,
        },
        body: JSON.stringify(body),
    })
}

describe("Agent Scout server handler", () => {
    it("keeps the API key and model server-side and forwards measured evidence", async () => {
        const upstream = vi.fn<typeof fetch>(async () =>
            Response.json({ choices: [{ message: { content: "Measured review" } }] })
        )
        const handler = createAgentScoutHandler({
            env: {
                OPENROUTER_API_KEY: "server-secret",
                OPENROUTER_PRESET_STUDIO_SCOUT: "server/studio-preset",
            },
            fetch: upstream,
            rateLimit: allowRequest,
        })

        const response = await handler.fetch(request({ ...validBody(), model: "attacker/model" }))

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ content: "Measured review" })
        expect(upstream).toHaveBeenCalledTimes(1)
        const [url, init] = upstream.mock.calls[0]
        expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer server-secret")
        const forwarded = JSON.parse(String(init?.body))
        expect(forwarded.model).toBe("server/studio-preset")
        expect(forwarded.messages[0].content).toContain('"samplePeakDbfs": -0.8')
        expect(forwarded.messages[0].content).toContain(
            "You are NOT given the audio file and cannot listen to it."
        )
        expect(forwarded.messages[0].content).not.toContain("attacker/model")
    })

    it("rejects text-only requests before contacting OpenRouter", async () => {
        const upstream = vi.fn()
        const handler = createAgentScoutHandler({
            env: { OPENROUTER_API_KEY: "server-secret" },
            fetch: upstream,
            rateLimit: allowRequest,
        })
        const body = validBody()
        Reflect.deleteProperty(body, "audio")

        const response = await handler.fetch(request(body))

        expect(response.status).toBe(400)
        expect(upstream).not.toHaveBeenCalled()
    })

    it("rejects cross-origin browser requests", async () => {
        const upstream = vi.fn()
        const handler = createAgentScoutHandler({
            env: { OPENROUTER_API_KEY: "server-secret" },
            fetch: upstream,
            rateLimit: allowRequest,
        })

        const response = await handler.fetch(
            request(validBody(), { Origin: "https://attacker.example" })
        )

        expect(response.status).toBe(403)
        expect(upstream).not.toHaveBeenCalled()
    })

    it("rate limits repeated requests from one client", async () => {
        const upstream = vi.fn(async () =>
            Response.json({ choices: [{ message: { content: "Measured review" } }] })
        )
        let requestCount = 0
        const rateLimit = vi.fn(async () => ({
            allowed: ++requestCount <= 6,
            retryAfterSeconds: 60,
        }))
        const handler = createAgentScoutHandler({
            env: { OPENROUTER_API_KEY: "server-secret" },
            fetch: upstream,
            rateLimit,
        })

        for (let index = 0; index < 6; index++) {
            expect((await handler.fetch(request(validBody()))).status).toBe(200)
        }
        const limited = await handler.fetch(request(validBody()))

        expect(limited.status).toBe(429)
        expect(limited.headers.get("Retry-After")).toBe("60")
        expect(upstream).toHaveBeenCalledTimes(6)
        expect(rateLimit).toHaveBeenCalledTimes(7)
    })

    it("fails closed when the shared rate limiter is unavailable", async () => {
        const upstream = vi.fn()
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
        const handler = createAgentScoutHandler({
            env: { OPENROUTER_API_KEY: "server-secret" },
            fetch: upstream,
            rateLimit: async () => {
                throw new Error("shared limiter unavailable")
            },
        })

        const response = await handler.fetch(request(validBody()))

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            error: "Agent Scout is temporarily unavailable.",
        })
        expect(upstream).not.toHaveBeenCalled()
        expect(consoleError).toHaveBeenCalledWith("Agent Scout rate limiter unavailable")
        consoleError.mockRestore()
    })

    it("does not log an upstream response body", async () => {
        const upstream = vi.fn<typeof fetch>(
            async () => new Response("sensitive provider diagnostic", { status: 400 })
        )
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
        const handler = createAgentScoutHandler({
            env: { OPENROUTER_API_KEY: "server-secret" },
            fetch: upstream,
            rateLimit: allowRequest,
        })

        const response = await handler.fetch(request(validBody()))

        expect(response.status).toBe(502)
        expect(consoleError).toHaveBeenCalledWith("Agent Scout OpenRouter request failed", 400)
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            "sensitive provider diagnostic"
        )
        consoleError.mockRestore()
    })
})
