/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"

describe("AudioSessionContext - Events", () => {
    it("should allow subscribing to events via the session context", async () => {
        let sessionRef: any = null

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
        expect(typeof sessionRef.subscribe).toBe("function")

        const handler = vi.fn()
        const unsubscribe = sessionRef.subscribe("track-change", handler)

        expect(typeof unsubscribe).toBe("function")

        // Ensure unsubscribe can be called without error
        unsubscribe()

        root.unmount()
    })
})
