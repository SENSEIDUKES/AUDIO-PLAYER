import type {
  AnyVisualComponentDefinition,
  VisualComponentDefinition,
  VisualSlot,
} from "./types";

/**
 * The visual component registry. A plain module-level map keyed by component id.
 * Registration is idempotent (re-registering the same id replaces it), so a host
 * app can override a built-in by registering its own definition under that id.
 *
 * This is deliberately tiny: it is an *intake* layer, not a plugin framework. It
 * holds no state about which component is active or what its settings are — that
 * lives per-player in {@link VisualSlotsProvider}.
 */
const REGISTRY = new Map<string, AnyVisualComponentDefinition>();

/**
 * Secondary index: a Map of component arrays keyed by slot.
 * Provides O(1) access to all components for a given slot.
 */
const BY_SLOT = new Map<VisualSlot, AnyVisualComponentDefinition[]>();

/** Register (or replace) a visual component definition. */
export function registerVisualComponent<S>(
  definition: VisualComponentDefinition<S>,
): void {
  const prev = REGISTRY.get(definition.id);
  const entry = definition as AnyVisualComponentDefinition;

  // 1. Primary registry update
  REGISTRY.set(definition.id, entry);

  // 2. Secondary index (BY_SLOT) update
  // If we're replacing an existing component, update its position in the slot array
  // to maintain Map-like insertion order (idempotency preserves position).
  if (prev) {
    const list = BY_SLOT.get(prev.slot);
    if (list) {
      const idx = list.findIndex((d) => d.id === prev.id);
      if (idx !== -1) {
        if (prev.slot === definition.slot) {
          // Replace in-place to preserve order
          list[idx] = entry;
          return;
        } else {
          // Changed slots: remove from old list
          list.splice(idx, 1);
        }
      }
    }
  }

  // Add to the new slot array (at the end for new components or moved components)
  let list = BY_SLOT.get(definition.slot);
  if (!list) {
    list = [];
    BY_SLOT.set(definition.slot, list);
  }
  list.push(entry);
}

/** Look up a component by id, or `undefined` if not registered. */
export function getVisualComponent(
  id: string | null | undefined,
): AnyVisualComponentDefinition | undefined {
  if (!id) return undefined;
  return REGISTRY.get(id);
}

/** All registered components targeting a given slot, in registration order. */
export function getVisualComponentsForSlot(
  slot: VisualSlot,
): AnyVisualComponentDefinition[] {
  return BY_SLOT.get(slot) ?? [];
}

/**
 * The default component for a slot: the first one registered into it. The lyric
 * display is registered first for `seiCanvas`, so canvas mode shows it on open.
 */
export function getDefaultComponentForSlot(
  slot: VisualSlot,
): AnyVisualComponentDefinition | undefined {
  return BY_SLOT.get(slot)?.[0];
}

/** All registered components (any slot). Used to seed the settings store. */
export function getAllVisualComponents(): AnyVisualComponentDefinition[] {
  return Array.from(REGISTRY.values());
}

/** Iterator over all registered components. Prefer this over getAllVisualComponents() for iteration to avoid array allocation. */
export function getVisualComponentIterator(): IterableIterator<AnyVisualComponentDefinition> {
  return REGISTRY.values();
}
