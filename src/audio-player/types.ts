import type { CSSProperties } from "react"

/** A single playable track. */
export interface Track {
    title: string
    artist: string
    audioFile: string
    purchaseUrl?: string
    lyrics?: string
}

/** Theme colors. Applied to the player root as CSS custom properties. */
export interface AudioPlayerTheme {
    /** Buttons, thumb, accents. */
    accentColor?: string
    /** Icon color sitting on top of the accent-filled play button. */
    playIconColor?: string
    /** Primary text (title / time). */
    textColor?: string
    /** Filled portion of the progress bar. */
    progressColor?: string
    /** Unfilled portion of the progress bar. */
    trackColor?: string
    /** Player background tint (sits over the optional background image). */
    backgroundColor?: string
}

export interface BackgroundImage {
    src: string
    alt?: string
}

export interface AudioPlayerProps extends AudioPlayerTheme {
    /** Playlist. When non-empty, the player runs in playlist mode. */
    tracks?: Track[]

    /** Single-track fields (used when `tracks` is empty). */
    audioFile?: string
    title?: string
    artist?: string
    purchaseUrl?: string
    lyrics?: string

    /** Playback behavior. */
    autoPlay?: boolean
    loop?: boolean

    /** Presentation. */
    backgroundImage?: BackgroundImage
    /** Backdrop/background-image blur in px. */
    blurSize?: number
    /** Darken overlay over the background image, 0–100. */
    darkenAmount?: number
    showTracklist?: boolean
    showVolume?: boolean

    /** Typography (inline style objects). */
    titleFont?: CSSProperties
    artistFont?: CSSProperties

    /** Passthrough style/class for the root element. */
    className?: string
    style?: CSSProperties
}

/** Options accepted by the `useAudioPlayer` engine hook. */
export interface UseAudioPlayerOptions {
    /** Current source URL. Changing it loads a new track. */
    src: string
    autoPlay?: boolean
    loop?: boolean
    /** Fired when the current track reaches its end. */
    onEnded?: () => void
}

/** Everything the UI needs from the engine hook. */
export interface AudioPlayerEngine {
    audioRef: React.RefObject<HTMLAudioElement>

    // State
    isPlaying: boolean
    currentTime: number
    duration: number
    /** Seconds buffered ahead (end of the active buffered range). */
    buffered: number
    volume: number
    isMuted: boolean
    isBuffering: boolean
    isSeeking: boolean
    hasError: boolean
    errorMessage: string
    hasAudio: boolean

    // Actions
    play: (reportError?: boolean) => void
    pause: () => void
    toggle: () => void
    seek: (time: number) => void
    seekBy: (delta: number) => void
    setSeeking: (active: boolean) => void
    setVolume: (value: number) => void
    toggleMute: () => void
    retry: () => void
    /** Imperatively reload + play (used by playlist track changes). */
    loadAndPlay: () => void
}
