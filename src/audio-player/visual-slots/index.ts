// Visual slot intake layer: a minimal, practical way to mount Workshop-Light
// style React components into the player's three visual slots (seiCanvas,
// scrubberCanvas, controllerPanel) without rewriting the player core.

export type {
    VisualSlot,
    VisualPlaybackContext,
    VisualComponentProps,
    VisualSettingsPanelProps,
    VisualComponentDefinition,
    AnyVisualComponentDefinition,
} from "./types"

export {
    registerVisualComponent,
    getVisualComponent,
    getVisualComponentsForSlot,
    getDefaultComponentForSlot,
    getAllVisualComponents,
} from "./visualRegistry"

export {
    VisualSlotsProvider,
    useVisualSlots,
} from "./VisualSlotsContext"
export type {
    VisualSlotsContextValue,
    VisualSlotsProviderProps,
} from "./VisualSlotsContext"

export { SEICanvasRenderer } from "./SEICanvasRenderer"
export type { SEICanvasRendererProps } from "./SEICanvasRenderer"
export { ScrubberCanvasRenderer } from "./ScrubberCanvasRenderer"
export type { ScrubberCanvasRendererProps } from "./ScrubberCanvasRenderer"
export { ControllerPanelRenderer } from "./ControllerPanelRenderer"
export type { ControllerPanelRendererProps } from "./ControllerPanelRenderer"

export { BUILTIN_VISUAL_COMPONENTS } from "./builtins"
export {
    LyricDisplay,
    LyricSettingsPanel,
    lyricDisplayDefinition,
    lyricDefaultSettings,
    LYRIC_DISPLAY_ID,
} from "./components/LyricDisplay"
export type { LyricSettings } from "./components/LyricDisplay"
