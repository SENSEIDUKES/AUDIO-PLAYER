// Example: Using the Audio Player in another repository

import React from 'react'
import { 
  AudioPlayer, 
  FullCardPlayer, 
  StickyBottomPlayer,
  useAudioSession,
  AudioSessionProvider,
  createAutomixPlugin,
  createKeyboardShortcutPlugin,
  createWaveformPlugin,
} from '@seihouse/audio-player'
import '@seihouse/audio-player/styles.css'

// Define your tracks
const tracks = [
  {
    id: 'track-1',
    title: 'Song Title',
    artist: 'Artist Name',
    audioFile: 'https://example.com/audio.mp3',
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
        accentColor="#6366f1"
        backgroundColor="#0f172a"
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
  const { 
    isPlaying, 
    currentTime, 
    duration,
    play, 
    pause,
    seek 
  } = useAudioSession()

  return (
    <div className="custom-player">
      <button onClick={isPlaying ? pause : play}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span>{Math.floor(currentTime)}s / {Math.floor(duration)}s</span>
    </div>
  )
}

export function AppWithPlugins() {
  const plugins = [
    createAutomixPlugin(),
    createKeyboardShortcutPlugin(),
    createWaveformPlugin(),
  ]

  return (
    <AudioPlayer tracks={tracks} plugins={plugins} />
  )
}
