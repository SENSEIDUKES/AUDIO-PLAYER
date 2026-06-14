import type { CSSProperties } from "react"
import type { AudioPlayerTheme, Track } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ProgressBar } from "../components/ProgressBar"
import { formatTime } from "../utils/formatTime"
import { trackKey } from "../utils/trackKey"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import "./skins.css"

export interface VaultRowPlayerProps extends AudioPlayerTheme {
    /** The track this row represents. */
    track: Track
    /** Optional 1-based number shown at the left of the row. */
    number?: number
    className?: string
    style?: CSSProperties
}

/** Identify a track within the queue the same way the session's playNow does. */
function sameTrack(a: Track, b: Track): boolean {
    return trackKey(a) === trackKey(b)
}

/**
 * A slim Vault list row. Each row controls the shared session: pressing play
 * starts this track in the one global engine (jumping if it's already queued,
 * else appending). When this row is the active track it shows live progress and
 * its play button mirrors the global play state — so it stays in sync with every
 * other skin.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.vaultRow`): the most compact face.
 * `supportsSEICanvas: false` and `supportsContextualActions: false` — a list row
 * has no room for canvas or menu surfaces, so it renders neither the SEICanvas
 * host nor `PlayerSurfaceButtons`. Deep actions belong to whatever container
 * hosts the row list. Phase 3 wires the active row's scrubber through
 * `ScrubberCanvasHost` (compact density); seeking is unchanged.
 */
export function VaultRowPlayer({
    track,
    number,
    className,
    style,
    ...theme
}: VaultRowPlayerProps) {
    const s = useAudioSession()
    const isActive = s.currentTrack ? sameTrack(s.currentTrack, track) : false
    const isPlayingThis = isActive && s.isPlaying
    // Engine gates `isBuffering` to active/pending playback; scope it to this
    // row so only the active track's button can spin.
    const isBufferingThis = isActive && s.isBuffering

    const handleToggle = () => {
        if (isActive) s.toggle()
        else s.playNow(track)
    }

    return (
        <div
            className={`ap-vr${isActive ? " ap-vr--active" : ""}${className ? ` ${className}` : ""}`}
            style={{ ...buildThemeVars(theme), ...style }}
            aria-current={isActive ? "true" : undefined}
        >
            {number !== undefined && <span className="ap-vr__num">{number}</span>}
            <button
                type="button"
                className="ap-btn ap-btn--play ap-vr__play ap-tap"
                onClick={handleToggle}
                aria-label={
                    isBufferingThis
                        ? "Buffering audio"
                        : isPlayingThis
                          ? `Pause ${track.title}`
                          : `Play ${track.title}`
                }
            >
                {isBufferingThis ? <SpinnerIcon /> : isPlayingThis ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="ap-vr__meta">
                <span className="ap-vr__title" title={track.title}>
                    {track.title}
                </span>
                {isActive ? (
                    <span className="ap-vr__progress">
                        {/* ScrubberCanvasHost (Phase 3): compact timeline zone for
                            the active row; ProgressBar passed through as children
                            keeps seeking identical. */}
                        <ScrubberCanvasHost
                            face="vaultRow"
                            density={getScrubberDensity("vaultRow")}
                            currentTime={s.currentTime}
                            duration={s.duration}
                            progress={s.duration > 0 ? s.currentTime / s.duration : 0}
                            onSeek={s.seek}
                        >
                            <ProgressBar
                                currentTime={s.currentTime}
                                duration={s.duration}
                                buffered={s.buffered}
                                disabled={!s.hasAudio}
                                isSeeking={s.isSeeking}
                                onSeek={s.seek}
                                onSeekStart={() => s.setSeeking(true)}
                                onSeekEnd={() => s.setSeeking(false)}
                            />
                        </ScrubberCanvasHost>
                    </span>
                ) : (
                    <span className="ap-vr__artist" title={track.artist}>
                        {track.artist}
                    </span>
                )}
            </div>
            {isActive && (
                <span className="ap-vr__time" aria-hidden="true">
                    {formatTime(s.currentTime)}
                </span>
            )}
            {isPlayingThis && (
                <span className="ap-eq" aria-hidden="true">
                    <i /><i /><i />
                </span>
            )}
        </div>
    )
}

export default VaultRowPlayer
