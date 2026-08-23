import { useMemo } from "react"
import { CanvasIcon } from "../skins/icons"
import { SurfaceButton } from "./SurfaceButton"
import { ArcActionButton } from "./ArcActionButton"
import { buildCanonicalPlayerActions } from "../menu/canonicalActions"
import type { ArcMenuEntitlements } from "../menu/canonicalActions"
import type { ArcCommandHost } from "../menu/arcRouting"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"
import type { UsePlayerSurfaceResult } from "./usePlayerSurface"

export interface PlayerSurfaceButtonsProps {
    surface: UsePlayerSurfaceResult
    /** Left (canvas) button. Defaults to the face's declared canvas support. */
    showCanvasButton?: boolean
    /**
     * Right (radial action menu) trigger. Defaults to the face's declared
     * `supportsContextualActions` capability, so it is the model, not this
     * component, that decides whether the menu appears.
     */
    showActionMenu?: boolean
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics"). Drives the
     * menu's Plugins › Audio / Visual / Analytics branches: only currently
     * active plugins render.
     */
    activePluginIds?: readonly string[]
    /**
     * Immediate command implementations for this face, keyed by command id
     * (`"track.previous"`, `"share.url"`, `"track.favorite"`, …). Commands the
     * face doesn't wire prune their leaves away rather than render them dead.
     */
    commands?: ArcCommandHost["commands"]
    /** Marks the Favorite leaf active (the track is already a favorite). */
    isFavorite?: boolean
    /**
     * Whether skipping is possible right now. The transport leaves always exist
     * on a face that can skip; these only dim them at the ends of the queue,
     * matching the face's inline transport buttons.
     */
    canPrevious?: boolean
    canNext?: boolean
    /** Entitlements gating the menu's Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements
    /**
     * Opens a workspace route in the face's single SAPController instance — the
     * destination of every settings action in the menu. Without it those leaves
     * are pruned rather than rendered dead.
     */
    onOpenFocusedController?: (route: WorkspaceRoute) => void
    className?: string
}

/**
 * The shared left/right surface controls.
 *
 * LEFT is the canvas button: a face-level *command* that shows/hides the
 * SEICanvas in place. It is deliberately not a menu item — toggling a visual
 * surface is an immediate command, while *configuring* it is a settings screen
 * that lives at Plugins › Visual › Canvas inside the controller.
 *
 * RIGHT is the radial action menu, carrying the canonical hierarchy
 * (Plugins | Playback | Queue | Share | Agents | Vault) that every music face
 * shares. Every settings leaf in it opens inside the same SAPController the
 * face's "…" button opens, via `onOpenFocusedController`.
 */
export function PlayerSurfaceButtons({
    surface,
    showCanvasButton = surface.canvasSupported,
    showActionMenu = surface.contextualSupported,
    activePluginIds,
    commands,
    isFavorite = false,
    canPrevious = true,
    canNext = true,
    entitlements,
    onOpenFocusedController,
    className,
}: PlayerSurfaceButtonsProps) {
    // Built only when the menu is actually rendered, and memoized so it isn't
    // rebuilt on every parent playback tick (skins re-render multiple times per
    // second during active playback). Hooks must run before the early return
    // below, so this stays unconditional.
    const actions = useMemo(
        () =>
            showActionMenu
                ? buildCanonicalPlayerActions({
                      activePluginIds,
                      entitlements,
                      isFavorite,
                      isCanvasActive: surface.isCanvasOpen,
                      canPrevious,
                      canNext,
                  })
                : [],
        [
            showActionMenu,
            activePluginIds,
            entitlements,
            isFavorite,
            surface.isCanvasOpen,
            canPrevious,
            canNext,
        ]
    )

    // Capability filtering is the *only* reason an action is missing from a
    // face: the canvas leaf exists where the face can host the canvas, the vault
    // arm where the surface represents a vault track.
    const capabilities = useMemo(
        () => ({ canvas: surface.canvasSupported, vault: false }),
        [surface.canvasSupported]
    )

    if (!showCanvasButton && !showActionMenu) return null
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
            {showActionMenu && (
                <ArcActionButton
                    actions={actions}
                    commands={commands}
                    capabilities={capabilities}
                    onOpenWorkspace={onOpenFocusedController}
                />
            )}
        </div>
    )
}

export default PlayerSurfaceButtons
