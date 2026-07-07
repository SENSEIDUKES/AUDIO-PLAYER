import { ComponentType } from 'react';
import { MenuItemState } from './menuData';
import { WorkspaceRoute } from '../components/workspace/workspaceRoutes';
/**
 * Arc command routing model.
 *
 * The ARC menu is a *command router*, not just a radial UI: every leaf must
 * resolve to one of a small, closed set of destinations. There are exactly two
 * real surfaces the arc may route into — the SEI Canvas and the SAP Controller
 * (the three-dot surface) — plus immediate in-place commands and honest
 * entitlement locks. No other surfaces, no dead buttons: a leaf whose target
 * cannot be resolved against the host's wiring is pruned before render.
 */
export type ArcActionTarget = "immediate-action" | "sei-canvas" | "sap-controller" | "locked-entitlement";
/**
 * Known immediate command ids the hosts resolve to real callbacks. Open string
 * union so faces can register custom commands without a type change.
 */
export type ArcCommandId = "queue.insertAfterCurrent" | "queue.append" | "share.email" | "share.url" | "track.favorite" | (string & {});
/**
 * A declarative row/face action carried by the arc. Either a branch (has
 * `children`, opens a submenu) or a leaf. A leaf declares *where it routes*
 * via `target`:
 *
 * - `"immediate-action"`   — runs `host.commands[action]` (or legacy `onSelect`)
 * - `"sei-canvas"`         — opens the SEI Canvas via `host.openCanvas`
 * - `"sap-controller"`     — opens `workspaceRoute` via `host.openWorkspace`
 * - `"locked-entitlement"` — visible but locked (missing entitlement)
 *
 * Leaves without a `target` are treated as immediate actions resolved by
 * `onSelect` (the original declarative API).
 */
export interface ArcAction {
    id: string;
    label: string;
    /** Optional glyph; hosts default it (ArcActionButton uses the dots mark). */
    icon?: ComponentType;
    /** Reuses the arc menu's state union (available/disabled/locked/…).
     *  When omitted, it is derived from `target` (locked-entitlement → locked). */
    state?: MenuItemState;
    /** Where this leaf routes. Omitted = immediate action via `onSelect`. */
    target?: ArcActionTarget;
    /** Immediate command id, resolved against `ArcCommandHost.commands`. */
    action?: ArcCommandId;
    /** SAP Controller destination for `target: "sap-controller"` leaves. */
    workspaceRoute?: WorkspaceRoute;
    /** Legacy leaf handler. Receives the action id; ignored when `children`
     *  or a resolvable `action` command is set. */
    onSelect?: (id: string) => void;
    /** Nested actions — renders a submenu in the arc. */
    children?: ArcAction[];
}
/**
 * The host wiring an arc surface routes into. `commands` resolves immediate
 * command ids; `openCanvas` is the SEI Canvas surface; `openWorkspace` is the
 * SAP Controller shell. Anything a host leaves unwired makes the corresponding
 * leaves dead — and dead leaves are pruned, never rendered.
 */
export interface ArcCommandHost {
    /** Immediate command implementations, keyed by `ArcCommandId`. */
    commands?: Readonly<Partial<Record<string, () => void>>>;
    /** Opens/toggles the SEI Canvas. */
    openCanvas?: () => void;
    /** Opens a focused workspace route in the SAP Controller shell. */
    openWorkspace?: (route: WorkspaceRoute) => void;
}
/**
 * The effective visual/behavioral state of an action: an explicit `state`
 * wins; otherwise a `locked-entitlement` target renders locked and everything
 * else is available.
 */
export declare function resolveArcActionState(action: ArcAction): MenuItemState;
/**
 * Whether a leaf resolves to a real destination on this host. Locked leaves
 * count as live — showing the lock honestly *is* their behavior. Branches are
 * live when any descendant leaf is.
 */
export declare function isArcActionLive(action: ArcAction, host: ArcCommandHost): boolean;
/**
 * Drop every leaf that cannot do a real action on this host, and every branch
 * left empty by that. What survives is exactly the set of buttons that work —
 * the arc never renders a "coming soon" or mystery no-op node.
 */
export declare function pruneDeadArcActions(actions: ArcAction[], host: ArcCommandHost): ArcAction[];
/**
 * Dispatch a selected leaf to its destination. Returns `true` when the leaf
 * routed somewhere real, `false` for locked leaves and unresolvable targets
 * (which pruning should have removed before they were ever tappable).
 */
export declare function routeArcAction(action: ArcAction, host: ArcCommandHost): boolean;
//# sourceMappingURL=arcRouting.d.ts.map