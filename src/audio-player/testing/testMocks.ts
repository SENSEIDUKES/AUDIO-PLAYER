import { vi } from "vitest"
import type { AudioPlayerEngine, RepeatMode, Track, SessionEngine } from "../types"
import type { PluginPlayerContext, PluginSoundLayer } from "../core/plugins/PluginInterface"

/**
 * Partial or mock representation of an AudioPlayerEngine for unit tests.
 */
export interface MockAudioEngine {
    currentTime: number
    duration: number
    buffered: number
    isPlaying: boolean
    isPaused: boolean
    isStopped: boolean
    isBuffering: boolean
    isSeeking: boolean
    volume: number
    isMuted: boolean
    playbackRate: number
    hasError: boolean
    errorMessage: string
    volumeUnsupported: boolean
    deckState?: string
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    toggle: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    seek: ReturnType<typeof vi.fn>
    seekBy: ReturnType<typeof vi.fn>
    setVolume: ReturnType<typeof vi.fn>
    setMuted: ReturnType<typeof vi.fn>
    setPlaybackRate: ReturnType<typeof vi.fn>
}

/**
 * Creates a fully typed mock audio engine for testing components and plugins.
 */
export function createMockAudioEngine(
    overrides: Partial<MockAudioEngine> = {}
): AudioPlayerEngine & MockAudioEngine {
    const base: MockAudioEngine = {
        currentTime: 0,
        duration: 180,
        buffered: 180,
        isPlaying: false,
        isPaused: true,
        isStopped: false,
        isBuffering: false,
        isSeeking: false,
        volume: 1,
        isMuted: false,
        playbackRate: 1,
        hasError: false,
        errorMessage: "",
        volumeUnsupported: false,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        toggle: vi.fn(),
        stop: vi.fn(),
        seek: vi.fn(),
        seekBy: vi.fn(),
        setVolume: vi.fn(),
        setMuted: vi.fn(),
        setPlaybackRate: vi.fn(),
        ...overrides,
    }
    return base as unknown as AudioPlayerEngine & MockAudioEngine
}

/**
 * Creates a fully typed PluginPlayerContext mock for plugin testing.
 */
export function createMockPluginContext(
    overrides: Partial<PluginPlayerContext> = {}
): PluginPlayerContext {
    const defaultEngine = createMockAudioEngine()
    const defaultRoot = typeof document !== "undefined" ? document.createElement("div") : null

    return {
        getEngine: vi.fn().mockReturnValue(defaultEngine),
        getRootElement: vi.fn().mockReturnValue(defaultRoot),
        getAudioElement: vi.fn().mockReturnValue(null),
        getCurrentTrack: vi.fn().mockReturnValue(null),
        getNextTrack: vi.fn().mockReturnValue(null),
        getSourceKey: vi.fn().mockReturnValue("test-source"),
        requestAdvance: vi.fn(),
        next: vi.fn(),
        previous: vi.fn(),
        getQueue: vi.fn().mockReturnValue([]),
        getCurrentIndex: vi.fn().mockReturnValue(0),
        getRepeatMode: vi.fn().mockReturnValue("off" as RepeatMode),
        getShuffle: vi.fn().mockReturnValue(false),
        ...overrides,
    }
}

/**
 * Typed mock for PluginSoundLayer.
 */
export function createMockSoundLayer(
    overrides: Partial<PluginSoundLayer> = {}
): PluginSoundLayer {
    return {
        loadSpritePack: vi.fn().mockResolvedValue(undefined),
        playSprite: vi.fn().mockReturnValue("sprite-1"),
        stopSprite: vi.fn(),
        fadeSprite: vi.fn(),
        stopAllSprites: vi.fn(),
        ...overrides,
    }
}

/**
 * Typed mock for Web Audio Context (Partial<AudioContext>).
 */
export type MockAudioContext = Partial<AudioContext>

export function createMockAudioContext(
    overrides: Partial<AudioContext> = {}
): AudioContext {
    const ctx = {
        state: "running" as AudioContextState,
        sampleRate: 44100,
        currentTime: 0,
        resume: vi.fn().mockResolvedValue(undefined),
        suspend: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createGain: vi.fn().mockReturnValue({
            gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            disconnect: vi.fn(),
        }),
        createBufferSource: vi.fn().mockReturnValue({
            buffer: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
        }),
        decodeAudioData: vi.fn().mockResolvedValue({
            duration: 180,
            length: 44100 * 180,
            numberOfChannels: 2,
            sampleRate: 44100,
            getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
        }),
        ...overrides,
    }
    return ctx as unknown as AudioContext
}

/**
 * Helper to build a valid Mock Track for testing.
 */
export function createMockTrack(id: string = "track-1", overrides: Partial<Track> = {}): Track {
    return {
        id,
        title: `Test Track ${id}`,
        artist: "Test Artist",
        audioFile: `https://example.com/audio-${id}.mp3`,
        ...overrides,
    }
}

/**
 * Typed mock session engine for testing AudioSession components.
 */
export type MockSessionEngine = Partial<SessionEngine>
