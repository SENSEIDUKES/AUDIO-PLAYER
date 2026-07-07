import { ArcMenuEntitlements } from '../menu/menuData';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
import { UsePlayerSurfaceResult } from './usePlayerSurface';
export interface PlayerSurfaceButtonsProps {
    surface: UsePlayerSurfaceResult;
    /** Left (canvas) button. Defaults to the face's declared canvas support. */
    showCanvasButton?: boolean;
    /**
     * Right (action menu) trigger — the contextual radial menu. Defaults to the
     * face's declared `supportsContextualActions` capability, so it is the model,
     * not this component, that decides whether the menu appears.
     */
    showQueueButton?: boolean;
    /**
     * What the menu's "Up Next" leaf opens. Faces with a full queue drawer pass
     * their opener here; the default falls back to the in-region queue toggle so
     * faces without a drawer (e.g. mini sidebar) still reach their queue.
     */
    onOpenQueue?: () => void;
    /**
     * Add Previous/Next leaves to the menu's Playback branch. Compact faces that
     * drop their inline skip buttons (the mini sidebar) opt in and wire
     * `onPrevious`/`onNext`, moving transport into the menu so the row has space
     * for title/artist.
     */
    showTransport?: boolean;
    canPrevious?: boolean;
    canNext?: boolean;
    onPrevious?: () => void;
    onNext?: () => void;
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics"). Drives the
     * menu's Plugins › Audio / Visual / Analytics branches: only currently
     * active plugins render.
     */
    activePluginIds?: readonly string[];
    /** Wires the menu's Share › Link leaf (copy/share the track URL). */
    onShareLink?: () => void;
    /** Wires the menu's Share › Favorite leaf. */
    onToggleFavorite?: () => void;
    /** Marks the Favorite leaf active (the track is already a favorite). */
    isFavorite?: boolean;
    /** Entitlements gating the menu's Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements;
    /**
     * Callback when a workspace route is selected from the arc menu. The parent
     * face should manage a single SAPController instance and update its route.
     * This component no longer owns/renders a separate SAPController.
     */
    onOpenFocusedController?: (route: WorkspaceRoute) => void;
    className?: string;
}
/**
 * The shared left/right surface controls. LEFT reveals the SEICanvas (only on
 * faces that support it). RIGHT is the SEI Canvas Action Menu — a bottom-arc
 * command wheel carrying the standardized arc arms (Plugins | Playback | Share
 * | Agents). Queue lives inside it under Playback › Up Next; the canvas under
 * Plugins › Visual › Canvas.
 */
export declare function PlayerSurfaceButtons({ surface, showCanvasButton, showQueueButton, onOpenQueue, showTransport, canPrevious, canNext, onPrevious, onNext, activePluginIds, onShareLink, onToggleFavorite, isFavorite, entitlements, onOpenFocusedController, className, }: PlayerSurfaceButtonsProps): import("react").JSX.Element | null;
export default PlayerSurfaceButtons;
//# sourceMappingURL=PlayerSurfaceButtons.d.ts.map