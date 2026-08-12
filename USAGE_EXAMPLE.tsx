// Copy-paste examples for a consuming React application.
// This file is type-checked by `npm run test:docs`.

import { useMemo } from "react"
import {
    AudioPlayer,
    AudioSessionProvider,
    createAutomixPlugin,
    createKeyboardShortcutPlugin,
    StickyBottomPlayer,
    type Track,
    useAudioSession,
} from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"

const tracks: Track[] = [
    {
        id: "track-1",
        title: "Song Title",
        artist: "Artist Name",
        artwork: "https://example.com/cover.jpg",
        audioFile: "https://example.com/audio.mp3",
    },
]

// One self-contained player. AudioPlayer owns its session internally.
export function StandalonePlayerExample() {
    return <AudioPlayer tracks={tracks} accentColor="#6366f1" backgroundColor="#0f172a" />
}

// One shared queue with custom controls and a skin. Every child uses the same
// audio element, playback state, and queue from AudioSessionProvider.
export function SharedSessionExample() {
    return (
        <AudioSessionProvider initialQueue={tracks}>
            <CustomPlayerControls />
            <StickyBottomPlayer />
        </AudioSessionProvider>
    )
}

function CustomPlayerControls() {
    const { isPlaying, currentTime, duration, pause, play, seek } = useAudioSession()

    return (
        <div className="custom-player">
            <button type="button" onClick={() => (isPlaying ? pause() : play())}>
                {isPlaying ? "Pause" : "Play"}
            </button>
            <input
                type="range"
                aria-label="Seek within track"
                min={0}
                max={Math.max(duration, 0)}
                value={currentTime}
                onChange={(event) => seek(Number(event.target.value))}
            />
            <span>
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
            </span>
        </div>
    )
}

// Plugins are lifecycle objects, so keep their array stable across renders.
export function PluginExample() {
    const plugins = useMemo(
        () => [
            createAutomixPlugin({ confidenceMin: 0.6 }),
            createKeyboardShortcutPlugin({ scope: "document" }),
        ],
        []
    )

    return <AudioPlayer tracks={tracks} plugins={plugins} />
}
