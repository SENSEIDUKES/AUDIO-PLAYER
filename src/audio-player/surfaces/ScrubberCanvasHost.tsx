import { useState } from "react"
import type { ReactNode } from "react"
import { ProgressBar } from "../components/ProgressBar"
import type { PlayerFace, ScrubberDensity } from "./faceCapabilities"

export interface ScrubberCanvasHostProps {
    face: PlayerFace
    density: ScrubberDensity
    currentTime: number
    duration: number
    /** 0..1, precomputed by the caller (kept for plugin/aria use). */
    progress: number
    onSeek: (time: number) => void
    activeSurfaceId?: string
    /**
     * Future plugin scrubber content. When provided it replaces the fallback;
     * when absent the default progress bar renders (NO waveform in Phase 1).
     * Faces with a bespoke ProgressBar (e.g. FullCard) pass it here so seek
     * behavior stays byte-identical to before the retrofit.
     */
    children?: ReactNode
}

/**
 * The timeline render zone (ScrubberCanvas). Available on every face; density
 * adapts the layout. It owns only chrome/layout — seeking flows straight through
 * `onSeek`. The default fallback is the existing ProgressBar.
 *
 * The stable `[data-scrubber-host]` container is the future plugin mount point.
 */
export function ScrubberCanvasHost({
    face,
    density,
    currentTime,
    duration,
    progress,
    onSeek,
    activeSurfaceId,
    children,
}: ScrubberCanvasHostProps) {
    return (
        <div
            className="ap-scrubber-host"
            data-scrubber-host=""
            data-density={density}
            data-face={face}
            data-surface-id={activeSurfaceId}
            // Plain data hook for future plugins/styling. The real progressbar
            // ARIA lives on the child ProgressBar; `aria-valuenow` would be
            // invalid here without a slider/progressbar role.
            data-progress={Math.round(progress * 100)}
        >
            {children ?? (
                <FallbackScrubber
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={onSeek}
                />
            )}
        </div>
    )
}

/**
 * Internal default used when a face has no bespoke scrubber to pass in (e.g. the
 * mini sidebar, which had no progress bar before). Manages its own seeking state
 * so the mission's host prop signature stays minimal.
 */
function FallbackScrubber({
    currentTime,
    duration,
    onSeek,
}: {
    currentTime: number
    duration: number
    onSeek: (time: number) => void
}) {
    const [isSeeking, setIsSeeking] = useState(false)
    return (
        <ProgressBar
            currentTime={currentTime}
            duration={duration}
            buffered={0}
            disabled={duration <= 0}
            isSeeking={isSeeking}
            onSeek={onSeek}
            onSeekStart={() => setIsSeeking(true)}
            onSeekEnd={() => setIsSeeking(false)}
        />
    )
}

export default ScrubberCanvasHost
