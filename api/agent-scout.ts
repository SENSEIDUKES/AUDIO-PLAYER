import { checkRateLimit } from "@vercel/firewall"
import { createAgentScoutHandler } from "../src/server/agentScout"

const RATE_LIMIT_ID = "agent-scout"

export default createAgentScoutHandler({
    async rateLimit(request) {
        const result = await checkRateLimit(RATE_LIMIT_ID, { request })
        if (result.error === "not-found") {
            throw new Error(`Vercel Firewall rate limit '${RATE_LIMIT_ID}' is not configured`)
        }
        return {
            allowed: !result.rateLimited,
            retryAfterSeconds: 60,
        }
    },
})
