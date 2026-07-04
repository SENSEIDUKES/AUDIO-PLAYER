import { AnyVisualComponentDefinition, VisualComponentDefinition, VisualSlot } from './types';
/** Register (or replace) a visual component definition. */
export declare function registerVisualComponent<S>(definition: VisualComponentDefinition<S>): void;
/** Look up a component by id, or `undefined` if not registered. */
export declare function getVisualComponent(id: string | null | undefined): AnyVisualComponentDefinition | undefined;
/** All registered components targeting a given slot, in registration order. */
export declare function getVisualComponentsForSlot(slot: VisualSlot): AnyVisualComponentDefinition[];
/**
 * The default component for a slot: the first one registered into it. The lyric
 * display is registered first for `seiCanvas`, so canvas mode shows it on open.
 */
export declare function getDefaultComponentForSlot(slot: VisualSlot): AnyVisualComponentDefinition | undefined;
/** All registered components (any slot). Used to seed the settings store. */
export declare function getAllVisualComponents(): AnyVisualComponentDefinition[];
//# sourceMappingURL=visualRegistry.d.ts.map