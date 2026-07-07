import { AnyVisualComponentDefinition } from './types';
/**
 * The built-in visual components SAP ships with. Registered by
 * {@link VisualSlotsProvider} on first mount. Order matters: the first entry for
 * a slot becomes that slot's default (see `getDefaultComponentForSlot`), so the
 * lyric display is the default `seiCanvas` visual and canvas mode shows it
 * immediately instead of a placeholder.
 *
 * To add the next Workshop-Light component: build it under `components/`, scope
 * its CSS, declare a definition, and append it here (or register it from a host
 * app via `registerVisualComponent`). No player-core edits required.
 *
 * Imported skins (from `npm run skin:import`) are spread after the built-ins so
 * LyricDisplay keeps its default position.
 */
export declare const BUILTIN_VISUAL_COMPONENTS: readonly AnyVisualComponentDefinition[];
//# sourceMappingURL=builtins.d.ts.map