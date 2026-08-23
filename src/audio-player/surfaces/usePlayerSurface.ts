import { useCallback, useMemo, useReducer } from "react"
import { faceSupportsContextualActions, faceSupportsSEICanvas } from "./faceCapabilities"
import type { PlayerFace } from "./faceCapabilities"
import { INITIAL_SURFACE_STATE, deriveHeroCollapsed, surfaceReducer } from "./surfaceReducer"
import type { PlayerSurfaceMode, SurfaceAction, SurfaceState } from "./surfaceReducer"

export interface UsePlayerSurfaceResult {
    mode: PlayerSurfaceMode
    isCanvasOpen: boolean
    /** Derived: canvas open on a hero-collapse-capable face. */
    isHeroCollapsed: boolean
    /** Whether this face can host the SEICanvas at all. */
    canvasSupported: boolean
    /** Whether this face renders the contextual (radial) action menu. */
    contextualSupported: boolean
    toggleCanvas: () => void
    closeSurface: () => void
}

/**
 * React layer over the pure {@link surfaceReducer}. No effects or subscriptions,
 * so it is StrictMode-safe and the reducer stays the single source of truth.
 */
export function usePlayerSurface(face: PlayerFace): UsePlayerSurfaceResult {
    const [state, dispatch] = useReducer(
        (s: SurfaceState, action: SurfaceAction) => surfaceReducer(s, action, face),
        INITIAL_SURFACE_STATE
    )

    const toggleCanvas = useCallback(() => dispatch({ type: "toggleCanvas" }), [])
    const closeSurface = useCallback(() => dispatch({ type: "close" }), [])

    return useMemo<UsePlayerSurfaceResult>(
        () => ({
            mode: state.mode,
            isCanvasOpen: state.mode === "canvas",
            isHeroCollapsed: deriveHeroCollapsed(state.mode, face),
            canvasSupported: faceSupportsSEICanvas(face),
            contextualSupported: faceSupportsContextualActions(face),
            toggleCanvas,
            closeSurface,
        }),
        [state.mode, face, toggleCanvas, closeSurface]
    )
}
