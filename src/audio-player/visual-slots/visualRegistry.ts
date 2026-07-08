import type {
    AnyVisualComponentDefinition,
    VisualComponentDefinition,
    VisualSlot,
} from "./types"

/**
 * The visual component registry. A plain module-level map keyed by component id.
 * Registration is idempotent (re-registering the same id replaces it), so a host
 * app can override a built-in by registering its own definition under that id.
 *
 * This is deliberately tiny: it is an *intake* layer, not a plugin framework. It
 * holds no state about which component is active or what its settings are — that
 * lives per-player in {@link VisualSlotsProvider}.
 */
const REGISTRY = new Map<string, AnyVisualComponentDefinition>()

/** Register (or replace) a visual component definition. */
export function registerVisualComponent<S>(
    definition: VisualComponentDefinition<S>
): void {
    REGISTRY.set(definition.id, definition as AnyVisualComponentDefinition)
}

/** Look up a component by id, or `undefined` if not registered. */
export function getVisualComponent(
    id: string | null | undefined
): AnyVisualComponentDefinition | undefined {
    if (!id) return undefined
    return REGISTRY.get(id)
}

/** All registered components targeting a given slot, in registration order. */
export function getVisualComponentsForSlot(
    slot: VisualSlot
): AnyVisualComponentDefinition[] {
    const out: AnyVisualComponentDefinition[] = []
    for (const def of REGISTRY.values()) {
        if (def.slot === slot) out.push(def)
    }
    return out
}

/**
 * The default component for a slot: the first one registered into it. The lyric
 * display is registered first for `seiCanvas`, so canvas mode shows it on open.
 */
export function getDefaultComponentForSlot(
    slot: VisualSlot
): AnyVisualComponentDefinition | undefined {
    for (const def of REGISTRY.values()) {
        if (def.slot === slot) return def
    }
    return undefined
}

/** All registered components (any slot). Used to seed the settings store. */
export function getAllVisualComponents(): AnyVisualComponentDefinition[] {
    return Array.from(REGISTRY.values())
}

/** Iterator over all registered components. Prefer this over getAllVisualComponents() for iteration to avoid array allocation. */
export function getVisualComponentIterator(): IterableIterator<AnyVisualComponentDefinition> {
    return REGISTRY.values()
}
