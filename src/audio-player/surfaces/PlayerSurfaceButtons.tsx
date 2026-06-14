import { CanvasIcon, QueueIcon } from "../skins/icons"
import { SurfaceButton } from "./SurfaceButton"
import type { UsePlayerSurfaceResult } from "./usePlayerSurface"

export interface PlayerSurfaceButtonsProps {
    surface: UsePlayerSurfaceResult
    /** Left (canvas) button. Defaults to the face's declared canvas support. */
    showCanvasButton?: boolean
    /** Right (queue) button. Available on every face by default. */
    showQueueButton?: boolean
    className?: string
}

/**
 * The shared left/right surface toggles. LEFT reveals the SEICanvas (only on
 * faces that support it); RIGHT reveals the Apple-Music-style "Up Next" queue.
 * Both use the same {@link SurfaceButton} shell so they look and feel identical.
 */
export function PlayerSurfaceButtons({
    surface,
    showCanvasButton = surface.canvasSupported,
    showQueueButton = true,
    className,
}: PlayerSurfaceButtonsProps) {
    if (!showCanvasButton && !showQueueButton) return null
    return (
        <div
            className={`ap-surface-actions${className ? ` ${className}` : ""}`}
            role="group"
            aria-label="Player surfaces"
        >
            {/* Static labels: aria-pressed (on SurfaceButton) communicates the
                toggle state, so the label must not also change with state. */}
            {showCanvasButton && (
                <SurfaceButton
                    active={surface.isCanvasOpen}
                    onClick={surface.toggleCanvas}
                    label="SEI Canvas"
                >
                    <CanvasIcon />
                </SurfaceButton>
            )}
            {showQueueButton && (
                <SurfaceButton
                    active={surface.isQueueOpen}
                    onClick={surface.toggleQueue}
                    label="Up next"
                >
                    <QueueIcon />
                </SurfaceButton>
            )}
        </div>
    )
}

export default PlayerSurfaceButtons
