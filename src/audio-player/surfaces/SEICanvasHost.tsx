import type { ReactNode } from "react"
import type { PlayerFace } from "./faceCapabilities"

export interface SEICanvasHostProps {
    open: boolean
    face: PlayerFace
    /** Comes from the capability model (faceSupportsSEICanvas). */
    supported: boolean
    /** Which surface currently owns the region, e.g. "canvas" | "queue". */
    activeSurfaceId?: string
    children?: ReactNode
}

/**
 * The main visual surface region (SEICanvas). Phase 1 renders placeholder/demo
 * content only — no waveform, artwork, lyrics, or visualizers.
 *
 * - Returns `null` when the face doesn't support a canvas, so compact/mini faces
 *   never render this zone (capability-driven, not a layout check).
 * - When supported, it always renders a stable container (even while closed) so
 *   a future plugin can mount into `[data-sei-canvas-host]` reliably. Open/close
 *   is animated via the `data-open` attribute in CSS.
 */
export function SEICanvasHost({
    open,
    face,
    supported,
    activeSurfaceId,
    children,
}: SEICanvasHostProps) {
    if (!supported) return null
    return (
        <div
            className="ap-sei-canvas-host"
            data-sei-canvas-host=""
            data-open={open ? "true" : "false"}
            data-face={face}
            data-surface-id={activeSurfaceId}
            // Hidden from a11y/interaction while closed so the collapsed region
            // isn't a focus trap; CSS still animates the height/opacity.
            aria-hidden={open ? undefined : true}
        >
            <div className="ap-sei-canvas-host__inner">{children}</div>
        </div>
    )
}

export default SEICanvasHost
