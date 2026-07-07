import { MenuNode } from '../menu/menuData';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
/** Radius of the half-circle the nodes fan out on, in px. */
export declare const ARC_RADIUS = 128;
export interface ArcOffset {
    x: number;
    y: number;
}
/**
 * Polar fan geometry: `n` points spread across a half-circle that opens upward
 * (angles 180°→0°), centered on the pivot. `y` is negative (up). A single item
 * sits straight above the pivot.
 */
export declare function arcOffsets(n: number, radius?: number): ArcOffset[];
export interface SEICanvasActionMenuProps {
    /** The menu tree to render. */
    items: MenuNode[];
    /** Resolves the `open-queue` leaf action. Optional — decoupled callers (e.g.
        a generic ArcActionButton) render trees with no such leaf. */
    onOpenQueue?: () => void;
    /** Resolves the `activate-canvas` leaf action. Optional, as above. */
    onActivateCanvas?: () => void;
    /** Resolves any other leaf action (and `select-lyrics`). */
    onSelect?: (node: MenuNode) => void;
    /**
     * Opens a focused workspace route in the SAP Controller shell. When provided,
     * a node's `workspaceRoute` takes precedence over its legacy `actionId`, so
     * the radial menu drives the workspace router. Omit it to keep the legacy
     * `onOpenQueue` / `onActivateCanvas` / `onSelect` behavior unchanged.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void;
    /** Accessible label for the trigger + menu. */
    ariaLabel?: string;
    className?: string;
}
/**
 * The SEI Canvas Action Menu: a bottom-anchored half-circle command wheel. The
 * closed state is a single round trigger that drops into the queue surface slot.
 * Tapping it opens a dimmed, blurred portal overlay that fans the menu items on
 * an arc, with submenu navigation, a depth-aware Close/Back center button, and a
 * breadcrumb. The arc's open + navigation state is entirely local here — it is an
 * overlay, never a player surface. Kept free of engine/session imports so it can
 * later be promoted into the seihouse-ui design system.
 */
export declare function SEICanvasActionMenu({ items, onOpenQueue, onActivateCanvas, onSelect, onOpenWorkspace, ariaLabel, className, }: SEICanvasActionMenuProps): import("react").JSX.Element;
export default SEICanvasActionMenu;
//# sourceMappingURL=SEICanvasActionMenu.d.ts.map