/** @vitest-environment jsdom */
import { act, render, waitFor } from "@testing-library/react"
import type { ComponentProps, CSSProperties } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WaveformProgress } from "../WaveformProgress"

const waveSurfer = vi.hoisted(() => {
    const instance = {
        destroy: vi.fn(),
        on: vi.fn(),
        setOptions: vi.fn(),
        setTime: vi.fn(),
    }
    return {
        create: vi.fn(() => instance),
        instance,
    }
})

vi.mock("wavesurfer.js", () => ({
    default: { create: waveSurfer.create },
}))

describe("WaveformProgress resolved color cache", () => {
    let colors: Record<string, string>
    let getComputedStyleMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        colors = {
            "--wave": "rgb(10, 20, 30)",
            "--progress": "rgb(40, 50, 60)",
            "--cursor": "rgb(70, 80, 90)",
        }
        getComputedStyleMock = vi.fn((element: HTMLElement) => ({
            getPropertyValue: (name: string) => {
                const themeRoot = element.closest<HTMLElement>('[data-testid="theme-root"]')
                const inlineValue = themeRoot?.style.getPropertyValue(name).trim()
                const reference = inlineValue?.match(/var\(\s*(--[^,)\s]+)/)?.[1]
                if (reference) {
                    return themeRoot?.style.getPropertyValue(reference).trim() ?? ""
                }
                return colors[name] ?? inlineValue ?? ""
            },
        }))
        vi.stubGlobal("getComputedStyle", getComputedStyleMock)
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 1)
        )
        vi.stubGlobal("cancelAnimationFrame", vi.fn())
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("caches across sources and invalidates for inherited theme changes", async () => {
        const props: ComponentProps<typeof WaveformProgress> = {
            currentTime: 2,
            duration: 10,
            buffered: 4,
            disabled: false,
            isSeeking: false,
            onSeek: vi.fn(),
            onSeekStart: vi.fn(),
            onSeekEnd: vi.fn(),
            peaks: [[0.2, 0.5, 0.8]],
            peaksDuration: 10,
            sourceKey: "cached-colors",
            waveColor: "var(--wave)",
            progressColor: "var(--progress)",
            cursorColor: "var(--cursor)",
        }

        const view = render(
            <div
                data-testid="theme-root"
                style={
                    {
                        "--wave": colors["--wave"],
                        "--progress": colors["--progress"],
                        "--cursor": colors["--cursor"],
                    } as CSSProperties
                }
            >
                <WaveformProgress {...props} />
            </div>
        )
        await waitFor(() => expect(waveSurfer.create).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(waveSurfer.instance.setOptions).toHaveBeenCalled())
        expect(getComputedStyleMock).toHaveBeenCalledTimes(3)

        view.rerender(
            <div
                data-testid="theme-root"
                style={
                    {
                        "--wave": colors["--wave"],
                        "--progress": colors["--progress"],
                        "--cursor": colors["--cursor"],
                    } as CSSProperties
                }
            >
                <WaveformProgress {...props} sourceKey="cached-colors-next-source" />
            </div>
        )
        await waitFor(() => expect(waveSurfer.create).toHaveBeenCalledTimes(2))
        expect(getComputedStyleMock).toHaveBeenCalledTimes(3)

        view.rerender(
            <div
                data-testid="theme-root"
                style={
                    {
                        "--wave": colors["--wave"],
                        "--progress": colors["--progress"],
                        "--cursor": colors["--cursor"],
                    } as CSSProperties
                }
            >
                <WaveformProgress {...props} sourceKey="cached-colors-next-source" isSeeking />
            </div>
        )
        await act(async () => {
            await Promise.resolve()
        })
        expect(getComputedStyleMock).toHaveBeenCalledTimes(3)

        const themeRoot = view.getByTestId("theme-root")
        const setOptionsCallCount = waveSurfer.instance.setOptions.mock.calls.length
        await act(async () => {
            themeRoot.style.setProperty("--ap-blur", "12px")
            await Promise.resolve()
        })
        expect(getComputedStyleMock).toHaveBeenCalledTimes(3)
        expect(waveSurfer.instance.setOptions).toHaveBeenCalledTimes(setOptionsCallCount)

        await act(async () => {
            themeRoot.classList.add("highlighted")
            themeRoot.style.setProperty("color", "red")
            await Promise.resolve()
        })
        expect(getComputedStyleMock).toHaveBeenCalledTimes(3)

        colors = {
            "--wave": "rgb(11, 21, 31)",
            "--progress": "rgb(41, 51, 61)",
            "--cursor": "rgb(71, 81, 91)",
        }
        await act(async () => {
            themeRoot.style.setProperty("--wave", colors["--wave"])
            themeRoot.style.setProperty("--progress", colors["--progress"])
            themeRoot.style.setProperty("--cursor", colors["--cursor"])
            await Promise.resolve()
        })

        await waitFor(() => expect(getComputedStyleMock).toHaveBeenCalledTimes(6))
        expect(waveSurfer.instance.setOptions).toHaveBeenLastCalledWith({
            height: 48,
            waveColor: "rgb(11, 21, 31)",
            progressColor: "rgb(41, 51, 61)",
            cursorColor: "rgb(71, 81, 91)",
        })

        colors = {
            "--wave": "rgb(12, 22, 32)",
            "--progress": "rgb(42, 52, 62)",
            "--cursor": "rgb(72, 82, 92)",
        }
        await act(async () => {
            themeRoot.classList.add("theme-dark")
            await Promise.resolve()
        })
        await waitFor(() => expect(getComputedStyleMock).toHaveBeenCalledTimes(9))

        await act(async () => {
            themeRoot.style.setProperty("--wave", "var(--brand-wave)")
            themeRoot.style.setProperty("--brand-wave", "rgb(13, 23, 33)")
            await Promise.resolve()
        })
        await waitFor(() => expect(getComputedStyleMock).toHaveBeenCalledTimes(12))

        // The direct --wave declaration is unchanged. Updating only its
        // indirect custom-property dependency must still invalidate colors.
        await act(async () => {
            themeRoot.style.setProperty("--brand-wave", "rgb(14, 24, 34)")
            await Promise.resolve()
        })
        await waitFor(() => expect(getComputedStyleMock).toHaveBeenCalledTimes(15))
        expect(waveSurfer.instance.setOptions).toHaveBeenLastCalledWith({
            height: 48,
            waveColor: "rgb(14, 24, 34)",
            progressColor: "rgb(42, 52, 62)",
            cursorColor: "rgb(72, 82, 92)",
        })
    })
})
