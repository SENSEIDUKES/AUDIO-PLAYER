import { ArcAction } from './arcRouting';
/**
 * Entitlements that gate parts of the Vault command wheel. Absent/false means
 * the corresponding leaf renders locked (visible, honest, not tappable).
 */
export interface VaultTrackEntitlements {
    /** Studio Scout is a paid agent; without this it renders locked. */
    studioScout?: boolean;
}
export interface BuildVaultTrackArcActionsOptions {
    entitlements?: VaultTrackEntitlements;
}
/**
 * The Vault face's selected-track command wheel:
 *
 *     Add to Queue › Play Next / Play Later     (immediate queue commands)
 *     Share        › Email / URL                (immediate share commands)
 *     Vault        › Add To / Playlist          (SAP Controller workspaces)
 *     Agent        › Demo Scout / Studio Scout / Memoir (SAP Controller workspaces)
 *
 * Every leaf carries an explicit `target`, so the arc renders it only when the
 * host actually wires that destination — there are no dead buttons, and the
 * only surfaces reachable from here are immediate commands, the SEI Canvas,
 * and the SAP Controller. A builder (not a constant) so entitlement state can
 * flip Studio Scout between routed and locked per render.
 */
export declare function buildVaultTrackArcActions({ entitlements, }?: BuildVaultTrackArcActionsOptions): ArcAction[];
//# sourceMappingURL=vaultTrackMenu.d.ts.map