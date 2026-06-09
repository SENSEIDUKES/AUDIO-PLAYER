import {
    Component,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type {
    CSSProperties,
    KeyboardEvent,
    ReactNode,
} from "react"
import type { AudioPlayerProps, Track } from "./types"
import { useAudioPlayer } from "./useAudioPlayer"
import { ProgressBar } from "./components/ProgressBar"
import { VolumeControl } from "./components/VolumeControl"
import { formatTime } from "./utils/formatTime"
import { trackKey } from "./utils/trackKey"
import "./audio-player.css"

const DEFAULT_AUDIO =
    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"

/**
 * React error boundary wrapping the player body. Keeps an unexpected render
 * error in a child component (slider, menu, etc.) from crashing the entire
 * host app. The fallback surfaces a minimal message and a way to retry the
 * render attempt.
 */
class AudioPlayerErrorBoundary extends Component<
    { children: ReactNode; fallbackTitle: string },
    { error: Error | null }
> {
    state = { error: null as Error | null }

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    componentDidCatch(error: Error) {
        // eslint-disable-next-line no-console
        console.error("[AudioPlayer] render error:", error)
    }

    handleReset = () => {
        this.setState({ error: null })
    }

    render() {
        if (this.state.error) {
            return (
                <div className="ap-error-boundary" role="alert">
                    <p className="ap-error-boundary__title">
                        {this.props.fallbackTitle}
                    </p>
                    <p className="ap-error-boundary__message">
                        {this.state.error.message}
                    </p>
                    <button
                        type="button"
                        className="ap-retry-btn"
                        onClick={this.handleReset}
                    >
                        Retry
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export function AudioPlayer(props: AudioPlayerProps) {
    return (
        <AudioPlayerErrorBoundary fallbackTitle="Audio player failed to render">
            <AudioPlayerInner {...props} />
        </AudioPlayerErrorBoundary>
    )
}

function AudioPlayerInner(props: AudioPlayerProps) {
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
    const [menuOpen, setMenuOpen] = useState(false)
    const [localAutoPlay, setLocalAutoPlay] = useState(autoPlay)
    const [localLoop, setLocalLoop] = useState(loop)
    const rootRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const menuButtonRef = useRef<HTMLButtonElement>(null)
    const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([])
    const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (shareTimeoutRef.current !== null) {
                clearTimeout(shareTimeoutRef.current)
            }
        }
    }, [])

    // Keep local toggles in sync with prop changes (e.g. properties panel edits).
    useEffect(() => {
        setLocalAutoPlay(autoPlay)
    }, [autoPlay])
    useEffect(() => {
        setLocalLoop(loop)
    }, [loop])

    // Close the ellipsis menu when clicking outside the player. Escape closes
    // the menu and returns focus to the menu button so keyboard users land
    // somewhere predictable.
    useEffect(() => {
        if (!menuOpen) return
        const handleClick = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false)
            }
        }
        const handleKey = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") {
                setMenuOpen(false)
                // Return focus to the trigger so keyboard users don't get lost.
                menuButtonRef.current?.focus()
            }
        }
        document.addEventListener("mousedown", handleClick)
        document.addEventListener("keydown", handleKey)
        return () => {
            document.removeEventListener("mousedown", handleClick)
            document.removeEventListener("keydown", handleKey)
        }
    }, [menuOpen])

    // Keep the index valid if the track list shrinks / mode changes.
    useEffect(() => {
        if (isPlaylistMode && trackIndex >= tracks.length) setTrackIndex(0)
        if (!isPlaylistMode && trackIndex !== 0) setTrackIndex(0)
    }, [isPlaylistMode, trackIndex, tracks.length])

    const currentTrack: Track = useMemo(() => {
        if (isPlaylistMode && tracks[trackIndex]) return tracks[trackIndex]
        return { title, artist, audioFile, purchaseUrl, lyrics }
        // Derive from the *identity* of the active track. Recreating the object
        // on every render (because of prop reference changes) used to thrash
        // `currentTime` in the engine. The listed deps are the ones that
        // actually change the active track in playlist mode, plus the single-
        // track props.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Build a sourceKey that encodes the playlist position AND track identity,
    // so the engine resets when switching between playlist tracks that share the
    // same audio URL (e.g. a demo playlist with a single sample).
    //
    // In single-track mode the key is tied to `src` only. Folding title/artist
    // into it there would make display metadata part of the playback identity:
    // a consumer replacing placeholder metadata (CMS/localization fetch) while
    // the audio URL is unchanged would otherwise restart playback from 0.
    const sourceKey = isPlaylistMode
        ? `${trackIndex}:${trackKey(currentTrack)}`
        : src

    const advanceTrack = useCallback(() => {
        if (!isPlaylistMode) return
        setTrackIndex((i) => (i < tracks.length - 1 ? i + 1 : 0))
    }, [isPlaylistMode, tracks.length])

    const engine = useAudioPlayer({
        src,
        sourceKey,
        autoPlay: localAutoPlay,
        loop: localLoop,
        onEnded: advanceTrack,
    })

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
        volumeUnsupported,
        autoplayBlocked,
        toggle,
        seek,
        seekBy,
        setSeeking,
        setVolume,
        toggleMute,
        retry,
        dismissAutoplayBlocked,
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
    const toggleMenu = useCallback(() => {
        setMenuOpen((v) => {
            // When opening, reset focus to the first menu item.
            if (!v) {
                // Defer until after the items render.
                requestAnimationFrame(() => {
                    menuItemRefs.current[0]?.focus()
                })
            }
            return !v
        })
    }, [])

    const focusMenuItem = useCallback(
        (delta: number) => {
            const items = menuItemRefs.current.filter(
                (el): el is HTMLButtonElement => el !== null
            )
            if (items.length === 0) return
            const activeIndex = items.findIndex(
                (el) => el === document.activeElement
            )
            const start = activeIndex === -1 ? 0 : activeIndex
            const next =
                (start + delta + items.length) % items.length
            items[next]?.focus()
        },
        []
    )

    const handleMenuKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault()
                    focusMenuItem(1)
                    break
                case "ArrowUp":
                    event.preventDefault()
                    focusMenuItem(-1)
                    break
                case "Home":
                    event.preventDefault()
                    menuItemRefs.current[0]?.focus()
                    break
                case "End":
                    event.preventDefault()
                    {
                        const last =
                            menuItemRefs.current.filter(
                                (el): el is HTMLButtonElement => el !== null
                            )
                        last[last.length - 1]?.focus()
                    }
                    break
                case "Tab":
                    // Trap focus inside the open menu.
                    event.preventDefault()
                    focusMenuItem(event.shiftKey ? -1 : 1)
                    break
                default:
                    break
            }
        },
        [focusMenuItem]
    )

    const handleAutoPlayToggle = useCallback(
        () => setLocalAutoPlay((v) => !v),
        []
    )
    const handleLoopToggle = useCallback(
        () => setLocalLoop((v) => !v),
        []
    )

    const handleShare = useCallback(() => {
        if (typeof window === "undefined") return
        const url = window.location.href
        const text = `${currentTrack.title} by ${currentTrack.artist}`
        if (navigator.share) {
            navigator.share({ title: text, url }).catch(() => {})
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                if (shareTimeoutRef.current !== null) {
                    clearTimeout(shareTimeoutRef.current)
                }
                setShowCopied(true)
                shareTimeoutRef.current = setTimeout(
                    () => setShowCopied(false),
                    2000
                )
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

    // Track which play/pause transitions we have *already* announced so we
    // don't spam the live region on every rAF tick. `isBuffering` is
    // intentionally debounced: a brief buffer burst is not interesting.
    const lastPlayedRef = useRef<boolean | null>(null)
    const lastErrorRef = useRef<string | null>(null)
    const lastAutoplayRef = useRef<boolean | null>(null)
    const lastMissingRef = useRef<boolean | null>(null)
    useEffect(() => {
        // Track play/pause transitions, not levels.
        if (lastPlayedRef.current !== isPlaying) {
            lastPlayedRef.current = isPlaying
            if (isPlaying) {
                setAnnouncement(
                    `Playing ${currentTrack.title} by ${currentTrack.artist}`
                )
            }
        }
    }, [isPlaying, currentTrack.title, currentTrack.artist])

    useEffect(() => {
        const msg = errorMessage || ""
        if (lastErrorRef.current !== msg && hasError) {
            lastErrorRef.current = msg
            setAnnouncement(`Error: ${msg}`)
        } else if (!hasError) {
            lastErrorRef.current = null
        }
    }, [hasError, errorMessage])

    useEffect(() => {
        if (lastAutoplayRef.current !== autoplayBlocked) {
            lastAutoplayRef.current = autoplayBlocked
            if (autoplayBlocked) {
                setAnnouncement(
                    "Autoplay blocked. Tap play to start audio."
                )
            }
        }
    }, [autoplayBlocked])

    useEffect(() => {
        if (lastMissingRef.current !== hasAudio) {
            lastMissingRef.current = hasAudio
            if (!hasAudio) setAnnouncement("Audio file missing")
        }
    }, [hasAudio])

    // Pause the equalizer CSS animation when the tab is hidden so we don't
    // keep the GPU and rAF clock busy in the background.
    const [pageVisible, setPageVisible] = useState(() =>
        typeof document === "undefined"
            ? true
            : document.visibilityState !== "hidden"
    )
    useEffect(() => {
        if (typeof document === "undefined") return
        const onVis = () => setPageVisible(document.visibilityState !== "hidden")
        document.addEventListener("visibilitychange", onVis)
        return () => document.removeEventListener("visibilitychange", onVis)
    }, [])

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
            className={`ap-root${className ? ` ${className}` : ""}${
                pageVisible ? "" : " ap-root--hidden"
            }`}
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
                    style={{ backgroundImage: `url("${backgroundImage.src}")` }}
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

                {autoplayBlocked && hasAudio && !hasError && (
                    <div
                        className="ap-banner ap-banner--info ap-banner--col ap-anim-in"
                        role="status"
                    >
                        <div className="ap-banner__row">
                            <InfoIcon />
                            <span>Autoplay blocked. Tap play to start audio.</span>
                        </div>
                        <button
                            type="button"
                            className="ap-retry-btn"
                            onClick={() => {
                                dismissAutoplayBlocked()
                                toggle()
                            }}
                        >
                            Play
                        </button>
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

                <div className="ap-top-actions">
                    <div className="ap-menu" ref={menuRef}>
                        <button
                            type="button"
                            className="ap-icon-btn ap-tap ap-menu__btn"
                            onClick={toggleMenu}
                            aria-label="More options"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            ref={menuButtonRef}
                        >
                            <DotsIcon />
                        </button>
                        {menuOpen && (
                            <div
                                className="ap-menu__panel ap-anim-in"
                                role="menu"
                                onKeyDown={handleMenuKeyDown}
                            >
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={localAutoPlay}
                                    className="ap-menu__item ap-tap"
                                    onClick={handleAutoPlayToggle}
                                    ref={(el) => {
                                        menuItemRefs.current[0] = el
                                    }}
                                >
                                    <span className="ap-menu__label">
                                        <AutoPlayIcon />
                                        Auto Play
                                    </span>
                                    <span
                                        className={`ap-menu__switch${localAutoPlay ? " ap-menu__switch--on" : ""}`}
                                        aria-hidden="true"
                                    >
                                        <span className="ap-menu__knob" />
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={localLoop}
                                    className="ap-menu__item ap-tap"
                                    onClick={handleLoopToggle}
                                    ref={(el) => {
                                        menuItemRefs.current[1] = el
                                    }}
                                >
                                    <span className="ap-menu__label">
                                        <LoopIcon />
                                        Loop
                                    </span>
                                    <span
                                        className={`ap-menu__switch${localLoop ? " ap-menu__switch--on" : ""}`}
                                        aria-hidden="true"
                                    >
                                        <span className="ap-menu__knob" />
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="ap-share-btn ap-tap"
                        onClick={handleShare}
                        aria-label="Share track"
                    >
                        {showCopied ? <CheckIcon /> : <ShareIcon />}
                    </button>
                </div>

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
                        volumeUnsupported={volumeUnsupported}
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
                    <div
                        className="ap-tracklist ap-anim-in"
                        role="list"
                        aria-label="Playlist tracks"
                    >
                        {tracks.map((track, index) => {
                            const active = index === trackIndex
                            return (
                                <button
                                    type="button"
                                    key={`${track.audioFile}-${index}`}
                                    role="listitem"
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
const InfoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
        <polyline points="3 3 6.2 5.8 3.4 8.5" />
        <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
    </svg>
)
const Fwd10Icon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.5 12a8.5 8.5 0 1 1-2.7-6.2" />
        <polyline points="21 3 17.8 5.8 20.6 8.5" />
        <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
    </svg>
)
const PrevIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="4" width="2.5" height="16" rx="0.5" />
        <path d="M20 5v14L9 12z" />
    </svg>
)
const NextIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4 5v14l11-7z" />
        <rect x="16.5" y="4" width="2.5" height="16" rx="0.5" />
    </svg>
)
const ShareIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
)
const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)
const LyricsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
)
const HeartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
)
const DotsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
    </svg>
)
const AutoPlayIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
    </svg>
)
const LoopIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
)
