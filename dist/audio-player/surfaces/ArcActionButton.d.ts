import { ArcAction, ArcCommandHost } from '../menu/arcRouting';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
export type { ArcAction, ArcActionTarget, ArcCommandId, ArcCommandHost } from '../menu/arcRouting';
export interface ArcActionButtonProps {
    /** The declarative action tree to surface in the arc. */
    actions: ArcAction[];
    /**
     * Immediate command implementations, keyed by command id (e.g.
     * `"queue.insertAfterCurrent"`). Leaves with an `action` the host doesn't
     * implement are pruned, never rendered dead.
     */
    commands?: ArcCommandHost["commands"];
    /** Opens/toggles the SEI Canvas — the destination of `"sei-canvas"` leaves. */
    onOpenCanvas?: () => void;
    /**
     * Opens a focused workspace route in the SAP Controller shell — the
     * destination of `"sap-controller"` leaves. Without it those leaves (and
     * any branch left empty) are pruned.
     */
    onOpenWorkspace?: (route: WorkspaceRoute) => void;
    ariaLabel?: string;
    className?: string;
}
/**
 * The Arc Action Button: the SEIHouse command-wheel affordance backed by a
 * plain `ArcAction[]` model, upgraded from a pretty radial UI into a command
 * router. Every leaf declares its `target`, and the button routes it into one
 * of exactly two real surfaces — the SEI Canvas (`onOpenCanvas`) or the SAP
 * Controller (`onOpenWorkspace`) — or runs an immediate command from
 * `commands`. Leaves the host hasn't wired are pruned before render, so every
 * visible node does a real action; entitlement-locked leaves stay visible but
 * render locked. The trigger is a single button when closed (cheap to mount in
 * long lists) and the arc overlay only renders on tap.
 */
export declare function ArcActionButton({ actions, commands, onOpenCanvas, onOpenWorkspace, ariaLabel, className, }: ArcActionButtonProps): import("react").JSX.Element | null;
export default ArcActionButton;
//# sourceMappingURL=ArcActionButton.d.ts.map