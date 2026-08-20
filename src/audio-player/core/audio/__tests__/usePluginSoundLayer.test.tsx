/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePluginSoundLayer } from "../usePluginSoundLayer"

const mockLoad = vi.fn()
const mockPlay = vi.fn()
const mockStop = vi.fn()
const mockFade = vi.fn()
const mockStopAll = vi.fn()
const mockDispose = vi.fn()

vi.mock("../AudioSpriteEngine", () => {
    return {
        AudioSpriteEngine: class {
            load = mockLoad
            play = mockPlay
            stop = mockStop
            fade = mockFade
            stopAll = mockStopAll
            dispose = mockDispose
        },
    }
})

describe("usePluginSoundLayer", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockLoad.mockResolvedValue(undefined)
        mockPlay.mockReturnValue("sprite-1")
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
        expect(mockLoad).toHaveBeenCalledWith(manifest)

        const playId = layer.playSprite("click", { volume: 0.8 })
        expect(mockPlay).toHaveBeenCalledWith("click", { volume: 0.8 })
        expect(playId).toBe("sprite-1")

        layer.fadeSprite("sprite-1", 0.5, 200)
        expect(mockFade).toHaveBeenCalledWith("sprite-1", 0.5, 200)

        layer.stopSprite("sprite-1")
        expect(mockStop).toHaveBeenCalledWith("sprite-1")

        layer.stopAllSprites()
        expect(mockStopAll).toHaveBeenCalled()
    })

    it("disposes AudioSpriteEngine on unmount", () => {
        const { unmount } = renderHook(() => usePluginSoundLayer())

        expect(mockDispose).not.toHaveBeenCalled()

        unmount()

        expect(mockDispose).toHaveBeenCalledTimes(1)
    })
})
