import { PlayerFace } from './faceCapabilities';
import { PlayerSurfaceMode } from './surfaceReducer';
export interface UsePlayerSurfaceResult {
    mode: PlayerSurfaceMode;
    isCanvasOpen: boolean;
    isQueueOpen: boolean;
    /** Derived: canvas open on a hero-collapse-capable face. */
    isHeroCollapsed: boolean;
    /** Whether this face can host the SEICanvas at all. */
    canvasSupported: boolean;
    /** Whether this face renders the contextual (radial) action menu. */
    contextualSupported: boolean;
    toggleCanvas: () => void;
    toggleQueue: () => void;
    closeSurface: () => void;
}
/**
 * React layer over the pure {@link surfaceReducer}. No effects or subscriptions,
 * so it is StrictMode-safe and the reducer stays the single source of truth.
 */
export declare function usePlayerSurface(face: PlayerFace): UsePlayerSurfaceResult;
//# sourceMappingURL=usePlayerSurface.d.ts.map