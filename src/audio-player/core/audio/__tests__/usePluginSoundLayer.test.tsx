/** @vitest-environment jsdom */
import { StrictMode } from "react"
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

    it("disposes a loaded AudioSpriteEngine on unmount", async () => {
        const { result, unmount } = renderHook(() => usePluginSoundLayer())
        await result.current.loadSpritePack({ src: "test.mp3", clips: {} })

        expect(mockDispose).not.toHaveBeenCalled()

        unmount()

        expect(mockDispose).toHaveBeenCalledTimes(1)
    })
})

it("survives Strict Mode replay and either scope/layer cleanup order", async () => {
    const { result, unmount } = renderHook(() => usePluginSoundLayer(), { wrapper: StrictMode })
    const first = result.current.createScope!()
    const second = result.current.createScope!()
    await first.loadSpritePack({ src: "first.mp3", clips: {} }, "first")
    await second.loadSpritePack({ src: "second.mp3", clips: {} }, "second")
    first.dispose()
    expect(second.playSprite("clip", { pack: "second" })).toBe("sprite-1")
    const facade = result.current
    unmount()
    expect(() => {
        second.stopSprite("sprite-1")
        second.dispose()
        facade.stopAllSprites()
    }).not.toThrow()
    expect(facade.playSprite("clip")).toBeNull()
    await expect(facade.loadSpritePack({ src: "late.mp3", clips: {} })).rejects.toMatchObject({
        name: "AbortError",
    })
})
