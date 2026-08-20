/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest"
import React from "react"
import { createRoot } from "react-dom/client"
import { AudioSessionProvider, useAudioSession } from "../AudioSessionContext"
import type { SessionEngine } from "../../types"

describe("AudioSessionContext - Preload Strategy", () => {
    it("should initialize with preloadConfig correctly", async () => {
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
                <AudioSessionProvider preloadConfig={{ strategy: "aggressive", maxConcurrent: 3 }}>
                    <TestComponent />
                </AudioSessionProvider>
            )
        })

        expect(sessionRef).toBeDefined()

        root.unmount()
    })
})
