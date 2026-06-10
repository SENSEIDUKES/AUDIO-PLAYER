import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ProgressBar } from "../components/ProgressBar"
import { VolumeControl } from "../components/VolumeControl"
import { formatTime } from "../utils/formatTime"
import { buildThemeVars } from "./themeVars"
import {
    AutomixIcon,
    ErrorIcon,
    NextIcon,
    PauseIcon,
    PlayIcon,
    PrevIcon,
    RepeatIcon,
    RepeatOneIcon,
    ShuffleIcon,
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
 * The rich "now playing" card, driven by the global session. Mirrors the body
 * of the standalone AudioPlayer (track info, transport, progress, volume) but
 * reads and controls the shared engine. This skin is the designated owner of
 * the autoplay-blocked prompt so users don't see five simultaneous prompts.
 */
export function FullCardPlayer({
    showVolume = true,
    className,
    style,
    ...theme
}: FullCardPlayerProps) {
    const s = useAudioSession()
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

    return (
        <div
            className={`ap-fc${className ? ` ${className}` : ""}`}
            style={{ ...themeVars, ...style }}
            role="region"
            aria-label="Now playing"
        >
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
                    {automix ? " · Automix" : ""}
                </div>
            )}

            <div className="ap-fc__info" role="group" aria-label="Track information">
                <div className="ap-fc__title" title={currentTrack?.title}>
                    {currentTrack?.title ?? "Nothing playing"}
                </div>
                <div className="ap-fc__artist" title={currentTrack?.artist}>
                    {currentTrack?.artist ?? "—"}
                </div>
            </div>

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

            <div className="ap-transport" role="group" aria-label="Playback controls">
                <button
                    type="button"
                    className={`ap-icon-btn ap-tap${shuffle ? " ap-fc__toggle--on" : ""}`}
                    onClick={s.toggleShuffle}
                    aria-label="Shuffle"
                    aria-pressed={shuffle}
                >
                    <ShuffleIcon />
                </button>
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
                    className={`ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                    onClick={s.toggle}
                    disabled={!hasAudio}
                    aria-label={isBuffering ? "Buffering audio" : isPlaying ? "Pause" : "Play"}
                >
                    {isBuffering ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
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
                <button
                    type="button"
                    className={`ap-icon-btn ap-tap${repeatMode !== "off" ? " ap-fc__toggle--on" : ""}`}
                    onClick={s.cycleRepeat}
                    aria-label={`Repeat: ${repeatMode}`}
                >
                    {repeatMode === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
                </button>
                <button
                    type="button"
                    className={`ap-icon-btn ap-tap${automix ? " ap-fc__toggle--on" : ""}`}
                    onClick={s.toggleAutomix}
                    aria-label="Automix Lite"
                    aria-pressed={automix}
                >
                    <AutomixIcon />
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
        </div>
    )
}

export default FullCardPlayer
