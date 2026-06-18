import { useState, useCallback } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { QueueDrawer } from "../components/QueueDrawer"
import { WaveformAdapter } from "../components/WaveformAdapter"
import { VolumeControl } from "../components/VolumeControl"
import { SAPController } from "../components/SAPController"
import { useShareTrack } from "../components/useShareTrack"
import { formatTime } from "../utils/formatTime"
import { defaultShowVolume } from "../utils/device"
import { trackKey } from "../utils/trackKey"
import { trackSourcesSignature } from "../utils/sources"
import { useMediaSessionObserver } from "../headless/useMediaSessionObserver"
import { buildThemeVars } from "./themeVars"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { PlayerHero } from "../surfaces/PlayerHero"
import { SEICanvasHost } from "../surfaces/SEICanvasHost"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { PlayerSurfaceButtons } from "../surfaces/PlayerSurfaceButtons"
import { QueueSurface } from "../surfaces/QueueSurface"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
import { VisualSlotsProvider } from "../visual-slots/VisualSlotsContext"
import { SEICanvasRenderer } from "../visual-slots/SEICanvasRenderer"
import { ScrubberCanvasRenderer } from "../visual-slots/ScrubberCanvasRenderer"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import {
    Back10Icon,
    DotsIcon,
    ErrorIcon,
    Fwd10Icon,
    NextIcon,
    PauseIcon,
    PlayIcon,
    PrevIcon,
    SpinnerIcon,
} from "./icons"
import "./skins.css"

export interface FullCardPlayerProps extends AudioPlayerTheme {
    /**
     * Show the volume slider. Defaults to `true` on desktop and `false` on
     * mobile/touch devices (e.g. iOS Safari), where programmatic volume is
     * ignored and the mute button is the reliable control. Pass an explicit
     * boolean to override the per-device default.
     */
    showVolume?: boolean
    className?: string
    style?: CSSProperties
}

/**
 * The rich "now playing" card, driven by the global session. Keeps the core
 * transport visible (prev / back 10 / play / fwd 10 / next); shuffle, repeat,
 * automix, queue, info, and share live in the SAP Controller behind the "…"
 * button. This skin is the designated owner of the autoplay-blocked prompt so
 * users don't see five simultaneous prompts.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.fullCard`): the fully-wired face.
 * It hosts the SEICanvas (`supportsSEICanvas`), the ScrubberCanvas
 * (`supportsScrubberCanvas`), and the contextual radial menu
 * (`supportsContextualActions`, rendered via `PlayerSurfaceButtons`) — none of
 * these are hard-coded here; each render zone follows the model. The SAP
 * three-dot controller is always present for deep actions independent of those
 * capabilities.
 */
export function FullCardPlayer({
    showVolume = defaultShowVolume(),
    className,
    style,
    ...theme
}: FullCardPlayerProps) {
    const s = useAudioSession()
    const surface = usePlayerSurface("fullCard")
    const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)
    const [controllerOpen, setControllerOpen] = useState(false)
    const [controllerRoute, setControllerRoute] = useState<WorkspaceRoute>("options")
    const {
        currentTrack,
        currentIndex,
        queue,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        buffered,
        isSeeking,
        volume,
        isMuted,
        volumeUnsupported,
        hasAudio,
        hasError,
        errorMessage,
        autoplayBlocked,
        shuffle,
        repeatMode,
        automix,
        canNext,
        canPrevious,
    } = s

    const themeVars = buildThemeVars(theme)
    const isEmpty = queue.length === 0
    // Engine gates `isBuffering` to active/pending playback (and clears it on
    // pause/ended), so the spinner can render straight from it.
    const showPlaySpinner = isBuffering

    // Lock-screen / OS media controls. FullCardPlayer is the designated session
    // owner of the autoplay prompt, so it also owns the Media Session wiring to
    // avoid multiple session-based skins registering competing handlers.
    useMediaSessionObserver(s, {
        title: currentTrack?.title ?? "",
        artist: currentTrack?.artist ?? "",
        sourceKey: currentTrack
            ? `${currentIndex}:${trackKey(currentTrack)}:${trackSourcesSignature(currentTrack)}`
            : "empty",
        onNext: canNext ? s.next : undefined,
        onPrevious: canPrevious ? s.previous : undefined,
    })

    const handleOpenQueue = useCallback(() => setQueueDrawerOpen(true), [])
    const handleCloseQueue = useCallback(() => setQueueDrawerOpen(false), [])

    const { share, copied: shareCopied, nativeShare } = useShareTrack(
        currentTrack?.title ?? "",
        currentTrack?.artist ?? ""
    )
    const handleShareClick = useCallback(() => {
        if (nativeShare) setControllerOpen(false)
        share()
    }, [nativeShare, share])

    // Open the shared SAP Controller with a focused workspace route from the
    // arc menu. The same instance serves both the "..." button and arc workspace
    // selections; closing it resets the route back to "options".
    const handleOpenFocusedController = useCallback((route: WorkspaceRoute) => {
        setControllerRoute(route)
        setControllerOpen(true)
    }, [])

    const handleCloseController = useCallback(() => {
        setControllerOpen(false)
        setControllerRoute("options")
    }, [])

    // When the "..." button opens the controller, ensure we're on the default
    // options route so the user always sees the standard options first.
    const handleOpenOptions = useCallback(() => {
        setControllerRoute("options")
        setControllerOpen(true)
    }, [])

    return (
        <VisualSlotsProvider>
        <div
            className={`ap-fc${className ? ` ${className}` : ""}`}
            style={{ ...themeVars, ...style }}
            role="region"
            aria-label="Now playing"
        >
            {/* Queue drawer (Up Next) — reads session queue directly */}
            <QueueDrawer
                queue={queue}
                currentIndex={currentIndex}
                isPlaying={isPlaying}
                open={queueDrawerOpen}
                onClose={handleCloseQueue}
                onPlayTrack={s.playTrack}
                onReorder={s.moveQueueItem}
                onRemove={s.removeFromQueue}
            />

            {/* Shared SAP Controller: owns the single instance for both "..." and
                arc workspace routes. Route determines whether a focused workspace
                panel renders above the default options. */}
            <SAPController
                open={controllerOpen}
                onClose={handleCloseController}
                route={controllerRoute}
                playback={{
                    shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                queue={
                    isEmpty
                        ? undefined
                        : { count: queue.length, onOpenQueue: handleOpenQueue }
                }
                info={
                    currentTrack
                        ? {
                              title: currentTrack.title ?? "",
                              artist: currentTrack.artist ?? "",
                              duration,
                              lyrics: currentTrack.lyrics,
                          }
                        : undefined
                }
                share={
                    currentTrack
                        ? { onShare: handleShareClick, copied: shareCopied }
                        : undefined
                }
                {...theme}
            />

            <div className="ap-fc__menu">
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

            {isEmpty && (
                <div className="ap-banner ap-banner--info ap-anim-in" role="status">
                    <ErrorIcon />
                    <span>Queue is empty</span>
                </div>
            )}

            {autoplayBlocked && hasAudio && !hasError && (
                <div className="ap-banner ap-banner--info ap-banner--col ap-anim-in" role="status">
                    <div className="ap-banner__row">
                        <ErrorIcon />
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

            {!isEmpty && (
                <div className="ap-fc__counter">
                    Track {currentIndex + 1} of {queue.length}
                    {shuffle ? " · Shuffle" : ""}
                    {repeatMode !== "off" ? ` · Repeat ${repeatMode}` : ""}
                    {automix ? " · Automix" : ""}
                </div>
            )}

            <div
                className="ap-fc__stage"
                data-surface-open={surface.mode !== "default"}
            >
                <PlayerHero
                    face="fullCard"
                    collapsed={surface.isHeroCollapsed}
                    title={currentTrack?.title ?? "Nothing playing"}
                    artist={currentTrack?.artist ?? "—"}
                    album={currentTrack?.albumTitle}
                    featuredArtists={currentTrack?.featuredArtists}
                    versionLabel={currentTrack?.versionLabel}
                    explicit={currentTrack?.explicit}
                    releaseTitle={currentTrack?.releaseTitle}
                    subtitle={currentTrack?.subtitle}
                    marquee
                />

                {/* Main visual surface region. Hidden by default; the left surface
                    button opens placeholder canvas content, the right opens the
                    in-region "Up Next" queue. */}
                <SEICanvasHost
                    open={surface.isCanvasOpen || surface.isQueueOpen}
                    face="fullCard"
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
            </div>

            <div className="ap-fc__control-dock">
                <ScrubberCanvasHost
                    face="fullCard"
                    density={getScrubberDensity("fullCard")}
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
                    <div className="ap-progress-group" role="group" aria-label="Playback progress">
                        {/* WaveformAdapter (Phase 4): renders the interactive
                            waveform when the track has peaks, else the progress
                            bar. fullCard opts into waveform via its capability. */}
                        <WaveformAdapter
                            face="fullCard"
                            density={getScrubberDensity("fullCard")}
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            disabled={!hasAudio}
                            isSeeking={isSeeking}
                            onSeek={s.seek}
                            onSeekStart={() => s.setSeeking(true)}
                            onSeekEnd={() => s.setSeeking(false)}
                            peaks={currentTrack?.peaks}
                            peaksDuration={currentTrack?.waveformDuration}
                            getDecodedData={s.getDecodedData}
                            // Fetch+decode fallback (html5 only) so tracks without
                            // precomputed peaks can still draw a waveform; webaudio
                            // supplies decoded PCM. wavesurfer stays visual-only —
                            // the engine remains the sole playback owner.
                            url={
                                s.getBackendInfo().active === "html5"
                                    ? s.currentSrc
                                    : undefined
                            }
                            sourceKey={currentTrack ? trackKey(currentTrack) : undefined}
                        />
                        <div className="ap-times" aria-hidden="true">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
                    </ScrubberCanvasRenderer>
                </ScrubberCanvasHost>

                <div className="ap-transport" role="group" aria-label="Playback controls">
                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                        onClick={s.previous}
                        disabled={!canPrevious}
                        aria-label="Previous track"
                    >
                        <PrevIcon />
                    </button>
                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-tap"
                        onClick={() => s.seekBy(-10)}
                        disabled={!hasAudio}
                        aria-label="Skip backward 10 seconds"
                    >
                        <Back10Icon />
                    </button>
                    <button
                        type="button"
                        className={`ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                        onClick={s.toggle}
                        disabled={!hasAudio}
                        aria-label={showPlaySpinner ? "Buffering audio" : isPlaying ? "Pause" : "Play"}
                    >
                        {showPlaySpinner ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-tap"
                        onClick={() => s.seekBy(10)}
                        disabled={!hasAudio}
                        aria-label="Skip forward 10 seconds"
                    >
                        <Fwd10Icon />
                    </button>
                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                        onClick={s.next}
                        disabled={!canNext}
                        aria-label="Next track"
                    >
                        <NextIcon />
                    </button>
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

                <PlayerSurfaceButtons
                    surface={surface}
                    onOpenQueue={handleOpenQueue}
                    onOpenFocusedController={handleOpenFocusedController}
                />
            </div>
        </div>
        </VisualSlotsProvider>
    )
}

export default FullCardPlayer