// Example: Using the Audio Player in another repository

import React from "react"
import {
    AudioPlayer,
    FullCardPlayer,
    StickyBottomPlayer,
    useAudioSession,
    AudioSessionProvider,
} from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"

// Define your tracks
const tracks = [
    {
        id: "track-1",
        title: "Song Title",
        artist: "Artist Name",
        albumArt: "https://example.com/cover.jpg",
        src: "https://example.com/audio.mp3",
        duration: 240, // seconds
    },
    // ... more tracks
]

// Basic usage with default player
export function MyApp() {
    return (
        <div className="app">
            <h1>My Music App</h1>
            <AudioPlayer
                tracks={tracks}
                initialTrackId={tracks[0].id}
                theme={{
                    primaryColor: "#6366f1",
                    backgroundColor: "#0f172a",
                }}
            />
        </div>
    )
}

// Usage with session provider for multiple player instances
export function MultiPlayerApp() {
    return (
        <AudioSessionProvider>
            <Header />
            <MainContent />
            {/* Sticky player at bottom */}
            <StickyBottomPlayer />
        </AudioSessionProvider>
    )
}

// Headless usage with custom UI
export function CustomPlayerUI() {
    const { isPlaying, currentTime, duration, play, pause, seek } = useAudioSession()

    return (
        <div className="custom-player">
            <button onClick={isPlaying ? pause : play}>{isPlaying ? "Pause" : "Play"}</button>
            <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
            />
            <span>
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
            </span>
        </div>
    )
}

// With plugins
import {
    PluginRegistryProvider,
    createAutomixPlugin,
    createKeyboardShortcutPlugin,
} from "@seihouse/audio-player"

export function AppWithPlugins() {
    const plugins = [
        createAutomixPlugin({ enabled: true, crossfadeMs: 3000 }),
        createKeyboardShortcutPlugin({ enabled: true }),
    ]

    return (
        <PluginRegistryProvider plugins={plugins}>
            <AudioPlayer tracks={tracks} />
        </PluginRegistryProvider>
    )
}
