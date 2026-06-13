import { describe, expect, it } from "vitest"
import {
    AutomixPlugin,
    createAutomixPlugin,
    createAutomixProPlugin,
} from "../AutomixPlugin"

describe("AutomixPlugin factories", () => {
    it("defaults to smart automatic behavior", () => {
        const plugin = createAutomixPlugin()

        expect(plugin).toBeInstanceOf(AutomixPlugin)
        expect(plugin.isSmartAnalysisEnabled()).toBe(true)
    })

    it("can disable smart analysis for basic-only fallback testing", () => {
        const plugin = createAutomixPlugin({ smartAnalysis: false })

        expect(plugin.isSmartAnalysisEnabled()).toBe(false)
        expect(plugin.getMode()).toBe("lite")
    })

    it("maps deprecated pro mode to smart automatic behavior", () => {
        const plugin = createAutomixPlugin({ mode: "pro" })

        expect(plugin.isSmartAnalysisEnabled()).toBe(true)
    })

    it("maps deprecated pro boolean compatibility to smart automatic behavior", () => {
        const plugin = createAutomixPlugin({ pro: true })

        expect(plugin.isSmartAnalysisEnabled()).toBe(true)
    })

    it("maps deprecated lite mode to the basic-only compatibility path", () => {
        const plugin = createAutomixPlugin({ mode: "lite" })

        expect(plugin.isSmartAnalysisEnabled()).toBe(false)
    })

    it("keeps createAutomixProPlugin as a smart automatic wrapper", () => {
        const plugin = createAutomixProPlugin()

        expect(plugin.isSmartAnalysisEnabled()).toBe(true)
    })
})
