import { ArcAction } from './arcRouting';
import { ArcMenuEntitlements } from './menuData';
/**
 * Entitlements that gate parts of the Vault command wheel. Kept as an alias of
 * the shared arc-menu entitlements so existing callers keep compiling.
 */
export type VaultTrackEntitlements = ArcMenuEntitlements;
export interface BuildVaultTrackArcActionsOptions {
    entitlements?: VaultTrackEntitlements;
}
/**
 * The Vault face's command wheel — the standardized arc with one deliberate
 * difference: the Plugins arm is replaced by a dedicated Vault arm, because a
 * vault row's primary actions are about organizing the track, not configuring
 * the player:
 *
 *     Vault    › Tag / Rename / Playlist / Radio   (SAP Controller workspaces)
 *     Playback › Up Next / Controls / Debug        (SAP Controller workspaces)
 *     Share    › Link / Add to / Favorite          (immediate + workspace)
 *     Agents   › Scout / Memoir                    (SAP Controller workspaces)
 *
 * Every leaf carries an explicit `target`, so the arc renders it only when the
 * host actually wires that destination — there are no dead buttons, and the
 * only surfaces reachable from here are immediate commands, the SEI Canvas,
 * and the SAP Controller. A builder (not a constant) so entitlement state can
 * point the Agents › Scout leaf at the right Scout tier per render.
 */
export declare function buildVaultTrackArcActions({ entitlements, }?: BuildVaultTrackArcActionsOptions): ArcAction[];
//# sourceMappingURL=vaultTrackMenu.d.ts.map