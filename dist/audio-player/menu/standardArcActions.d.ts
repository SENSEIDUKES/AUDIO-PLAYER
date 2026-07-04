import { ArcAction } from './arcRouting';
import { ArcMenuEntitlements } from './menuData';
/**
 * The standardized arc wheel in the declarative `ArcAction` model (the command
 * router `ArcActionButton` renders). Every arc-menu face shares the same four
 * arms —
 *
 *     Plugins  › Audio / Visual / Analytics   (only currently active plugins)
 *     Playback › Up Next / Controls / Debug
 *     Share    › Link / Add to / Favorite
 *     Agents   › Scout / Memoir
 *
 * — and each quick action opens a dedicated section in the "…" menu (a
 * `"sap-controller"` workspace route) or runs an immediate host command. The
 * Vault face swaps Plugins for its dedicated Vault arm (see vaultTrackMenu.ts).
 * As always, leaves whose destination the host hasn't wired are pruned before
 * render — the shared arms below can be composed onto any face without dead
 * buttons appearing.
 */
export interface BuildStandardArcActionsOptions {
    /**
     * Ids of the plugins currently active on this player — catalog ids
     * ("lyrics") or registry instance names ("registry-lyrics"). Only active
     * plugins render under Plugins › Audio / Visual / Analytics.
     */
    activePluginIds?: readonly string[];
    /** Entitlements gating the Agents branch (Scout tier). */
    entitlements?: ArcMenuEntitlements;
}
/** Playback › Up Next / Controls / Debug — each a dedicated "…" menu section. */
export declare function buildPlaybackArcBranch(): ArcAction;
/**
 * Share › Link / Add to / Favorite. Link and Favorite are immediate host
 * commands (`"share.url"`, `"track.favorite"`) and prune away on hosts that
 * don't wire them; Add to opens the Add to Vault section in the "…" menu.
 */
export declare function buildShareArcBranch(): ArcAction;
/**
 * Agents › Scout / Memoir. Scout is the audio-analysis agent — it routes to
 * its paid Studio tier when entitled, else the free Demo tier. Memoir is
 * assistance and info (a narrated history of the track's vault versions).
 */
export declare function buildAgentsArcBranch(entitlements?: ArcMenuEntitlements): ArcAction;
/**
 * Plugins › Audio / Visual / Analytics, holding only the *currently active*
 * plugins (e.g. when Lyrics is active, tapping Visual reveals a Lyrics
 * button). Each plugin leaf opens that plugin's dedicated settings section in
 * the "…" menu. The Canvas toggle is the one built-in Visual leaf (target
 * `"sei-canvas"`); like everything else it prunes away on hosts that don't
 * wire the canvas. Returns `null` when no bucket has any live leaf.
 */
export declare function buildPluginsArcBranch(activePluginIds?: readonly string[]): ArcAction | null;
/**
 * The full standardized wheel for non-Vault faces:
 * Plugins | Playback | Share | Agents.
 */
export declare function buildStandardTrackArcActions({ activePluginIds, entitlements, }?: BuildStandardArcActionsOptions): ArcAction[];
//# sourceMappingURL=standardArcActions.d.ts.map