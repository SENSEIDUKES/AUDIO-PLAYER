import type { VaultCategory } from "../types"

/** Visual identity for a Vault category: a short status label and an accent color. */
export interface VaultCategoryMeta {
    /** Short, human label shown as the row's status chip. */
    label: string
    /** Accent color (CSS color) used for the row's category dot/border. */
    color: string
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
export const VAULT_CATEGORY_META: Record<VaultCategory, VaultCategoryMeta> = {
    demo: { label: "Demo", color: "#7C5CFF" },
    beat: { label: "Beat", color: "#22D3A6" },
    mix: { label: "Mix", color: "#38BDF8" },
    master: { label: "Master", color: "#F5C451" },
    memo: { label: "Memo", color: "#A1A1AA" },
    arcNote: { label: "Arc Note", color: "#FB7185" },
    toFinish: { label: "To Finish", color: "#FB923C" },
    archived: { label: "Archived", color: "#6B7280" },
}

/**
 * Host-registered custom categories. Kept in a Map (mirroring the visual-slots
 * registry) so apps can add their own classifications — or recolor a built-in —
 * without editing the library. Checked before the built-ins so a registration
 * can override a built-in id.
 */
const CUSTOM_CATEGORIES = new Map<string, VaultCategoryMeta>()

/**
 * Register (or replace) a custom Vault category's visual identity. Call once at
 * startup; rows reading `track.vaultCategory === id` then pick up the label +
 * accent color automatically. Registering under a built-in id overrides it.
 */
export function registerVaultCategory(id: string, meta: VaultCategoryMeta): void {
    CUSTOM_CATEGORIES.set(id, meta)
}

/** Remove all custom registrations, restoring the built-in defaults. Mainly
 *  useful for test isolation, or to reset host-defined categories. */
export function clearCustomCategories(): void {
    CUSTOM_CATEGORIES.clear()
}

/**
 * Every known category as `[id, meta]` pairs — built-ins first, then custom
 * registrations (custom entries that reuse a built-in id appear once, overridden).
 * Useful for building a category picker.
 */
export function getAllVaultCategories(): Array<[string, VaultCategoryMeta]> {
    const merged = new Map<string, VaultCategoryMeta>(Object.entries(VAULT_CATEGORY_META))
    for (const [id, meta] of CUSTOM_CATEGORIES) merged.set(id, meta)
    return Array.from(merged.entries())
}

/**
 * Look up a category's visual identity, or `null` when none is set. Accepts any
 * string so custom (host-registered) categories resolve alongside the built-ins;
 * custom registrations win. Unknown values return `null`, keeping the contract
 * honest against unexpected external data.
 */
export function getVaultCategoryMeta(category: string | undefined): VaultCategoryMeta | null {
    if (!category) return null
    // `hasOwnProperty` guards against inherited prototype keys: now that the
    // field accepts any string, a value like "toString"/"constructor" would
    // otherwise resolve to a Function.prototype member instead of null.
    if (CUSTOM_CATEGORIES.has(category)) return CUSTOM_CATEGORIES.get(category)!
    return Object.prototype.hasOwnProperty.call(VAULT_CATEGORY_META, category)
        ? VAULT_CATEGORY_META[category as VaultCategory]
        : null
}
