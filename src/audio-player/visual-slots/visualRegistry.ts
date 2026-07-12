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
 * Secondary index by slot to make slot lookups O(1).
 * Maps each slot to an array of registered components in registration order.
 */
const BY_SLOT = new Map<VisualSlot, AnyVisualComponentDefinition[]>();

/** Register (or replace) a visual component definition. */
export function registerVisualComponent<S>(
  definition: VisualComponentDefinition<S>,
): void {
  const id = definition.id;
  const slot = definition.slot;
  const anyDef = definition as AnyVisualComponentDefinition;

  // 1. Handle REGISTRY (Idempotent: replaces if exists)
  const existing = REGISTRY.get(id);
  REGISTRY.set(id, anyDef);

  // 2. Handle BY_SLOT index
  if (existing) {
    const oldSlot = existing.slot;
    const list = BY_SLOT.get(oldSlot);
    if (list) {
      const idx = list.findIndex((d) => d.id === id);
      if (idx !== -1) {
        if (oldSlot === slot) {
          // Same slot: replace in situ to preserve registration order
          list[idx] = anyDef;
          return;
        } else {
          // Changed slot: remove from old list
          list.splice(idx, 1);
        }
      }
    }
  }

  // Add to new slot list (preserves registration order for new components)
  let list = BY_SLOT.get(slot);
  if (!list) {
    list = [];
    BY_SLOT.set(slot, list);
  }
  list.push(anyDef);
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
  const list = BY_SLOT.get(slot);
  return list ? [...list] : [];
}

/**
 * The default component for a slot: the first one registered into it. The lyric
 * display is registered first for `seiCanvas`, so canvas mode shows it on open.
 */
export function getDefaultComponentForSlot(
  slot: VisualSlot,
): AnyVisualComponentDefinition | undefined {
  const list = BY_SLOT.get(slot);
  return list?.[0];
}

/** All registered components (any slot). Used to seed the settings store. */
export function getAllVisualComponents(): AnyVisualComponentDefinition[] {
  return Array.from(REGISTRY.values());
}

/** Iterator over all registered components. Prefer this over getAllVisualComponents() for iteration to avoid array allocation. */
export function getVisualComponentIterator(): IterableIterator<AnyVisualComponentDefinition> {
  return REGISTRY.values();
}
