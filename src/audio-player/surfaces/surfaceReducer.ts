import { faceSupportsHeroCollapse, faceSupportsSEICanvas } from "./faceCapabilities"
import type { PlayerFace } from "./faceCapabilities"

/**
 * The states a player surface region can be in.
 *
 * There is exactly one optional surface: the SEICanvas. The queue used to be a
 * second in-region surface; it now lives inside the "…" controller
 * (`library:queue`) like every other destination, so nothing here competes with
 * the controller for the same content.
 */
export type PlayerSurfaceMode = "default" | "canvas"

export interface SurfaceState {
    mode: PlayerSurfaceMode
}

export type SurfaceAction =
    | { type: "toggleCanvas" }
    | { type: "open"; mode: Exclude<PlayerSurfaceMode, "default"> }
    | { type: "close" }

export const INITIAL_SURFACE_STATE: SurfaceState = { mode: "default" }

/** Canvas mode is only legal on faces that DECLARE SEICanvas support. */
export function canEnterCanvas(face: PlayerFace): boolean {
    return faceSupportsSEICanvas(face)
}

/**
 * Pure surface transition. `face` is passed in so capability is enforced in one
 * place: a request to enter canvas on an unsupported face is a no-op.
 */
export function surfaceReducer(
    state: SurfaceState,
    action: SurfaceAction,
    face: PlayerFace
): SurfaceState {
    switch (action.type) {
        case "toggleCanvas":
            if (!canEnterCanvas(face)) return state
            return { mode: state.mode === "canvas" ? "default" : "canvas" }
        case "open":
            if (action.mode === "canvas" && !canEnterCanvas(face)) return state
            // Preserve referential equality when nothing changes so consumers
            // don't re-render needlessly.
            if (state.mode === action.mode) return state
            return { mode: action.mode }
        case "close":
            if (state.mode === "default") return state
            return INITIAL_SURFACE_STATE
        default:
            return state
    }
}

/**
 * Whether the hero should render collapsed. True only when the canvas surface is
 * open AND the face declares hero-collapse support — derived, never stored, so
 * it can't drift from `mode`.
 */
export function deriveHeroCollapsed(mode: PlayerSurfaceMode, face: PlayerFace): boolean {
    return mode === "canvas" && faceSupportsHeroCollapse(face)
}
