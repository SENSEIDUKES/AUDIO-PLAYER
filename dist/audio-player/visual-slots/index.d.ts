export type { VisualSlot, VisualPlaybackContext, VisualComponentProps, VisualSettingsPanelProps, VisualComponentDefinition, AnyVisualComponentDefinition, } from './types';
export { registerVisualComponent, getVisualComponent, getVisualComponentsForSlot, getDefaultComponentForSlot, getAllVisualComponents, } from './visualRegistry';
export { VisualSlotsProvider, useVisualSlots, } from './VisualSlotsContext';
export type { VisualSlotsContextValue, VisualSlotsProviderProps, } from './VisualSlotsContext';
export { SEICanvasRenderer } from './SEICanvasRenderer';
export type { SEICanvasRendererProps } from './SEICanvasRenderer';
export { ScrubberCanvasRenderer } from './ScrubberCanvasRenderer';
export type { ScrubberCanvasRendererProps } from './ScrubberCanvasRenderer';
export { ControllerPanelRenderer } from './ControllerPanelRenderer';
export type { ControllerPanelRendererProps } from './ControllerPanelRenderer';
export { BUILTIN_VISUAL_COMPONENTS } from './builtins';
export { LyricDisplay, LyricSettingsPanel, lyricDisplayDefinition, lyricDefaultSettings, LYRIC_DISPLAY_ID, } from './components/LyricDisplay';
export type { LyricSettings } from './components/LyricDisplay';
export { VisualSlotPicker } from './VisualSlotPicker';
export type { VisualSlotPickerProps } from './VisualSlotPicker';
//# sourceMappingURL=index.d.ts.map