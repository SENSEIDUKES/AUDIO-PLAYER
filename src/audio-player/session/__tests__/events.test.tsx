/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"
import type { SessionEngine } from "../../types"

describe("AudioSessionContext - Events", () => {
    it("should allow subscribing to events via the session context", async () => {
        let sessionRef: SessionEngine | null = null

        function TestComponent() {
            const session = useAudioSession()
            sessionRef = session
            return null
        }

        const container = document.createElement("div")
        const root = createRoot(container)

        await React.act(async () => {
            root.render(
                <AudioSessionProvider>
                    <TestComponent />
                </AudioSessionProvider>
            )
        })

        expect(sessionRef).toBeDefined()
        const session = sessionRef as unknown as SessionEngine
        expect(typeof session.subscribe).toBe("function")

        const handler = vi.fn()
        const unsubscribe = session.subscribe("track-change", handler)

        expect(typeof unsubscribe).toBe("function")

        // Ensure unsubscribe can be called without error
        unsubscribe()

        root.unmount()
    })
})
