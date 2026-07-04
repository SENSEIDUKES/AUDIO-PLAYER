import { useCallback, useMemo } from "react"
import { CanvasIcon } from "../skins/icons"
import { SurfaceButton } from "./SurfaceButton"
import { SEICanvasActionMenu } from "./SEICanvasActionMenu"
import { buildMenuTree } from "../menu/menuData"
import type { MenuNode } from "../menu/menuData"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import type { UsePlayerSurfaceResult } from "./usePlayerSurface"

export interface PlayerSurfaceButtonsProps {
    surface: UsePlayerSurfaceResult
    /** Left (canvas) button. Defaults to the face's declared canvas support. */
    showCanvasButton?: boolean
    /**
     * Right (action menu) trigger — the contextual radial menu. Defaults to the
     * face's declared `supportsContextualActions` capability, so it is the model,
     * not this component, that decides whether the menu appears.
     */
    showQueueButton?: boolean
    /**
     * What the menu's "Up Next" leaf opens. Faces with a full queue drawer pass
     * their opener here; the default falls back to the in-region queue toggle so
     * faces without a drawer (e.g. mini sidebar) still reach their queue.
     */
    onOpenQueue?: () => void
    /**
     * Add Previous/Next leaves to the menu's Playback branch. Compact faces that
     * drop their inline skip buttons (the mini sidebar) opt in and wire
     * `onPrevious`/`onNext`, moving transport into the menu so the row has space
     * for title/artist.
     */
    showTransport?: boolean
    canPrevious?: boolean
    canNext?: boolean
    onPrevious?: () => void
    onNext?: () => void
    /**
     * Callback when a workspace route is selected from the arc menu. The parent
     * face should manage a single SAPController instance and update its route.
     * This component no longer owns/renders a separate SAPController.
     */
    onOpenFocusedController?: (route: WorkspaceRoute) => void
    className?: string
}

/**
 * The shared left/right surface controls. LEFT reveals the SEICanvas (only on
 * faces that support it). RIGHT is the SEI Canvas Action Menu — a bottom-arc
 * command wheel that replaces the old flat "Up Next" toggle. Queue lives inside
 * it under Playback › Up Next; the canvas under Plugin › Visual › Canvas.
 */
export function PlayerSurfaceButtons({
    surface,
    showCanvasButton = surface.canvasSupported,
    showQueueButton = surface.contextualSupported,
    onOpenQueue,
    showTransport = false,
    canPrevious = false,
    canNext = false,
    onPrevious,
    onNext,
    onOpenFocusedController,
    className,
}: PlayerSurfaceButtonsProps) {
    // Built only when the contextual menu is actually rendered, and memoized so
    // it isn't rebuilt on every parent playback tick (skins re-render multiple
    // times per second during active playback). Hooks must run before the early
    // return below, so this stays unconditional.
    const menuItems = useMemo<MenuNode[]>(
        () =>
            showQueueButton
                ? buildMenuTree({
                      canvasSupported: surface.canvasSupported,
                      isCanvasActive: surface.isCanvasOpen,
                      includeTransport: showTransport,
                      canPrevious,
                      canNext,
                      // Workspace-only nodes (Lyrics, Automix, Agent, Activity
                      // Log) exist only when the host actually routes into the
                      // SAP Controller shell — otherwise they'd be dead buttons.
                      canRouteWorkspaces: Boolean(onOpenFocusedController),
                  })
                : [],
        [
            showQueueButton,
            surface.canvasSupported,
            surface.isCanvasOpen,
            showTransport,
            canPrevious,
            canNext,
            onOpenFocusedController,
        ]
    )

    // Resolve the transport leaves (no workspaceRoute, so they fall through to
    // the menu's `onSelect`). Other unknown leaves are intentionally ignored.
    const handleSelect = useCallback(
        (node: MenuNode) => {
            if (node.actionId === "previous-track") onPrevious?.()
            else if (node.actionId === "next-track") onNext?.()
        },
        [onNext, onPrevious]
    )

    // The radial menu opens focused workspace routes via the parent's callback.
    // This component no longer owns/renders a separate SAPController — the parent
    // face manages a single shared instance for both the "..." button and arc menu.
    const handleOpenWorkspace = useCallback(
        (route: WorkspaceRoute) => {
            onOpenFocusedController?.(route)
        },
        [onOpenFocusedController]
    )

    if (!showCanvasButton && !showQueueButton) return null
    return (
        <div
            className={`ap-surface-actions${className ? ` ${className}` : ""}`}
            role="group"
            aria-label="Player surfaces"
        >
            {/* Static label: aria-pressed (on SurfaceButton) communicates the
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
                <SEICanvasActionMenu
                    items={menuItems}
                    onActivateCanvas={surface.toggleCanvas}
                    onOpenQueue={onOpenQueue ?? surface.toggleQueue}
                    onOpenWorkspace={handleOpenWorkspace}
                    onSelect={handleSelect}
                />
            )}
        </div>
    )
}

export default PlayerSurfaceButtons
