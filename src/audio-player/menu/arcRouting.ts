import type { ComponentType } from "react"
import type { MenuItemState } from "./menuData"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"

/**
 * The player's action routing model — the single contract every menu surface
 * shares.
 *
 * There are exactly **two connected menu surfaces**:
 *
 * 1. the **SAP Controller** (the "…" three-dot sheet) — the canonical
 *    controller and workspace shell; every settings destination renders inside
 *    it, and
 * 2. the **radial action menu** — a shortcut launcher whose settings leaves
 *    open their destination *inside that same controller*.
 *
 * A leaf therefore resolves to one of only three things: a controller
 * workspace, a truly immediate command (a command, never a settings screen),
 * or an honest entitlement lock. There is no third surface, no face-specific
 * menu, and no dead button: a leaf whose destination or required capability the
 * host cannot satisfy is pruned before render.
 */
export type ArcActionTarget = "immediate-action" | "sap-controller" | "locked-entitlement"

/**
 * Known immediate command ids the hosts resolve to real callbacks. These are
 * deliberately *commands* — they act on playback or the queue right away — and
 * are the only leaves allowed not to open the controller. Open string union so
 * faces can register custom commands without a type change.
 */
export type ArcCommandId =
    | "track.previous"
    | "track.next"
    | "track.favorite"
    | "queue.insertAfterCurrent"
    | "queue.append"
    | "share.url"
    | (string & {})

/**
 * A capability an action needs in order to exist at all. Capabilities describe
 * what a host/face genuinely *can* do — never mere styling or layout taste. An
 * action is hidden only when a capability it requires is absent.
 *
 * - `canvas`        — the face can host the SEI Canvas visual surface
 * - `vault`         — the surface represents a vault-managed track
 */
export type PlayerActionCapability = "canvas" | "vault" | (string & {})

/**
 * A declarative action carried by every menu surface. Either a branch (has
 * `children`, opens a submenu) or a leaf. A leaf declares *where it routes* via
 * `target`:
 *
 * - `"sap-controller"`     — opens `workspaceRoute` inside the "…" controller
 * - `"immediate-action"`   — runs `host.commands[action]` (or legacy `onSelect`)
 * - `"locked-entitlement"` — visible but locked (missing entitlement)
 *
 * Leaves without a `target` are treated as immediate actions resolved by
 * `onSelect` (the original declarative API).
 */
export interface ArcAction {
    id: string
    label: string
    /** Optional glyph; hosts default it (ArcActionButton uses the dots mark). */
    icon?: ComponentType
    /** Reuses the menu's state union (available/active/disabled/locked).
     *  When omitted, it is derived from `target` (locked-entitlement → locked). */
    state?: MenuItemState
    /** Where this leaf routes. Omitted = immediate action via `onSelect`. */
    target?: ArcActionTarget
    /** Immediate command id, resolved against `ArcCommandHost.commands`. */
    action?: ArcCommandId
    /** Controller destination for `target: "sap-controller"` leaves. */
    workspaceRoute?: WorkspaceRoute
    /**
     * Capabilities this action (and its subtree) needs. Every one must be
     * declared `true` by the host or the action is pruned — the only legitimate
     * reason to hide an action from a face.
     */
    requires?: readonly PlayerActionCapability[]
    /** Legacy leaf handler. Receives the action id; ignored when `children`
     *  or a resolvable `action` command is set. */
    onSelect?: (id: string) => void
    /** Nested actions — renders a submenu. */
    children?: ArcAction[]
}

/**
 * The host wiring a menu surface routes into. `openWorkspace` is the SAP
 * Controller shell — the destination of every settings leaf; `commands`
 * resolves immediate command ids; `capabilities` declares what this face/host
 * genuinely supports. Anything a host leaves unwired makes the corresponding
 * leaves dead — and dead leaves are pruned, never rendered.
 */
export interface ArcCommandHost {
    /** Immediate command implementations, keyed by `ArcCommandId`. */
    commands?: Readonly<Partial<Record<string, () => void>>>
    /** Opens a workspace route inside the "…" SAP Controller shell. */
    openWorkspace?: (route: WorkspaceRoute) => void
    /** Capabilities this host declares (see {@link PlayerActionCapability}). */
    capabilities?: Readonly<Partial<Record<string, boolean>>>
}

/**
 * The effective visual/behavioral state of an action: an explicit `state`
 * wins; otherwise a `locked-entitlement` target renders locked and everything
 * else is available.
 */
export function resolveArcActionState(action: ArcAction): MenuItemState {
    if (action.state) return action.state
    return action.target === "locked-entitlement" ? "locked" : "available"
}

/** Resolve the immediate handler for a leaf, if any. Explicit `action`
 *  commands win over the legacy `onSelect`. */
function immediateHandler(action: ArcAction, host: ArcCommandHost): (() => void) | undefined {
    if (action.action) {
        const command = host.commands?.[action.action]
        if (command) return command
    }
    // An inline `onSelect` counts as host wiring too — it backs both plain
    // declarative leaves and command leaves the host chose to handle inline.
    if (action.onSelect) return () => action.onSelect!(action.id)
    return undefined
}

/** Whether every capability an action declares is present on this host. */
export function hasRequiredCapabilities(action: ArcAction, host: ArcCommandHost): boolean {
    if (!action.requires || action.requires.length === 0) return true
    return action.requires.every((capability) => host.capabilities?.[capability] === true)
}

/**
 * Whether an action resolves to a real destination on this host. An action
 * missing a required capability is never live. Locked leaves count as live —
 * showing the lock honestly *is* their behavior. Branches are live when any
 * descendant leaf is.
 */
export function isArcActionLive(action: ArcAction, host: ArcCommandHost): boolean {
    if (!hasRequiredCapabilities(action, host)) return false
    if (action.children && action.children.length > 0) {
        return action.children.some((child) => isArcActionLive(child, host))
    }
    switch (action.target) {
        case "locked-entitlement":
            return true
        case "sap-controller":
            return Boolean(host.openWorkspace && action.workspaceRoute)
        case "immediate-action":
        default:
            return Boolean(immediateHandler(action, host))
    }
}

/**
 * Drop every action that cannot do a real thing on this host — a missing
 * capability, an unwired destination — and every branch left empty by that.
 * What survives is exactly the set of buttons that work: the menu never renders
 * a "coming soon" or mystery no-op node.
 */
export function pruneDeadArcActions(actions: ArcAction[], host: ArcCommandHost): ArcAction[] {
    const pruned: ArcAction[] = []
    // Public library entry point: a null/undefined tree from an untyped (plain
    // JS) caller prunes to nothing instead of throwing.
    if (!actions) return pruned
    for (const action of actions) {
        if (!hasRequiredCapabilities(action, host)) continue
        if (action.children && action.children.length > 0) {
            const children = pruneDeadArcActions(action.children, host)
            if (children.length > 0) pruned.push({ ...action, children })
            continue
        }
        if (isArcActionLive(action, host)) pruned.push(action)
    }
    return pruned
}

/** Every leaf in an action tree, in render order. */
export function collectArcLeaves(actions: ArcAction[], out: ArcAction[] = []): ArcAction[] {
    if (!actions) return out
    for (const action of actions) {
        if (action.children && action.children.length > 0) collectArcLeaves(action.children, out)
        else out.push(action)
    }
    return out
}

/** One row of the route matrix: what a leaf opens, and where. */
export interface ArcRouteDescriptor {
    id: string
    label: string
    target: ArcActionTarget
    /** Controller workspace for `sap-controller` leaves. */
    workspaceRoute?: WorkspaceRoute
    /** Command id for `immediate-action` leaves. */
    command?: ArcCommandId
}

/**
 * The route matrix for an action tree: every leaf paired with its destination.
 * The audit tool behind the tests — a leaf that opens nothing, or opens
 * something outside the controller/command contract, shows up here.
 */
export function describeArcRoutes(actions: ArcAction[]): ArcRouteDescriptor[] {
    return collectArcLeaves(actions).map((leaf) => ({
        id: leaf.id,
        label: leaf.label,
        target: leaf.target ?? "immediate-action",
        ...(leaf.workspaceRoute ? { workspaceRoute: leaf.workspaceRoute } : {}),
        ...(leaf.action ? { command: leaf.action } : {}),
    }))
}

/**
 * Dispatch a selected leaf to its destination. Returns `true` when the leaf
 * routed somewhere real, `false` for locked leaves and unresolvable targets
 * (which pruning should have removed before they were ever tappable).
 */
export function routeArcAction(action: ArcAction, host: ArcCommandHost): boolean {
    if (!hasRequiredCapabilities(action, host)) return false
    switch (action.target) {
        case "locked-entitlement":
            return false
        case "sap-controller":
            if (!host.openWorkspace || !action.workspaceRoute) return false
            host.openWorkspace(action.workspaceRoute)
            return true
        case "immediate-action":
        default: {
            const run = immediateHandler(action, host)
            if (!run) return false
            run()
            return true
        }
    }
}
