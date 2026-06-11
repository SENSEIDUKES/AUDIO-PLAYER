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
    createAutomixProPlugin,
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
    SleepTimerPlugin,
    createSleepTimerPlugin,
} from "./plugins/SleepTimerPlugin"
export {
    ensureTrackAnalysis,
    getTrackTrims,
} from "./automix/silenceAnalysis"
// Automix Pro metadata layer. Pure helpers are exported for host apps that
// want to score queues or display analysis; none of them pull in the essentia
// worker chunk — that loads only when a Pro analysis actually runs.
export {
    ensureProTrackAnalysis,
    getTrackAnalysis,
} from "./automix/trackAnalysis"
export {
    PRO_CONFIDENCE_MIN,
    bpmCompatibility,
    computeTransitionPoints,
    normalizeRhythmConfidence,
    planTransition,
    snapToBeat,
} from "./automix/transitionPlanner"
export { formatTime } from "./utils/formatTime"
export { trackKey } from "./utils/trackKey"
export { checkCodecSupport } from "./utils/checkCodecSupport"
export { ProgressBar } from "./components/ProgressBar"
export { VolumeControl } from "./components/VolumeControl"
export { WaveformProgress } from "./components/WaveformProgress"
export { extractPeaks, computePeaksFromUrl } from "./core/waveform/peaks"
export { QueueDrawer } from "./components/QueueDrawer"
export type { QueueDrawerProps } from "./components/QueueDrawer"

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
export type { WaveformProgressProps } from "./components/WaveformProgress"
export type { ComputedPeaks } from "./core/waveform/peaks"
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
    SleepTimerPluginConfig,
    SleepTimerPreset,
    SleepTimerState,
} from "./plugins/SleepTimerPlugin"
export {
    PluginRegistryProvider,
    usePluginRegistry,
    useActivePluginInstances,
} from "./plugins/registry/usePluginRegistry"
export { PluginManagerPanel } from "./plugins/registry/PluginManagerPanel"
export type {
    PluginRegistryEntry,
    InstalledPluginRecord,
    PluginRegistrySnapshot,
} from "./plugins/registry/usePluginRegistry"
export type { TransitionPlan } from "./automix/transitionPlanner"
export type {
    Track,
    TrackTrims,
    TrackAnalysis,
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