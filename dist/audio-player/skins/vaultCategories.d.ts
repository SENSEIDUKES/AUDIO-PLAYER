import { VaultCategory } from '../types';
/** Visual identity for a Vault category: a short status label and an accent color. */
export interface VaultCategoryMeta {
    /** Short, human label shown as the row's status chip. */
    label: string;
    /** Accent color (CSS color) used for the row's category dot/border. */
    color: string;
}
/**
 * Vault category → visual identity. Rows derive their color/status from this map
 * (driven by `Track.vaultCategory`) instead of depending on per-row artwork, so
 * a long list stays fast, clean, and scannable.
 *
 * Colors are plain CSS values so the host can keep using its own theme tokens
 * elsewhere; override per row via the existing `AudioPlayerTheme` props when a
 * different palette is needed.
 */
export declare const VAULT_CATEGORY_META: Record<VaultCategory, VaultCategoryMeta>;
/**
 * Register (or replace) a custom Vault category's visual identity. Call once at
 * startup; rows reading `track.vaultCategory === id` then pick up the label +
 * accent color automatically. Registering under a built-in id overrides it.
 */
export declare function registerVaultCategory(id: string, meta: VaultCategoryMeta): void;
/** Remove all custom registrations, restoring the built-in defaults. Mainly
 *  useful for test isolation, or to reset host-defined categories. */
export declare function clearCustomCategories(): void;
/**
 * Every known category as `[id, meta]` pairs — built-ins first, then custom
 * registrations (custom entries that reuse a built-in id appear once, overridden).
 * Useful for building a category picker.
 */
export declare function getAllVaultCategories(): Array<[string, VaultCategoryMeta]>;
/**
 * Look up a category's visual identity, or `null` when none is set. Accepts any
 * string so custom (host-registered) categories resolve alongside the built-ins;
 * custom registrations win. Unknown values return `null`, keeping the contract
 * honest against unexpected external data.
 */
export declare function getVaultCategoryMeta(category: string | undefined): VaultCategoryMeta | null;
//# sourceMappingURL=vaultCategories.d.ts.map