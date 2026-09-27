import { vi } from "vitest"

/* Browser APIs jsdom lacks (or only logs "not implemented" for) that the faces
   and workspaces touch while mounting. Media playback resolves without sound,
   observers never fire, canvases have no context, and the network is off so a
   test can never reach a real server. Call from `beforeEach`; `vi.restoreAllMocks`
   and `vi.unstubAllGlobals` in `afterEach` undo it. */

class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
        return []
    }
}

function matchMedia(query: string): MediaQueryList {
    const list: Partial<MediaQueryList> = {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }
    return list as MediaQueryList
}

export function installBrowserStubs(): void {
    vi.stubGlobal("ResizeObserver", NoopObserver)
    vi.stubGlobal("IntersectionObserver", NoopObserver)
    vi.stubGlobal("matchMedia", matchMedia)
    vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new TypeError("Network is disabled in tests")))
    )
    vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve())
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null)
}
