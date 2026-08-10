/** @vitest-environment jsdom */
import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TextMarquee } from "../TextMarquee"

describe("TextMarquee layout measurements", () => {
    let containerWidth: number
    let contentWidth: number
    let resizeCallback: ResizeObserverCallback
    let nextAnimationFrameId: number
    let animationFrames: Map<number, FrameRequestCallback>

    const flushAnimationFrames = () => {
        const pending = Array.from(animationFrames.values())
        animationFrames.clear()
        pending.forEach((callback) => callback(0))
    }

    const notifyResize = () => {
        act(() => {
            resizeCallback([], {} as ResizeObserver)
            flushAnimationFrames()
        })
    }

    beforeEach(() => {
        containerWidth = 300
        contentWidth = 400
        nextAnimationFrameId = 0
        animationFrames = new Map()

        vi.stubGlobal(
            "ResizeObserver",
            class ResizeObserverMock {
                constructor(callback: ResizeObserverCallback) {
                    resizeCallback = callback
                }
                observe() {}
                disconnect() {}
                unobserve() {}
            }
        )
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn((callback: FrameRequestCallback) => {
                const id = ++nextAnimationFrameId
                animationFrames.set(id, callback)
                return id
            })
        )
        vi.stubGlobal(
            "cancelAnimationFrame",
            vi.fn((id: number) => animationFrames.delete(id))
        )
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
            function (this: HTMLElement) {
                return this.classList.contains("ap-marquee") ? containerWidth : 0
            }
        )
        vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
            function (this: HTMLElement) {
                return this.classList.contains("ap-marquee__inner")
                    ? contentWidth
                    : 0
            }
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("ignores one-pixel overflow jitter and commits accumulated changes", () => {
        const view = render(<TextMarquee>Long track title</TextMarquee>)
        act(flushAnimationFrames)

        const marquee = view.container.querySelector<HTMLElement>(".ap-marquee")!
        expect(marquee.dataset.scroll).toBe("true")
        expect(marquee.style.getPropertyValue("--ap-marquee-distance")).toBe(
            "108px"
        )

        contentWidth = 401
        notifyResize()
        expect(marquee.style.getPropertyValue("--ap-marquee-distance")).toBe(
            "108px"
        )

        contentWidth = 402
        notifyResize()
        expect(marquee.style.getPropertyValue("--ap-marquee-distance")).toBe(
            "110px"
        )
    })

    it("re-evaluates the min-width gate when overflow stays unchanged", () => {
        containerWidth = 199
        contentWidth = 299
        const view = render(<TextMarquee>Long track title</TextMarquee>)
        act(flushAnimationFrames)

        const marquee = view.container.querySelector<HTMLElement>(".ap-marquee")!
        expect(marquee.dataset.scroll).toBe("false")

        containerWidth = 201
        contentWidth = 301
        notifyResize()
        expect(marquee.dataset.scroll).toBe("true")
        expect(marquee.style.getPropertyValue("--ap-marquee-distance")).toBe(
            "108px"
        )
    })
})
