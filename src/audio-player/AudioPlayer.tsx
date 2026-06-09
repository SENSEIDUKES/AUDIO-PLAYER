import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type { CSSProperties, KeyboardEvent } from "react"
import type { AudioPlayerProps, Track } from "./types"
import { useAudioPlayer } from "./useAudioPlayer"
import { ProgressBar } from "./components/ProgressBar"
import { VolumeControl } from "./components/VolumeControl"
import { formatTime } from "./utils/formatTime"
import "./audio-player.css"

const DEFAULT_AUDIO =
    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"

export function AudioPlayer(props: AudioPlayerProps) {
    const {
        tracks = [],
        audioFile = DEFAULT_AUDIO,
        title = "Audio Track",
        artist = "Artist Name",
        purchaseUrl = "",
        lyrics = "",
        autoPlay = false,
        loop = false,
        backgroundImage,
        blurSize = 20,
        darkenAmount = 0,
        showTracklist = false,
        showVolume = true,
        titleFont,
        artistFont,
        accentColor = "#FFFFFF",
        playIconColor = "#000000",
        textColor = "#FFFFFF",
        progressColor = "#FFFFFF",
        trackColor = "rgba(204, 204, 204, 0.35)",
        backgroundColor = "rgba(255, 255, 255, 0)",
        className,
        style,
    } = props

    const isPlaylistMode = tracks.length > 0
    const [trackIndex, setTrackIndex] = useState(0)
    const [showLyrics, setShowLyrics] = useState(false)
    const [showCopied, setShowCopied] = useState(false)
    const [announcement, setAnnouncement] = useState("")
    const rootRef = useRef<HTMLDivElement>(null)

    // Keep the index valid if the track list shrinks / mode changes.
    useEffect(() => {
        if (isPlaylistMode && trackIndex >= tracks.length) setTrackIndex(0)
        if (!isPlaylistMode && trackIndex !== 0) setTrackIndex(0)
    }, [isPlaylistMode, trackIndex, tracks.length])

    const currentTrack: Track = useMemo(() => {
        if (isPlaylistMode && tracks[trackIndex]) return tracks[trackIndex]
        return { title, artist, audioFile, purchaseUrl, lyrics }
    }, [
        isPlaylistMode,
        tracks,
        trackIndex,
        title,
        artist,
        audioFile,
        purchaseUrl,
        lyrics,
    ])

    const src = currentTrack.audioFile?.trim() ?? ""

    const advanceTrack = useCallback(() => {
        if (!isPlaylistMode) return
        setTrackIndex((i) => (i < tracks.length - 1 ? i + 1 : 0))
    }, [isPlaylistMode, tracks.length])

    const engine = useAudioPlayer({ src, autoPlay, loop, onEnded: advanceTrack })

    const {
        audioRef,
        isPlaying,
        currentTime,
        duration,
        buffered,
        volume,
        isMuted,
        isBuffering,
        isSeeking,
        hasError,
        errorMessage,
        hasAudio,
        toggle,
        seek,
        seekBy,
        setSeeking,
        setVolume,
        toggleMute,
        retry,
    } = engine

    const goToTrack = useCallback(
        (next: number) => {
            if (!isPlaylistMode) return
            const clamped = ((next % tracks.length) + tracks.length) % tracks.length
            if (clamped !== trackIndex) setTrackIndex(clamped)
        },
        [isPlaylistMode, trackIndex, tracks.length]
    )

    const previousTrack = useCallback(
        () => goToTrack(trackIndex - 1),
        [goToTrack, trackIndex]
    )
    const nextTrack = useCallback(
        () => goToTrack(trackIndex + 1),
        [goToTrack, trackIndex]
    )

    const toggleLyrics = useCallback(() => setShowLyrics((v) => !v), [])

    const handleShare = useCallback(() => {
        if (typeof window === "undefined") return
        const url = window.location.href
        const text = `${currentTrack.title} by ${currentTrack.artist}`
        if (navigator.share) {
            navigator.share({ title: text, url }).catch(() => {})
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                setShowCopied(true)
                setTimeout(() => setShowCopied(false), 2000)
            })
        }
    }, [currentTrack.title, currentTrack.artist])

    // Keyboard shortcuts scoped to the player root (not window) so they never
    // fight focused controls or other parts of the host app. Space/Enter on an
    // actual button is left to the button, preventing double-triggering.
    const handleRootKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement
            const onInteractive = !!target.closest(
                "button, a, input, [role='slider']"
            )
            const key = event.key.toLowerCase()

            if ((event.key === " " || key === "k") && !onInteractive) {
                event.preventDefault()
                toggle()
            } else if (key === "j") {
                event.preventDefault()
                seekBy(-10)
            } else if (key === "l") {
                event.preventDefault()
                seekBy(10)
            } else if (key === "n" && isPlaylistMode) {
                event.preventDefault()
                nextTrack()
            } else if (key === "p" && isPlaylistMode) {
                event.preventDefault()
                previousTrack()
            }
        },
        [isPlaylistMode, nextTrack, previousTrack, seekBy, toggle]
    )

    // Screen-reader announcements for key state changes.
    useEffect(() => {
        if (!hasAudio) setAnnouncement("Audio file missing")
        else if (hasError) setAnnouncement(`Error: ${errorMessage}`)
        else if (isBuffering) setAnnouncement("Buffering audio…")
        else if (isPlaying)
            setAnnouncement(
                `Playing ${currentTrack.title} by ${currentTrack.artist}`
            )
    }, [
        hasAudio,
        hasError,
        errorMessage,
        isBuffering,
        isPlaying,
        currentTrack.title,
        currentTrack.artist,
    ])

    const themeVars = {
        "--ap-accent": accentColor,
        "--ap-play-icon": playIconColor,
        "--ap-text": textColor,
        "--ap-progress": progressColor,
        "--ap-track": trackColor,
        "--ap-bg": backgroundColor,
        "--ap-blur": `${blurSize}px`,
    } as CSSProperties

    return (
        <div
            ref={rootRef}
            className={`ap-root${className ? ` ${className}` : ""}`}
            style={{ ...themeVars, ...style }}
            role="region"
            aria-label="Audio player"
            onKeyDown={handleRootKeyDown}
        >
            {/* SR live region */}
            <div className="ap-sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>

            {backgroundImage?.src && (
                <div
                    className="ap-bg-image"
                    style={{ backgroundImage: `url(${backgroundImage.src})` }}
                    aria-hidden="true"
                />
            )}
            {backgroundImage?.src && darkenAmount > 0 && (
                <div
                    className="ap-bg-darken"
                    style={{ backgroundColor: `rgba(0,0,0,${darkenAmount / 100})` }}
                    aria-hidden="true"
                />
            )}

            <div className="ap-content">
                <audio ref={audioRef} src={hasAudio ? src : undefined} />

                {!hasAudio && (
                    <div className="ap-banner ap-banner--error ap-anim-in">
                        <ErrorIcon />
                        <span>Audio file missing</span>
                    </div>
                )}

                {hasError && hasAudio && (
                    <div className="ap-banner ap-banner--error ap-banner--col ap-anim-in">
                        <div className="ap-banner__row">
                            <ErrorIcon />
                            <span>{errorMessage}</span>
                        </div>
                        <button type="button" className="ap-retry-btn" onClick={retry}>
                            Retry
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    className="ap-share-btn ap-tap"
                    onClick={handleShare}
                    aria-label="Share track"
                >
                    {showCopied ? <CheckIcon /> : <ShareIcon />}
                </button>

                {isPlaylistMode && (
                    <div className="ap-track-counter">
                        Track {trackIndex + 1} of {tracks.length}
                    </div>
                )}

                <div className="ap-track-info" role="group" aria-label="Track information">
                    <div
                        className="ap-track-info__title"
                        style={titleFont}
                        title={currentTrack.title}
                    >
                        {currentTrack.title}
                    </div>
                    <div
                        className="ap-track-info__artist"
                        style={artistFont}
                        title={currentTrack.artist}
                    >
                        {currentTrack.artist}
                    </div>
                </div>

                <div className="ap-progress-group" role="group" aria-label="Playback progress">
                    <ProgressBar
                        currentTime={currentTime}
                        duration={duration}
                        buffered={buffered}
                        disabled={!hasAudio}
                        isSeeking={isSeeking}
                        onSeek={seek}
                        onSeekStart={() => setSeeking(true)}
                        onSeekEnd={() => setSeeking(false)}
                    />
                    <div className="ap-times" aria-hidden="true">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="ap-transport" role="group" aria-label="Playback controls">
                    {isPlaylistMode && (
                        <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={previousTrack}
                            aria-label="Previous track"
                        >
                            <PrevIcon />
                        </button>
                    )}

                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-tap"
                        onClick={() => seekBy(-10)}
                        disabled={!hasAudio}
                        aria-label="Skip backward 10 seconds"
                    >
                        <Back10Icon />
                    </button>

                    <button
                        type="button"
                        className={`ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                        onClick={toggle}
                        disabled={!hasAudio}
                        aria-label={
                            !hasAudio
                                ? "Audio file missing"
                                : isBuffering
                                  ? "Buffering audio"
                                  : isPlaying
                                    ? "Pause"
                                    : "Play"
                        }
                    >
                        {isBuffering ? (
                            <SpinnerIcon />
                        ) : isPlaying ? (
                            <PauseIcon />
                        ) : (
                            <PlayIcon />
                        )}
                    </button>

                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-tap"
                        onClick={() => seekBy(10)}
                        disabled={!hasAudio}
                        aria-label="Skip forward 10 seconds"
                    >
                        <Fwd10Icon />
                    </button>

                    {isPlaylistMode && (
                        <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={nextTrack}
                            aria-label="Next track"
                        >
                            <NextIcon />
                        </button>
                    )}
                </div>

                {showVolume && (
                    <VolumeControl
                        volume={volume}
                        isMuted={isMuted}
                        disabled={!hasAudio}
                        onVolumeChange={setVolume}
                        onToggleMute={toggleMute}
                    />
                )}

                {currentTrack.lyrics && (
                    <button
                        type="button"
                        className="ap-wide-btn ap-wide-btn--ghost ap-tap"
                        onClick={toggleLyrics}
                        aria-expanded={showLyrics}
                    >
                        <LyricsIcon />
                        {showLyrics ? "Hide Lyrics" : "Show Lyrics"}
                    </button>
                )}

                {currentTrack.purchaseUrl && (
                    <a
                        className="ap-wide-btn ap-wide-btn--solid ap-tap"
                        href={currentTrack.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <HeartIcon />
                        Support Artist
                    </a>
                )}

                {showLyrics && currentTrack.lyrics && (
                    <div className="ap-lyrics ap-anim-in">{currentTrack.lyrics}</div>
                )}

                {isPlaylistMode && showTracklist && (
                    <div className="ap-tracklist ap-anim-in">
                        {tracks.map((track, index) => {
                            const active = index === trackIndex
                            return (
                                <button
                                    type="button"
                                    key={index}
                                    className={`ap-tracklist__item${active ? " ap-tracklist__item--active" : ""}`}
                                    onClick={() => goToTrack(index)}
                                    aria-current={active ? "true" : undefined}
                                >
                                    <span className="ap-tracklist__num">{index + 1}</span>
                                    <span className="ap-tracklist__meta">
                                        <span className="ap-tracklist__title">{track.title}</span>
                                        <span className="ap-tracklist__artist">{track.artist}</span>
                                    </span>
                                    {active && isPlaying && (
                                        <span className="ap-eq" aria-hidden="true">
                                            <i /><i /><i />
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AudioPlayer

/* ----------------------------- Icons ----------------------------- */

const ErrorIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
)
const PlayIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l12-7z" />
    </svg>
)
const PauseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
)
const SpinnerIcon = () => (
    <svg className="ap-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
)
const Back10Icon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 18V6l-8.5 6 8.5 6zm.5-12v12h2V6h-2z" />
    </svg>
)
const Fwd10Icon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 18l8.5-6L4 6v12zm10-12v12h2V6h-2z" />
    </svg>
)
const PrevIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 18l8.5-6L6 6v12zm.5-12v12h2V6h-2z" />
    </svg>
)
const NextIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
    </svg>
)
const ShareIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
)
const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)
const LyricsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
)
const HeartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
)
