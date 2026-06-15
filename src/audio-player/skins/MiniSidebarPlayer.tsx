import type { CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import { useAudioSession } from "../session/AudioSessionContext"
import { buildThemeVars } from "./themeVars"
import { NextIcon, PauseIcon, PlayIcon, SpinnerIcon } from "./icons"
import { usePlayerSurface } from "../surfaces/usePlayerSurface"
import { ScrubberCanvasHost } from "../surfaces/ScrubberCanvasHost"
import { WaveformAdapter } from "../components/WaveformAdapter"
import { PlayerSurfaceButtons } from "../surfaces/PlayerSurfaceButtons"
import { QueueSurface } from "../surfaces/QueueSurface"
import { getScrubberDensity } from "../surfaces/faceCapabilities"
import "./skins.css"

export interface MiniSidebarPlayerProps extends AudioPlayerTheme {
    /** Optional CSS background image for the small art block (gradient or url).
        Applied as background-image so the cover/center sizing rules hold. */
    art?: string
    className?: string
    style?: CSSProperties
}

/**
 * A condensed widget for a sidebar: small art, current track, play/pause + next.
 * Reads the shared session so it always shows what is globally playing.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.miniSidebar`): a compact face.
 * `supportsSEICanvas: false`, so the canvas zone and its left surface button are
 * auto-hidden. It keeps a compact ScrubberCanvas (`supportsScrubberCanvas`) and
 * the contextual radial menu (`supportsContextualActions`) — the latter is its
 * only path to "Up Next" / actions since it has no three-dot SAPController.
 * `PlayerSurfaceButtons` reads both flags from the model, so passing `surface`
 * alone yields the correct buttons without per-face overrides.
 */
export function MiniSidebarPlayer({
    art = "linear-gradient(135deg,#7C5CFF,#22D3A6)",
    className,
    style,
    ...theme
}: MiniSidebarPlayerProps) {
    const s = useAudioSession()
    const surface = usePlayerSurface("miniSidebar")
    const { currentTrack, isPlaying, isBuffering, hasAudio, currentTime, duration } = s
    const empty = !currentTrack

    return (
        <div
            className={`ap-ms-shell${className ? ` ${className}` : ""}`}
            style={{ ...buildThemeVars(theme), ...style }}
        >
            <div className="ap-ms" role="region" aria-label="Mini player">
                <div
                    className={`ap-ms__art${isPlaying ? " ap-ms__art--playing" : ""}`}
                    style={{ backgroundImage: art }}
                    aria-hidden="true"
                />
                <div className="ap-ms__meta">
                    <span className="ap-ms__title" title={currentTrack?.title}>
                        {currentTrack?.title ?? "Nothing playing"}
                    </span>
                    <span className="ap-ms__artist" title={currentTrack?.artist}>
                        {currentTrack?.artist ?? "—"}
                    </span>
                </div>
                <button
                    type="button"
                    className="ap-btn ap-btn--play ap-ms__play ap-tap"
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
                    disabled={empty || !s.canNext}
                    aria-label="Next track"
                >
                    <NextIcon />
                </button>
                {/* Canvas button auto-hidden (mini doesn't support SEICanvas). */}
                <PlayerSurfaceButtons surface={surface} />
            </div>

            <ScrubberCanvasHost
                face="miniSidebar"
                density={getScrubberDensity("miniSidebar")}
                currentTime={currentTime}
                duration={duration}
                progress={duration > 0 ? currentTime / duration : 0}
                onSeek={s.seek}
            >
                {/* Compact face: WaveformAdapter resolves to the plain ProgressBar
                    (supportsWaveform: false), now wired to the live session
                    buffered/seeking state instead of the host's bare fallback. */}
                <WaveformAdapter
                    face="miniSidebar"
                    density={getScrubberDensity("miniSidebar")}
                    currentTime={currentTime}
                    duration={duration}
                    buffered={s.buffered}
                    disabled={!s.hasAudio}
                    isSeeking={s.isSeeking}
                    onSeek={s.seek}
                    onSeekStart={() => s.setSeeking(true)}
                    onSeekEnd={() => s.setSeeking(false)}
                />
            </ScrubberCanvasHost>

            <div className="ap-ms__surface" data-open={surface.isQueueOpen ? "true" : "false"}>
                {surface.isQueueOpen && <QueueSurface maxItems={6} />}
            </div>
        </div>
    )
}

export default MiniSidebarPlayer