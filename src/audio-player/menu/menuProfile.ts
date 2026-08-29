import { buildCanonicalPlayerActions } from "./canonicalActions"
import type { BuildCanonicalPlayerActionsOptions } from "./canonicalActions"
import type { ArcAction } from "./arcRouting"

/**
 * Host ownership of menu composition.
 *
 * The routing machinery is SAP's — one `ArcAction` model, one router, one
 * controller, one capability-pruning pass. *What is in the menu* is the
 * consuming product's call. SAP's canonical hierarchy is the default, not a
 * mandate: a host that supplies its own tree gets exactly that tree, and a host
 * that supplies nothing gets the canonical one.
 *
 * Three levels of control, from total to surgical:
 *
 * - `actions` — a full replacement. Rendered verbatim; no canonical category is
 *   merged in, appended, or re-ordered around it.
 * - `menuProfile.categories` — keep the canonical arms but choose which ones
 *   appear, and in what order.
 * - `menuProfile.extraActions` — keep the canonical arms and add your own
 *   alongside them.
 */

/** Top-level arm ids in SAP's canonical hierarchy. Open union so a host's own
 *  category ids type-check in the same field. */
export type PlayerMenuCategoryId =
    "plugins" | "playback" | "queue" | "share" | "agents" | "vault" | (string & {})

/** Where a profile's `extraActions` sit relative to the canonical arms. */
export type PlayerMenuPlacement = "append" | "prepend"

export interface PlayerMenuProfile {
    /**
     * Replace the menu outright. When set, every other field here and the
     * canonical hierarchy are ignored — the host owns the whole tree.
     */
    actions?: ArcAction[]
    /**
     * Keep the canonical arms, but only these, in this order. Ids that aren't
     * in the canonical hierarchy are skipped (they can't be built), so a host
     * combining `categories` with `extraActions` gets its own arms from
     * `extraActions`, not from this list. Omit to keep every canonical arm.
     */
    categories?: readonly PlayerMenuCategoryId[]
    /** Host arms rendered alongside the canonical ones. */
    extraActions?: ArcAction[]
    /** Which side `extraActions` land on. Defaults to `"append"`. */
    placement?: PlayerMenuPlacement
}

export interface ResolvePlayerMenuOptions extends BuildCanonicalPlayerActionsOptions {
    /**
     * A complete host-provided tree. Highest precedence: supplying this means
     * the menu is exactly this, with no canonical categories added.
     */
    actions?: ArcAction[]
    /** Structured control over the canonical hierarchy. */
    menuProfile?: PlayerMenuProfile
}

/**
 * Resolve what a face should render, in precedence order:
 *
 *   1. `actions`                  — host tree, verbatim
 *   2. `menuProfile.actions`      — host tree, verbatim
 *   3. canonical, filtered by `menuProfile.categories` (+ `extraActions`)
 *   4. canonical
 *
 * Whatever comes back still goes through the shared router and capability
 * pruning — host ownership is over *composition*, not over routing, dead-action
 * pruning, or the controller contract.
 */
export function resolvePlayerMenu({
    actions,
    menuProfile,
    ...canonicalOptions
}: ResolvePlayerMenuOptions = {}): ArcAction[] {
    // A host tree wins outright. Returned as-is: no canonical arm is merged in,
    // which is the whole point — an app that ships four categories gets four.
    if (actions) return actions
    if (menuProfile?.actions) return menuProfile.actions

    const canonical = buildCanonicalPlayerActions(canonicalOptions)
    if (!menuProfile) return canonical

    const { categories, extraActions, placement = "append" } = menuProfile

    let arms = canonical
    if (Array.isArray(categories)) {
        // Selection *and* order come from the host's list. Deduped, because a
        // repeated id would render the same arm twice — duplicate node ids the
        // renderer keys on, for no gain.
        const byId = new Map(canonical.map((arm) => [arm.id, arm]))
        arms = Array.from(new Set(categories))
            .map((id) => byId.get(id))
            .filter((arm): arm is ArcAction => arm !== undefined)
    }

    if (!Array.isArray(extraActions) || extraActions.length === 0) return arms
    return placement === "prepend" ? [...extraActions, ...arms] : [...arms, ...extraActions]
}

/** Whether these options leave the menu on SAP's canonical hierarchy. */
export function isCanonicalPlayerMenu({
    actions,
    menuProfile,
}: ResolvePlayerMenuOptions = {}): boolean {
    if (actions || menuProfile?.actions) return false
    if (!menuProfile) return true
    return !menuProfile.categories && !menuProfile.extraActions?.length
}
