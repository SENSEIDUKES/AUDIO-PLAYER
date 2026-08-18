/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AudioSpriteEngine } from "../AudioSpriteEngine"
import { usePluginSoundLayer } from "../usePluginSoundLayer"

describe("usePluginSoundLayer", () => {
    beforeEach(() => {
        vi.spyOn(AudioSpriteEngine.prototype, "load").mockImplementation(async () => {})
        vi.spyOn(AudioSpriteEngine.prototype, "play").mockReturnValue("sprite-1")
        vi.spyOn(AudioSpriteEngine.prototype, "stop").mockImplementation(() => {})
        vi.spyOn(AudioSpriteEngine.prototype, "fade").mockImplementation(() => {})
        vi.spyOn(AudioSpriteEngine.prototype, "stopAll").mockImplementation(() => {})
        vi.spyOn(AudioSpriteEngine.prototype, "dispose").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns a stable PluginSoundLayer interface across re-renders", () => {
        const { result, rerender } = renderHook(() => usePluginSoundLayer())

        const firstLayer = result.current
        expect(firstLayer).toBeDefined()

        rerender()
        const secondLayer = result.current

        expect(secondLayer).toBe(firstLayer)
    })

    it("delegates facade calls to the underlying AudioSpriteEngine instance", async () => {
        const { result } = renderHook(() => usePluginSoundLayer())
        const layer = result.current

        const manifest = { src: "test.mp3", clips: { click: { offset: 0, duration: 1 } } }
        await layer.loadSpritePack(manifest)
        expect(AudioSpriteEngine.prototype.load).toHaveBeenCalledWith(manifest)

        const playId = layer.playSprite("click", { volume: 0.8 })
        expect(AudioSpriteEngine.prototype.play).toHaveBeenCalledWith("click", { volume: 0.8 })
        expect(playId).toBe("sprite-1")

        layer.fadeSprite("sprite-1", 0.5, 200)
        expect(AudioSpriteEngine.prototype.fade).toHaveBeenCalledWith("sprite-1", 0.5, 200)

        layer.stopSprite("sprite-1")
        expect(AudioSpriteEngine.prototype.stop).toHaveBeenCalledWith("sprite-1")

        layer.stopAllSprites()
        expect(AudioSpriteEngine.prototype.stopAll).toHaveBeenCalled()
    })

    it("disposes AudioSpriteEngine on unmount", () => {
        const { unmount } = renderHook(() => usePluginSoundLayer())

        expect(AudioSpriteEngine.prototype.dispose).not.toHaveBeenCalled()

        unmount()

        expect(AudioSpriteEngine.prototype.dispose).toHaveBeenCalledTimes(1)
    })
})
