import { useState, useCallback } from "react"
import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { QueueDrawer } from "../components/QueueDrawer"
import { ProgressBar } from "../components/ProgressBar"
import { VolumeControl } from "../components/VolumeControl"
import { SAPController } from "../components/SAPController"
import { useShareTrack } from "../components/useShareTrack"
import { formatTime } from "../utils/formatTime"
import { buildThemeVars } from "./themeVars"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { PlayerHero } from "../surfaces/PlayerHero"
import { SEICanvasHost } from "../surfaces/SEICanvasHost"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { PlayerSurfaceButtons } from "../surfaces/PlayerSurfaceButtons"
import { QueueSurface } from "../surfaces/QueueSurface"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
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
    /** Show the volume slider. Defaults to true. */
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
 */
export function FullCardPlayer({
    showVolume = true,
    className,
    style,
    ...theme
}: FullCardPlayerProps) {
    const s = useAudioSession()
    const surface = usePlayerSurface("fullCard")
    const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)
    const [controllerOpen, setControllerOpen] = useState(false)
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

    return (
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

            {/* SAP Controller: shuffle/repeat/automix, queue, info, share. */}
            <SAPController
                open={controllerOpen}
                onClose={() => setControllerOpen(false)}
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
                    onClick={() => setControllerOpen(true)}
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
                        <div className="ap-sei-canvas-placeholder">
                            <span className="ap-sei-canvas-placeholder__title">
                                SEI Canvas
                            </span>
                            <span className="ap-sei-canvas-placeholder__hint">
                                Placeholder visual area — plugins mount here later.
                            </span>
                        </div>
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
                    <div className="ap-progress-group" role="group" aria-label="Playback progress">
                        <ProgressBar
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            disabled={!hasAudio}
                            isSeeking={isSeeking}
                            onSeek={s.seek}
                            onSeekStart={() => s.setSeeking(true)}
                            onSeekEnd={() => s.setSeeking(false)}
                        />
                        <div className="ap-times" aria-hidden="true">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
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

                <PlayerSurfaceButtons surface={surface} />
            </div>
        </div>
    )
}

export default FullCardPlayer
