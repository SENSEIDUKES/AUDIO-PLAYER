import type { CSSProperties } from "react"
import type { AudioPlayerTheme, Track } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { ProgressBar } from "../components/ProgressBar"
import { WaveformAdapter } from "../components/WaveformAdapter"
import { trackKey } from "../utils/trackKey"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { SEICanvasHost } from "../surfaces/SEICanvasHost"
import { PlayerHero } from "../surfaces/PlayerHero"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon, WaveIcon } from "./icons"
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
 * the card are about previewing/playing the track, not deep actions. The inline
 * scrubber stays a plain progress bar; Phase 4 adds a small wave trigger on the
 * active card that opens the overlay `SEICanvasHost`, which shows the hero +
 * the interactive `WaveformAdapter` (`supportsWaveform: true`). No radial menu is
 * added — the card stays clean and tap-to-play.
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
    // Only promise a waveform overlay when we actually have peak data to draw;
    // otherwise the overlay would just show another progress bar (a confusing
    // duplicate of the inline scrubber).
    const hasPeaks = (track.peaks?.length ?? 0) > 0 && (track.peaks?.[0]?.length ?? 0) > 0
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
            {/* No aria-hidden here: the container holds focusable controls (play +
                wave trigger), which must stay in the accessibility tree. The art
                itself is a decorative empty div with no accessible name. */}
            <div className="ap-sea__art" style={{ backgroundImage: art }}>
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
                {/* Overlay trigger (Phase 4): only on the active card, since the
                    overlay shows the playing track's waveform with live seek. A
                    small, unobtrusive button — NOT the full radial menu, keeping
                    the card clean and tap-to-play. */}
                {isActive && hasPeaks && (
                    <button
                        type="button"
                        className="ap-icon-btn ap-tap ap-sea__wave-btn"
                        onClick={surface.toggleCanvas}
                        aria-label={surface.isCanvasOpen ? "Hide waveform" : "Show waveform"}
                        aria-expanded={surface.isCanvasOpen}
                    >
                        <WaveIcon />
                    </button>
                )}
            </div>
            <div className="ap-sea__body">
                <div className="ap-sea__title" title={track.title}>{track.title}</div>
                <div className="ap-sea__artist" title={track.artist}>{track.artist}</div>
                {/* Hide the inline scrubber while the waveform overlay is open so
                    the card never shows two scrubbers at once. */}
                {isActive && !surface.isCanvasOpen && (
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

            {/* SEICanvasHost overlay (Phase 4): the active card's waveform view,
                opened by the wave trigger above. Shows the hero identity + the
                full interactive WaveformAdapter (seaCard opts into waveform).

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
            >
                {/* Mount the waveform only while the overlay is open: wavesurfer
                    measures its container on create, and the host is collapsed
                    (0 height) when closed. */}
                {surface.isCanvasOpen && (
                    <div className="ap-sea__overlay">
                        <PlayerHero
                            face="seaCard"
                            collapsed={false}
                            title={track.title ?? ""}
                            artist={track.artist ?? ""}
                        />
                        <WaveformAdapter
                            face="seaCard"
                            density={getScrubberDensity("seaCard")}
                            currentTime={s.currentTime}
                            duration={s.duration}
                            buffered={s.buffered}
                            disabled={!s.hasAudio}
                            isSeeking={s.isSeeking}
                            onSeek={s.seek}
                            onSeekStart={() => s.setSeeking(true)}
                            onSeekEnd={() => s.setSeeking(false)}
                            peaks={track.peaks}
                            peaksDuration={track.waveformDuration}
                            getDecodedData={s.getDecodedData}
                            // The overlay is user-initiated, so the fetch+decode
                            // fallback (html5 only) is acceptable when a track has
                            // no precomputed peaks; webaudio supplies decoded PCM.
                            url={
                                s.getBackendInfo().active === "html5"
                                    ? track.audioFile
                                    : undefined
                            }
                            sourceKey={trackKey(track)}
                        />
                    </div>
                )}
            </SEICanvasHost>
        </article>
    )
}

export default SeaCardPlayer
