export { AudioPlayer, default } from "./AudioPlayer"
export { useAudioPlayer } from "./useAudioPlayer"
export { useAutomix, AUTOMIX_FADE_MS } from "./automix/useAutomix"
export { PluginManager } from "./core/plugins/PluginManager"
export { usePluginManager } from "./core/plugins/usePluginManager"
export { createAudioBackend } from "./core/audio/AudioBackendFactory"
export { HTML5AudioBackend } from "./core/audio/HTML5AudioBackend"
export { WebAudioBackend } from "./core/audio/WebAudioBackend"
export {
    AutomixPlugin,
    createAutomixPlugin,
} from "./plugins/AutomixPlugin"
export {
    KeyboardShortcutPlugin,
    createKeyboardShortcutPlugin,
} from "./plugins/KeyboardShortcutPlugin"
export {
    AnalyticsPlugin,
    createAnalyticsPlugin,
} from "./plugins/AnalyticsPlugin"
export {
    LyricsPlugin,
    createLyricsPlugin,
} from "./plugins/LyricsPlugin"
export {
    ensureTrackAnalysis,
    getTrackTrims,
} from "./automix/silenceAnalysis"
export { formatTime } from "./utils/formatTime"
export { trackKey } from "./utils/trackKey"
export { checkCodecSupport } from "./utils/checkCodecSupport"
export { ProgressBar } from "./components/ProgressBar"
export { VolumeControl } from "./components/VolumeControl"

// Headless adapter layer: Downshift-style prop getters and utilities over an
// existing engine/session — no styling, no second engine.
export {
    composeEventHandlers,
    isSAPDefaultPrevented,
    mergeRefs,
    useSAPPropGetters,
    isSessionEngine,
    useMediaSessionObserver,
} from "./headless"
export type {
    SAPButtonProps,
    SAPProgressBarProps,
    SAPAudioElementProps,
    SAPPropGetters,
    UseSAPPropGettersOptions,
    UseMediaSessionObserverOptions,
} from "./headless"

// Global session (one <audio> element + shared queue) and the UI skins that
// read from it.
export {
    AudioSessionProvider,
    useAudioSession,
} from "./session/AudioSessionContext"
export { FullCardPlayer } from "./skins/FullCardPlayer"
export { VaultRowPlayer } from "./skins/VaultRowPlayer"
export { StickyBottomPlayer } from "./skins/StickyBottomPlayer"
export { MiniSidebarPlayer } from "./skins/MiniSidebarPlayer"
export { SeaCardPlayer } from "./skins/SeaCardPlayer"

export type {
    UseAutomixOptions,
    AutomixController,
} from "./automix/useAutomix"
export type {
    AudioPlayerPlugin,
    PluginHookArgs,
    PluginHookName,
    PluginHookResult,
    PluginPlayerContext,
} from "./core/plugins/PluginInterface"
export type {
    AudioBackend,
    AudioBackendKind,
    AudioBackendEvent,
    AudioBackendErrorCode,
    AudioBackendInfo,
    AudioBackendCapabilities,
} from "./core/audio/AudioBackend"
export type { AutomixPluginConfig } from "./plugins/AutomixPlugin"
export type { KeyboardShortcutPluginConfig } from "./plugins/KeyboardShortcutPlugin"
export type {
    AnalyticsEventPayload,
    AnalyticsEventType,
    AnalyticsPluginConfig,
} from "./plugins/AnalyticsPlugin"
export type {
    LyricsPluginConfig,
    TimedLyricLine,
} from "./plugins/LyricsPlugin"
export type {
    Track,
    TrackTrims,
    AudioPlayerProps,
    AudioPlayerTheme,
    BackgroundImage,
    UseAudioPlayerOptions,
    AudioPlayerEngine,
    SessionEngine,
    RepeatMode,
    AudioSessionProviderProps,
} from "./types"
export type { FullCardPlayerProps } from "./skins/FullCardPlayer"
export type { VaultRowPlayerProps } from "./skins/VaultRowPlayer"
export type { StickyBottomPlayerProps } from "./skins/StickyBottomPlayer"
export type { MiniSidebarPlayerProps } from "./skins/MiniSidebarPlayer"
export type { SeaCardPlayerProps } from "./skins/SeaCardPlayer"
