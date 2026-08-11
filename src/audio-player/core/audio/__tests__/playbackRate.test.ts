/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RefObject } from "react"
import {
    DEFAULT_PLAYBACK_RATE,
    MAX_PLAYBACK_RATE,
    MIN_PLAYBACK_RATE,
} from "../AudioBackend"
import { HTML5AudioBackend } from "../HTML5AudioBackend"
import { WebAudioBackend, WEBAUDIO_CAPABILITIES } from "../WebAudioBackend"
import { sharedAudioBufferCache } from "../audioCaches"

class FakeAudioNode {
    gain = { value: 1 }
    pan = { value: 0 }
    positionX = { value: 0 }
    positionY = { value: 0 }
    positionZ = { value: 0 }
    orientationX = { value: 0 }
    orientationY = { value: 0 }
    orientationZ = { value: 0 }
    panningModel = "HRTF"
    distanceModel = "inverse"
    refDistance = 1
    maxDistance = 10000
    rolloffFactor = 1
    coneInnerAngle = 360
    coneOuterAngle = 360
    coneOuterGain = 0
    connect = vi.fn()
    disconnect = vi.fn()
}

class FakeBufferSource extends FakeAudioNode {
    buffer: AudioBuffer | null = null
    loop = false
    playbackRate = { value: 1 }
    onended: (() => void) | null = null
    start = vi.fn()
    stop = vi.fn()
}

function installAudioContext() {
    const sources: FakeBufferSource[] = []
    const context = {
        state: "running" as AudioContextState,
        destination: {},
        currentTime: 0,
        createPanner: vi.fn(() => new FakeAudioNode()),
        createGain: vi.fn(() => new FakeAudioNode()),
        createStereoPanner: vi.fn(() => new FakeAudioNode()),
        createBufferSource: vi.fn(() => {
            const source = new FakeBufferSource()
            sources.push(source)
            return source
        }),
        resume: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
    }
    vi.stubGlobal(
        "AudioContext",
        vi.fn(function AudioContextMock() {
            return context
        })
    )
    return { context, sources }
}

function createWebAudioBackend(duration = 120) {
    const backend = new WebAudioBackend({
        requested: "webaudio",
        active: "webaudio",
        didFallback: false,
        capabilities: WEBAUDIO_CAPABILITIES,
    })
    backend.setSource("track-a.mp3")
    Object.assign(backend as unknown as Record<string, unknown>, {
        buffer: { duration } as AudioBuffer,
        state: "ready",
    })
    return backend
}

describe("playback rate backends", () => {
    beforeEach(() => {
        sharedAudioBufferCache.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        sharedAudioBufferCache.clear()
    })

    it("uses native HTML5 playbackRate and sanitizes the shared range", async () => {
        const audio = {
            defaultPlaybackRate: DEFAULT_PLAYBACK_RATE,
            playbackRate: DEFAULT_PLAYBACK_RATE,
            play: vi.fn(async () => undefined),
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn(function (this: HTMLAudioElement) {
                this.playbackRate = this.defaultPlaybackRate
            }),
        } as unknown as HTMLAudioElement
        const audioRef = { current: null } as RefObject<HTMLAudioElement | null>
        const backend = new HTML5AudioBackend(audioRef)

        backend.setRate(2)
        ;(audioRef as { current: HTMLAudioElement | null }).current = audio
        backend.load()
        await backend.play()

        expect(backend.getRate()).toBe(2)
        expect(audio.defaultPlaybackRate).toBe(2)
        expect(audio.playbackRate).toBe(2)

        backend.clearSource()
        expect(audio.defaultPlaybackRate).toBe(2)
        expect(audio.playbackRate).toBe(2)

        backend.setRate(0)
        expect(backend.getRate()).toBe(MIN_PLAYBACK_RATE)
        expect(audio.defaultPlaybackRate).toBe(MIN_PLAYBACK_RATE)
        expect(audio.playbackRate).toBe(MIN_PLAYBACK_RATE)

        backend.setRate(99)
        expect(backend.getRate()).toBe(MAX_PLAYBACK_RATE)
        expect(audio.playbackRate).toBe(MAX_PLAYBACK_RATE)

        backend.setRate(Number.NaN)
        expect(backend.getRate()).toBe(DEFAULT_PLAYBACK_RATE)
        expect(audio.playbackRate).toBe(DEFAULT_PLAYBACK_RATE)
    })

    it("re-anchors live Web Audio timing and preserves rate across source nodes", async () => {
        const { context, sources } = installAudioContext()
        const backend = createWebAudioBackend()

        await backend.play()
        expect(sources).toHaveLength(1)
        expect(sources[0].playbackRate.value).toBe(1)

        context.currentTime = 3
        expect(backend.getCurrentTime()).toBeCloseTo(3)

        backend.setRate(2)
        expect(sources[0].playbackRate.value).toBe(2)
        context.currentTime = 5
        expect(backend.getCurrentTime()).toBeCloseTo(7)

        backend.pause()
        expect(backend.getCurrentTime()).toBeCloseTo(7)
        context.currentTime = 9
        expect(backend.getCurrentTime()).toBeCloseTo(7)

        backend.setRate(0.5)
        await backend.play()
        expect(sources).toHaveLength(2)
        expect(sources[1].playbackRate.value).toBe(0.5)
        context.currentTime = 13
        expect(backend.getCurrentTime()).toBeCloseTo(9)

        backend.setCurrentTime(20)
        expect(sources).toHaveLength(3)
        expect(sources[2].playbackRate.value).toBe(0.5)
        context.currentTime = 15
        expect(backend.getCurrentTime()).toBeCloseTo(21)

        backend.destroy()
    })

    it("keeps the stored Web Audio rate through source and track replacement", async () => {
        const { sources } = installAudioContext()
        const backend = createWebAudioBackend()
        backend.setRate(1.75)

        await backend.play()
        backend.pause()
        backend.setSource("fallback.mp3")
        Object.assign(backend as unknown as Record<string, unknown>, {
            buffer: { duration: 90 } as AudioBuffer,
            state: "ready",
        })
        await backend.play()

        backend.pause()
        backend.setSource("track-b.mp3")
        Object.assign(backend as unknown as Record<string, unknown>, {
            buffer: { duration: 60 } as AudioBuffer,
            state: "ready",
        })
        await backend.play()

        expect(backend.getRate()).toBe(1.75)
        expect(sources.map((source) => source.playbackRate.value)).toEqual([
            1.75,
            1.75,
            1.75,
        ])

        backend.setRate(Number.POSITIVE_INFINITY)
        expect(backend.getRate()).toBe(DEFAULT_PLAYBACK_RATE)
        backend.destroy()
    })
})
