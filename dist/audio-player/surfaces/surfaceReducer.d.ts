import { PlayerFace } from './faceCapabilities';
/**
 * The three states a player surface region can be in. Only one is ever active —
 * opening one surface closes the other by construction (a single `mode` field).
 */
export type PlayerSurfaceMode = "default" | "canvas" | "queue";
export interface SurfaceState {
    mode: PlayerSurfaceMode;
}
export type SurfaceAction = {
    type: "toggleCanvas";
} | {
    type: "toggleQueue";
} | {
    type: "open";
    mode: Exclude<PlayerSurfaceMode, "default">;
} | {
    type: "close";
};
export declare const INITIAL_SURFACE_STATE: SurfaceState;
/** Canvas mode is only legal on faces that DECLARE SEICanvas support. */
export declare function canEnterCanvas(face: PlayerFace): boolean;
/**
 * Pure surface transition. `face` is passed in so capability is enforced in one
 * place: a request to enter canvas on an unsupported face is a no-op.
 */
export declare function surfaceReducer(state: SurfaceState, action: SurfaceAction, face: PlayerFace): SurfaceState;
/**
 * Whether the hero should render collapsed. True only when the canvas surface is
 * open AND the face declares hero-collapse support — derived, never stored, so
 * it can't drift from `mode`.
 */
export declare function deriveHeroCollapsed(mode: PlayerSurfaceMode, face: PlayerFace): boolean;
//# sourceMappingURL=surfaceReducer.d.ts.map