import {
    Component,
    memo,
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
import type { AudioPlayerPlugin } from "./core/plugins/PluginInterface"
import {
    AudioSessionProvider,
    useAudioSession,
} from "./session/AudioSessionContext"
import {
    useMediaSessionObserver,
    buildMediaSessionArtwork,
    resolveArtworkSrc,
} from "./headless/useMediaSessionObserver"
import { WaveformAdapter } from "./components/WaveformAdapter"
import { BackgroundMedia, resolveMedia } from "./components/BackgroundMedia"
import { ScrubberCanvasHost } from "./surfaces/ScrubberCanvasHost"
import { getScrubberDensity } from "./surfaces/faceCapabilities"
import { usePlayerSurface } from "./surfaces/usePlayerSurface"
import { PlayerSurfaceButtons } from "./surfaces/PlayerSurfaceButtons"
import { SEICanvasHost } from "./surfaces/SEICanvasHost"
import { QueueSurface } from "./surfaces/QueueSurface"
import { VisualSlotsProvider } from "./visual-slots/VisualSlotsContext"
import { SEICanvasRenderer } from "./visual-slots/SEICanvasRenderer"
import { ScrubberCanvasRenderer } from "./visual-slots/ScrubberCanvasRenderer"
import { VolumeControl } from "./components/VolumeControl"
import { QueueDrawer } from "./components/QueueDrawer"
import { SAPController } from "./components/SAPController"
import { HoldSkipButton } from "./components/HoldSkipButton"
import { useShareTrack } from "./components/useShareTrack"
import { ExplicitBadge } from "./components/TrackMetadata"
import { formatTime } from "./utils/formatTime"
import {
    formatSecondaryLine,
    formatVersionedTitle,
} from "./utils/formatMetadata"
import { defaultShowVolume } from "./utils/device"
import { FixedSizeList } from "react-window"
import { resolveTrackList } from "./utils/trackList"
import { trackKey } from "./utils/trackKey"
import { trackSourcesSignature } from "./utils/sources"
import type { WorkspaceRoute } from "./components/workspace/workspaceRoutes"
import "./audio-player.css"

const TrackRow = memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
    const { queue, currentIndex, onPlay, isPlaying } = data
    const track = queue[index]
    if (!track) return null
    const active = index === currentIndex
    return (
        <div style={style} role="listitem">
            <button
                type="button"
                className={"ap-tracklist__item" + (active ? " ap-tracklist__item--active" : "")}
                onClick={() => onPlay(index)}
                aria-current={active ? "true" : undefined}
                style={{ height: 'calc(100% - 4px)', width: '100%', boxSizing: 'border-box' }}
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
        </div>
    )
})

const DEFAULT_AUDIO =
    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"
const EMPTY_PLUGINS: readonly AudioPlayerPlugin[] = []


function trackPeaksSignature(peaks: Track["peaks"]): string {
    if (!peaks) return ""
    return peaks
        .map((channel) => {
            const last = channel.length > 0 ? channel[channel.length - 1] : ""
            return `${channel.length}:${channel[0] ?? ""}:${last}`
        })
        .join(",")
}

function trackListSignature(tracks: Track[]): string {
    return JSON.stringify(
        tracks.map((track) => [
            trackKey(track),
            track.title ?? "",
            track.artist ?? "",
            track.audioFile ?? "",
            trackSourcesSignature(track),
            track.purchaseUrl ?? "",
            track.lyrics ?? "",
            track.waveformDuration ?? null,
            trackPeaksSignature(track.peaks),
        ])
    )
}

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

/**
 * The standalone, self-contained player (`PLAYER_FACE_CAPABILITIES.portable`).
 *
 * Main is *the better version of the FullCardPlayer*, not a different player:
 * it runs on the exact same `AudioSessionProvider` engine every other skin
 * uses. Rather than require the host to wrap it, `AudioPlayer` provides its own
 * session internally from its flat props (`title`/`artist`/`audioFile` or a
 * `tracks` playlist), so standalone usage is unchanged while the queue,
 * shuffle/repeat/automix logic, plugin pipeline, and end-of-track advance are
 * all owned by the shared session — no duplicated playback engine.
 *
 * Full-featured portable player with complete surface infrastructure support:
 * - `SEICanvasHost` for plugin visual areas (canvas toggle + Up Next queue)
 * - `ScrubberCanvasHost` + `WaveformAdapter` for unified scrubber waveform
 * - `PlayerSurfaceButtons` providing:
 *   - Left: SEI Canvas toggle button
 *   - Right: `SEICanvasActionMenu` (radial command wheel)
 * - `SAPController` for deep actions (shuffle, repeat, automix, autoplay,
 *   queue, info, share, plugins) — shared with the arc menu via workspace routes
 *
 * The arc menu and "..." button share a single SAPController instance, with
 * workspace routes determining which focused panel displays (e.g. Lyrics,
 * Automix, Plugin Settings). This matches the FullCardPlayer architecture.
 *
 * Waveform display is controlled by:
 * 1. Explicit `showWaveform` prop (highest priority)
 * 2. WaveformPlugin presence + toggle state
 * 3. Falls back to basic progress bar
 *
 * Mobile volume follows `defaultShowVolume()` default (visible on desktop,
 * hidden on touch).
 */
export function AudioPlayer(props: AudioPlayerProps) {
    return (
        <AudioPlayerErrorBoundary fallbackTitle="Audio player failed to render">
            <AudioPlayerInner {...props} />
        </AudioPlayerErrorBoundary>
    )
}

/**
 * Outer shell: resolves props into a session queue and provides its own
 * `AudioSessionProvider`, so the body below is a true session skin (like
 * `FullCardPlayer`) instead of a parallel engine. The provider owns the single
 * `<audio>` element, the queue/shuffle/repeat/automix logic, the plugin
 * pipeline, and end-of-track advance.
 */
function AudioPlayerInner(props: AudioPlayerProps) {
    const {
        tracks: tracksProp,
        audioFile = DEFAULT_AUDIO,
        title = "Audio Track",
        artist = "Artist Name",
        purchaseUrl = "",
        lyrics = "",
        autoPlay = false,
        loop = false,
        shuffle = false,
        repeatMode: repeatModeProp,
        automix = false,
        plugins: externalPlugins = EMPTY_PLUGINS,
        audioBackend = "html5",
        onFallbackSource,
    } = props

    const tracks = resolveTrackList(tracksProp)
    const isPlaylistMode = tracks.length > 0

    // Build the session queue from props. Playlist mode uses the resolved track
    // list; single-track mode wraps the flat title/artist/audioFile props (plus
    // any source/lyrics fields) in a one-entry queue. Either way the body runs
    // on the shared AudioSessionProvider engine.
    const initialQueue = useMemo<Track[]>(
        () =>
            isPlaylistMode
                ? tracks
                : [
                      {
                          title,
                          artist,
                          audioFile,
                          fallbackSources: props.fallbackSources,
                          sources: props.sources,
                          purchaseUrl,
                          lyrics,
                      },
                  ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            isPlaylistMode,
            tracks,
            title,
            artist,
            audioFile,
            props.fallbackSources,
            props.sources,
            purchaseUrl,
            lyrics,
        ]
    )
    // Logical identity of the queue. Drives the body's prop→session re-sync so
    // parent re-renders that merely recreate the array don't wipe session-side
    // edits (reorder/remove).
    const queueSignature = useMemo(
        () => trackListSignature(initialQueue),
        [initialQueue]
    )

    return (
        <AudioSessionProvider
            initialQueue={initialQueue}
            autoPlay={autoPlay}
            shuffle={shuffle}
            repeatMode={repeatModeProp ?? (loop ? "one" : "off")}
            automix={automix}
            plugins={externalPlugins}
            audioBackend={audioBackend}
            onFallbackSource={onFallbackSource}
        >
            <AudioPlayerBody
                {...props}
                isPlaylistMode={isPlaylistMode}
                resolvedQueue={initialQueue}
                queueSignature={queueSignature}
            />
        </AudioSessionProvider>
    )
}

type AudioPlayerBodyProps = AudioPlayerProps & {
    isPlaylistMode: boolean
    resolvedQueue: Track[]
    queueSignature: string
}

function AudioPlayerBody(props: AudioPlayerBodyProps) {
    const {
        isPlaylistMode,
        resolvedQueue,
        queueSignature,
        audioFile = DEFAULT_AUDIO,
        title = "Audio Track",
        artist = "Artist Name",
        purchaseUrl = "",
        lyrics = "",
        autoPlay = false,
        backgroundImage,
        backgroundMedia,
        blurSize = 20,
        darkenAmount = 0,
        showTracklist = false,
        showVolume = defaultShowVolume(),
        showWaveform,
        waveformHeight = 48,
        titleFont,
        artistFont,
        accentColor = "#FFFFFF",
        playIconColor = "#000000",
        textColor = "#FFFFFF",
        progressColor = "#FFFFFF",
        trackColor = "rgba(204, 204, 204, 0.35)",
        backgroundColor = "rgba(255, 255, 255, 0)",
        glowColor = "transparent",
        glowIntensity = 100,
        buttonOpacity = 0,
        plugins: externalPlugins = EMPTY_PLUGINS,
        className,
        style,
    } = props

    const s = useAudioSession()

    const [announcement, setAnnouncement] = useState("")
    const [controllerOpen, setControllerOpen] = useState(false)
    // Autoplay is a session init-time concern (it only affects the first load);
    // the SAP toggle is kept as local UI state so the control stays available
    // without re-arming playback mid-session.
    const [localAutoPlay, setLocalAutoPlay] = useState(autoPlay)
    const [queueOpen, setQueueOpen] = useState(false)

    // Surface state management for canvas/queue surfaces (mirrors FullCardPlayer).
    const surface = usePlayerSurface("portable")

    // Controller route state (shared between "..." button and arc menu).
    const [controllerRoute, setControllerRoute] = useState<WorkspaceRoute>("options")

    const rootRef = useRef<HTMLDivElement>(null)
    const previousQueueSignatureRef = useRef(queueSignature)

    // Waveform scrubber: the registry Waveform plugin marks itself via
    // `providesWaveform`. When present, the player shows the wavesurfer waveform,
    // gated by a "Show Waveform" toggle (default ON each time it activates).
    const hasWaveformPlugin = useMemo(
        () => externalPlugins.some((plugin) => plugin.providesWaveform),
        [externalPlugins]
    )
    const hasKeyboardShortcutPlugin = useMemo(
        () => externalPlugins.some((plugin) => plugin.handlesKeyboardShortcuts),
        [externalPlugins]
    )
    const [waveformEnabled, setWaveformEnabled] = useState(true)
    // Reset the toggle ON each time the plugin (re)activates. Adjusting state
    // during render (vs. an effect) is the idiomatic pattern and avoids an extra
    // commit/render pass.
    const [prevHasWaveformPlugin, setPrevHasWaveformPlugin] =
        useState(hasWaveformPlugin)
    if (hasWaveformPlugin !== prevHasWaveformPlugin) {
        setPrevHasWaveformPlugin(hasWaveformPlugin)
        if (hasWaveformPlugin) setWaveformEnabled(true)
    }

    // Scrubber mode: an explicit `showWaveform` prop wins; otherwise the plugin
    // (with its toggle) decides; with neither, the basic progress bar.
    const effectiveWaveform =
        showWaveform ?? (hasWaveformPlugin ? waveformEnabled : false)

    // Re-sync the session queue when the logical track list (or single-track
    // props) changes, preserving the active position. Only fires on a real
    // signature change so session-side edits (reorder/remove) survive parent
    // re-renders that recreate the array instance.
    useEffect(() => {
        if (previousQueueSignatureRef.current === queueSignature) return
        previousQueueSignatureRef.current = queueSignature
        const current = s.currentIndex < 0 ? 0 : s.currentIndex
        const nextIndex = Math.min(current, Math.max(0, resolvedQueue.length - 1))
        s.setQueue(resolvedQueue, nextIndex, false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queueSignature])

    const [prevAutoPlay, setPrevAutoPlay] = useState(autoPlay)
    if (autoPlay !== prevAutoPlay) {
        setPrevAutoPlay(autoPlay)
        setLocalAutoPlay(autoPlay)
    }

    const {
        currentTrack: sessionTrack,
        currentIndex,
        queue,
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
        currentSrc,
        volumeUnsupported,
        autoplayBlocked,
        shuffle,
        repeatMode,
        automix,
        canNext,
        canPrevious,
    } = s

    // AudioPlayer's queue is never empty (single-track mode always supplies one
    // entry), but fall back to the flat props so every field reference stays
    // non-null without per-site guards.
    const currentTrack: Track = sessionTrack ?? {
        title,
        artist,
        audioFile,
        fallbackSources: props.fallbackSources,
        sources: props.sources,
        purchaseUrl,
        lyrics,
    }

    // Identity key for waveform caching + Media Session, matching the key the
    // session engine derives internally for its reset lifecycle.
    const sourceKey = sessionTrack
        ? `${currentIndex}:${trackKey(sessionTrack)}:${trackSourcesSignature(sessionTrack)}`
        : "empty"

    // Engine gates `isBuffering` to active/pending playback (and debounces brief
    // stalls), so the spinner renders straight from it — no idle/paused spinner,
    // and no flashing during healthy playback.
    const showPlaySpinner = isBuffering

    const canPreviousTrack = isPlaylistMode && canPrevious
    const canNextTrack = isPlaylistMode && canNext

    const handleAutoPlayToggle = useCallback(
        () => setLocalAutoPlay((v) => !v),
        []
    )

    // Queue drawer: play a track then close the drawer (the drawer-specific
    // affordance the bare session `playTrack` doesn't provide).
    const handleQueuePlayTrack = useCallback(
        (index: number) => {
            s.playTrack(index)
            setQueueOpen(false)
        },
        [s]
    )

    const { share, copied: shareCopied, nativeShare } = useShareTrack(
        currentTrack.title ?? "",
        currentTrack.artist ?? ""
    )
    const handleShareClick = useCallback(() => {
        // The native share sheet takes over the screen, so the controller
        // closes first; the clipboard fallback keeps it open so the inline
        // "copied" feedback stays visible.
        if (nativeShare) setControllerOpen(false)
        share()
    }, [nativeShare, share])

    // Shared SAP Controller: a single instance serves both the "..." button
    // (default options route) and arc menu workspace selections (lyrics,
    // automix, plugin settings, etc.). Mirrors FullCardPlayer architecture.
    const handleCloseController = useCallback(() => {
        setControllerOpen(false)
        setControllerRoute("options")
    }, [])

    const handleOpenFocusedController = useCallback((route: WorkspaceRoute) => {
        setControllerRoute(route)
        setControllerOpen(true)
    }, [])

    const handleOpenOptions = useCallback(() => {
        setControllerRoute("options")
        setControllerOpen(true)
    }, [])

    // Keyboard shortcuts scoped to the player root (not window) so they never
    // fight focused controls or other parts of the host app. Space/Enter on an
    // actual button is left to the button, preventing double-triggering.
    const handleRootKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (hasKeyboardShortcutPlugin) return
            const target = event.target as HTMLElement
            const onInteractive = !!target.closest(
                "button, a, input, [role='slider']"
            )
            const key = event.key.toLowerCase()

            if ((event.key === " " || key === "k") && !onInteractive) {
                event.preventDefault()
                s.toggle()
            } else if (key === "j") {
                event.preventDefault()
                s.seekBy(-10)
            } else if (key === "l") {
                event.preventDefault()
                s.seekBy(10)
            } else if (key === "n" && isPlaylistMode) {
                event.preventDefault()
                s.next()
            } else if (key === "p" && isPlaylistMode) {
                event.preventDefault()
                s.previous()
            }
        },
        [hasKeyboardShortcutPlugin, isPlaylistMode, s]
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

    // ── Media Session API (progressive enhancement) ──
    // Artwork priority: track-level artwork > backgroundMedia > backgroundImage.
    // Album info comes from the track when available. Each candidate may be a
    // plain URL or a CSS value (a `url("…")` wrapper, or a gradient): unwrap the
    // former and reject the latter so a non-image background never produces a
    // malformed Media Session artwork entry (which iOS would fail to render).
    const artworkSrc = useMemo(() => {
        const candidates = [
            currentTrack.artwork,
            backgroundMedia?.src,
            backgroundImage?.src,
        ]
        for (const value of candidates) {
            const resolved = resolveArtworkSrc(value)
            if (resolved) return resolved
        }
        return undefined
    }, [currentTrack.artwork, backgroundMedia?.src, backgroundImage?.src])
    const artwork = useMemo(
        () => (artworkSrc ? buildMediaSessionArtwork(artworkSrc) : []),
        [artworkSrc],
    )
    useMediaSessionObserver(s, {
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.albumTitle ?? "",
        artwork,
        onNext: canNextTrack ? s.next : undefined,
        onPrevious: canPreviousTrack ? s.previous : undefined,
        sourceKey,
    })

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
        "--ap-glow": glowColor,
        "--ap-glow-intensity": glowIntensity / 100,
        "--ap-btn-opacity-delta": `${buttonOpacity}%`,
        "--ap-blur": `${blurSize}px`,
    } as CSSProperties

    // Memoized data for the virtualized tracklist so React.memo on TrackRow
    // can shallow-compare a stable reference instead of a fresh inline object
    // every render.
    const trackListData = useMemo(
        () => ({ queue, currentIndex, onPlay: s.playTrack, isPlaying }),
        [queue, currentIndex, s.playTrack, isPlaying]
    )

    return (
        <VisualSlotsProvider>
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
            {/* Queue drawer (Up Next) */}
            {isPlaylistMode && (
                <QueueDrawer
                    queue={queue}
                    currentIndex={currentIndex}
                    isPlaying={isPlaying}
                    open={queueOpen}
                    onClose={() => setQueueOpen(false)}
                    onPlayTrack={handleQueuePlayTrack}
                    onReorder={s.moveQueueItem}
                    onRemove={s.removeFromQueue}
                />
            )}

            {/* Shared SAP Controller: single instance serves both the "..." button
                (default options route) and arc menu workspace selections (lyrics,
                automix, plugin settings, etc.). Mirrors FullCardPlayer architecture. */}
            <SAPController
                open={controllerOpen}
                onClose={handleCloseController}
                route={controllerRoute}
                playback={{
                    shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    ...(isPlaylistMode
                        ? {
                              automix,
                              onToggleAutomix: s.toggleAutomix,
                          }
                        : {}),
                    autoPlay: localAutoPlay,
                    onToggleAutoPlay: handleAutoPlayToggle,
                }}
                queue={
                    isPlaylistMode
                        ? {
                              count: queue.length,
                              onOpenQueue: () => setQueueOpen(true),
                          }
                        : undefined
                }
                info={{
                    title: currentTrack.title ?? "",
                    artist: currentTrack.artist ?? "",
                    duration,
                    lyrics: currentTrack.lyrics,
                }}
                share={{ onShare: handleShareClick, copied: shareCopied }}
                pluginNames={externalPlugins.map((plugin) => plugin.name)}
                waveform={
                    hasWaveformPlugin
                        ? {
                              enabled: waveformEnabled,
                              onToggle: () => setWaveformEnabled((v) => !v),
                          }
                        : undefined
                }
                accentColor={accentColor}
                playIconColor={playIconColor}
                textColor={textColor}
                progressColor={progressColor}
                trackColor={trackColor}
                backgroundColor={backgroundColor}
            />

            {/* SR live region */}
            <div className="ap-sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>

            <BackgroundMedia
                {...resolveMedia({ media: backgroundMedia, legacyImage: backgroundImage })}
                darkenAmount={darkenAmount}
            />

            <div className="ap-content">
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
                                s.dismissAutoplayBlocked()
                                s.toggle()
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
                        <button type="button" className="ap-retry-btn" onClick={s.retry}>
                            Retry
                        </button>
                    </div>
                )}

                <div className="ap-top-actions">
                    <div className="ap-menu">
                        <button
                            type="button"
                            className="ap-icon-btn ap-tap ap-menu__btn"
                            onClick={handleOpenOptions}
                            aria-label="Player options"
                            aria-haspopup="dialog"
                            aria-expanded={controllerOpen}
                        >
                            <DotsIcon />
                        </button>
                    </div>
                </div>

                {isPlaylistMode && (
                    <div className="ap-track-counter">
                        Track {currentIndex + 1} of {queue.length}
                        {shuffle ? " · Shuffle" : ""}
                        {repeatMode !== "off" ? ` · Repeat ${repeatMode}` : ""}
                        {automix ? " · Automix" : ""}
                    </div>
                )}

                <div className="ap-track-info" role="group" aria-label="Track information">
                    <div
                        className="ap-track-info__title"
                        style={titleFont}
                        title={formatVersionedTitle(
                            currentTrack.title,
                            currentTrack.versionLabel
                        )}
                    >
                        {formatVersionedTitle(
                            currentTrack.title,
                            currentTrack.versionLabel
                        )}
                        {currentTrack.explicit && <ExplicitBadge />}
                    </div>
                    <div
                        className="ap-track-info__artist"
                        style={artistFont}
                        title={formatSecondaryLine(currentTrack)}
                    >
                        {formatSecondaryLine(currentTrack)}
                    </div>
                </div>

                <div className="ap-progress-group" role="group" aria-label="Playback progress">
                    {/* ScrubberCanvasHost + WaveformAdapter (Phase 4): the same
                        unified scrubber the session faces use. `waveform` is
                        resolved by `effectiveWaveform` — the Waveform plugin's
                        toggle or an explicit `showWaveform` prop, defaulting to
                        the basic progress bar. */}
                    <ScrubberCanvasHost
                        face="portable"
                        density={getScrubberDensity("portable")}
                        currentTime={currentTime}
                        duration={duration}
                        progress={duration > 0 ? currentTime / duration : 0}
                        onSeek={s.seek}
                    >
                        <ScrubberCanvasRenderer
                            currentTime={currentTime}
                            duration={duration}
                            onSeek={s.seek}
                        >
                        <WaveformAdapter
                            face="portable"
                            density={getScrubberDensity("portable")}
                            waveform={effectiveWaveform}
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            disabled={!hasAudio}
                            isSeeking={isSeeking}
                            onSeek={s.seek}
                            onSeekStart={() => s.setSeeking(true)}
                            onSeekEnd={() => s.setSeeking(false)}
                            peaks={currentTrack.peaks}
                            peaksDuration={currentTrack.waveformDuration}
                            getDecodedData={s.getDecodedData}
                            // Only the streaming backend needs the second
                            // fetch+decode; webaudio supplies decoded PCM.
                            url={
                                s.getBackendInfo().active === "html5"
                                    ? currentSrc
                                    : undefined
                            }
                            sourceKey={sourceKey}
                            height={waveformHeight}
                            waveColor={trackColor}
                            progressColor={progressColor}
                            cursorColor={accentColor}
                        />
                        </ScrubberCanvasRenderer>
                    </ScrubberCanvasHost>
                    <div className="ap-times" aria-hidden="true">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="ap-transport" role="group" aria-label="Playback controls">
                    <HoldSkipButton
                        direction="previous"
                        className="ap-btn ap-btn--ghost ap-tap"
                        disabled={!hasAudio}
                        skipDisabled={!isPlaylistMode || !canPreviousTrack}
                        seekLabel="Skip backward 10 seconds"
                        skipLabel="Previous track"
                        onSeek={() => s.seekBy(-10)}
                        onSkip={s.previous}
                    >
                        <PrevIcon />
                    </HoldSkipButton>

                    <button
                        type="button"
                        className={`ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                        onClick={s.toggle}
                        disabled={!hasAudio}
                        aria-label={
                            !hasAudio
                                ? "Audio file missing"
                                : showPlaySpinner
                                  ? "Buffering audio"
                                  : isPlaying
                                    ? "Pause"
                                    : "Play"
                        }
                    >
                        {showPlaySpinner ? (
                            <SpinnerIcon />
                        ) : isPlaying ? (
                            <PauseIcon />
                        ) : (
                            <PlayIcon />
                        )}
                    </button>

                    <HoldSkipButton
                        direction="next"
                        className="ap-btn ap-btn--ghost ap-tap"
                        disabled={!hasAudio}
                        skipDisabled={!isPlaylistMode || !canNextTrack}
                        seekLabel="Skip forward 10 seconds"
                        skipLabel="Next track"
                        onSeek={() => s.seekBy(10)}
                        onSkip={s.next}
                    >
                        <NextIcon />
                    </HoldSkipButton>
                </div>

                {showVolume && (
                    <VolumeControl
                        volume={volume}
                        isMuted={isMuted}
                        disabled={!hasAudio}
                        volumeUnsupported={volumeUnsupported}
                        onVolumeChange={s.setVolume}
                        onToggleMute={s.toggleMute}
                    />
                )}

                {/* SEI Canvas visual surface region — hidden by default, opened via the
                    left surface button (canvas toggle) or right (Up Next queue in-region).
                    Mirrors the FullCardPlayer SEICanvasHost pattern. */}
                <SEICanvasHost
                    open={surface.isCanvasOpen || surface.isQueueOpen}
                    face="portable"
                    supported={surface.canvasSupported}
                    activeSurfaceId={surface.mode === "default" ? undefined : surface.mode}
                >
                    {surface.isQueueOpen ? (
                        <QueueSurface />
                    ) : (
                        <SEICanvasRenderer
                            currentTime={currentTime}
                            duration={duration}
                            lyrics={currentTrack?.lyrics}
                        />
                    )}
                </SEICanvasHost>

                {/* Surface buttons: left = canvas toggle, right = arc action menu
                    (SEICanvasActionMenu). Gate on contextual support — the
                    capability model drives this, matching FullCardPlayer. */}
                <PlayerSurfaceButtons
                    surface={surface}
                    onOpenQueue={() => setQueueOpen(true)}
                    onOpenFocusedController={handleOpenFocusedController}
                />

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

                {isPlaylistMode && showTracklist && (
                    <div
                        className="ap-tracklist ap-anim-in"
                        role="list"
                        aria-label="Playlist tracks"
                        style={{ overflowY: "hidden" }}
                    >
                        <FixedSizeList
                            height={Math.min(276, queue.length * 52)}
                            itemCount={queue.length}
                            itemSize={52}
                            width="100%"
                            itemData={trackListData}
                        >
                            {TrackRow}
                        </FixedSizeList>
                    </div>
                )}
            </div>
        </div>
        </VisualSlotsProvider>
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
