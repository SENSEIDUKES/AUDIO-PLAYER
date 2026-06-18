import type { AnyVisualComponentDefinition } from "./types"
import { lyricDisplayDefinition } from "./components/LyricDisplay"

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
 */
export const BUILTIN_VISUAL_COMPONENTS: readonly AnyVisualComponentDefinition[] = [
    lyricDisplayDefinition,
]
