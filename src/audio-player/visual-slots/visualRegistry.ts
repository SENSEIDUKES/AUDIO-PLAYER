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
const BY_SLOT = new Map<VisualSlot, AnyVisualComponentDefinition[]>();

/** Register (or replace) a visual component definition. */
export function registerVisualComponent<S>(
  definition: VisualComponentDefinition<S>,
): void {
  const id = definition.id;
  const oldDef = REGISTRY.get(id);

  // Registration is idempotent: if it's already there in the same slot,
  // just update the definition and keep its position in the slot list.
  if (oldDef && oldDef.slot === definition.slot) {
    REGISTRY.set(id, definition as AnyVisualComponentDefinition);
    const list = BY_SLOT.get(definition.slot);
    if (list) {
      const idx = list.findIndex((d) => d.id === id);
      if (idx !== -1) {
        list[idx] = definition as AnyVisualComponentDefinition;
        return;
      }
    }
  }

  // If it's moving slots or new, remove from old slot list first.
  if (oldDef) {
    const list = BY_SLOT.get(oldDef.slot);
    if (list) {
      const idx = list.findIndex((d) => d.id === id);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  REGISTRY.set(id, definition as AnyVisualComponentDefinition);

  let list = BY_SLOT.get(definition.slot);
  if (!list) {
    list = [];
    BY_SLOT.set(definition.slot, list);
  }
  list.push(definition as AnyVisualComponentDefinition);
}

/** Look up a component by id, or `undefined` if not registered. */
export function getVisualComponent(
  id: string | null | undefined,
): AnyVisualComponentDefinition | undefined {
  if (!id) return undefined;
  return REGISTRY.get(id);
}

/**
 * All registered components targeting a given slot, in registration order.
 * Performs O(1) lookup.
 */
export function getVisualComponentsForSlot(
  slot: VisualSlot,
): AnyVisualComponentDefinition[] {
  return BY_SLOT.get(slot) ?? [];
}

/**
 * The default component for a slot: the first one registered into it. The lyric
 * display is registered first for `seiCanvas`, so canvas mode shows it on open.
 * Performs O(1) lookup.
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
