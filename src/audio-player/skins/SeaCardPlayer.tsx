import type { CSSProperties } from "react"
import type { AudioPlayerTheme, Track } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ProgressBar } from "../components/ProgressBar"
import { trackKey } from "../utils/trackKey"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { SEICanvasHost } from "../surfaces/SEICanvasHost"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import "./skins.css"

export interface SeaCardPlayerProps extends AudioPlayerTheme {
    /** The track this card represents and plays into the shared session. */
    track: Track
    /** CSS background image for the card art (gradient or url). Applied as
        background-image so the cover/center sizing rules hold. */
    art?: string
    /** Optional price / tag chip. */
    tag?: string
    className?: string
    style?: CSSProperties
}

/** Identify a track within the queue (matches the session's playNow logic). */
function sameTrack(a: Track, b: Track): boolean {
    return trackKey(a) === trackKey(b)
}

/**
 * An embeddable "SEA card" surface — a marketplace/album card with an overlaid
 * play button that plays its track in the global session. When its track is the
 * active one it shows live progress and a pause state, kept in sync with every
 * other skin through the shared engine.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.seaCard`): a marketplace card.
 * `supportsContextualActions: false`, so it renders no contextual menu — taps on
 * the card are about previewing/playing the track, not deep actions. Phase 3
 * wires its active-card scrubber through `ScrubberCanvasHost` and mounts the
 * declared overlay `SEICanvasHost` as a stable (collapsed) plugin target; the
 * canvas has no opener yet by design (no contextual menu / card = play).
 */
export function SeaCardPlayer({
    track,
    art = "linear-gradient(135deg,#FF7AC6,#7C5CFF)",
    tag,
    className,
    style,
    ...theme
}: SeaCardPlayerProps) {
    const s = useAudioSession()
    const surface = usePlayerSurface("seaCard")
    const isActive = s.currentTrack ? sameTrack(s.currentTrack, track) : false
    const isPlayingThis = isActive && s.isPlaying
    // Engine gates `isBuffering` to active/pending playback; scope it to this
    // card so only the active track's button can spin.
    const isBufferingThis = isActive && s.isBuffering

    const handleToggle = () => {
        if (isActive) s.toggle()
        else s.playNow(track)
    }

    return (
        <article
            className={`ap-sea${isActive ? " ap-sea--active" : ""}${className ? ` ${className}` : ""}`}
            style={{ ...buildThemeVars(theme), ...style }}
        >
            <div className="ap-sea__art" style={{ backgroundImage: art }} aria-hidden="true">
                <button
                    type="button"
                    className="ap-btn ap-btn--play ap-sea__play ap-tap"
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
                {tag && <span className="ap-sea__tag">{tag}</span>}
            </div>
            <div className="ap-sea__body">
                <div className="ap-sea__title" title={track.title}>{track.title}</div>
                <div className="ap-sea__artist" title={track.artist}>{track.artist}</div>
                {isActive && (
                    <div className="ap-sea__progress">
                        {/* ScrubberCanvasHost (Phase 3): timeline zone for the
                            active card; ProgressBar passed through as children so
                            seeking is identical. */}
                        <ScrubberCanvasHost
                            face="seaCard"
                            density={getScrubberDensity("seaCard")}
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
                    </div>
                )}
            </div>

            {/* SEICanvasHost (Phase 3): seaCard declares an overlay canvas, so we
                render the stable mount point here. It stays collapsed (no opener:
                the card itself is tap-to-play and this face has no contextual
                menu by design), serving as the plugin mount target until a future
                phase adds a card-level affordance to open it.

                Gated on `isActive`: many SeaCards render at once (a marketplace
                grid), but only the active card represents the playing track. The
                host early-returns on `!supported`, so exactly one live
                `[data-sei-canvas-host]` mount point exists — a plugin can never
                bind to an inactive card. */}
            <SEICanvasHost
                open={surface.isCanvasOpen}
                face="seaCard"
                supported={isActive && surface.canvasSupported}
                activeSurfaceId={surface.mode === "default" ? undefined : surface.mode}
            />
        </article>
    )
}

export default SeaCardPlayer
