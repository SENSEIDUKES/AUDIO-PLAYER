export { AudioPlayer, default } from "./AudioPlayer"
export { useAudioPlayer } from "./useAudioPlayer"
export { useAutomix, AUTOMIX_FADE_MS } from "./automix/useAutomix"
export { PluginManager, type PluginManagerOptions } from "./core/plugins/PluginManager"
export { usePluginManager } from "./core/plugins/usePluginManager"
// Phase 2 plugin error boundary: structured error handling, graceful degradation,
// and recovery for plugins. Host apps can inject a custom PluginErrorHandler.
export {
    PluginError,
    PluginErrorBoundary,
    PluginErrorBoundaryFactory,
    DefaultPluginErrorHandler,
    GracefulDegradation,
    setGlobalErrorHandler,
    getGlobalErrorBoundaryFactory,
    createPluginErrorBoundary,
    withErrorBoundary,
    isPluginError,
} from "./core/plugins/PluginErrorBoundary"
export type {
    PluginErrorHandler,
    ErrorSeverity,
    RecoveryAction,
    ErrorHandlerResult,
    PluginErrorInfo,
} from "./core/plugins/PluginErrorBoundary"
export { createAudioBackend } from "./core/audio/AudioBackendFactory"
export { HTML5AudioBackend } from "./core/audio/HTML5AudioBackend"
export { WebAudioBackend } from "./core/audio/WebAudioBackend"
export { AudioSpriteEngine, createAudioSpriteEngine } from "./core/audio/AudioSpriteEngine"
export {
    AutomixPlugin,
    createAutomixPlugin,
} from "./plugins/AutomixPlugin"
export {
    AutoThemePlugin,
    createAutoThemePlugin,
} from "./plugins/AutoThemePlugin"
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
    WaveformPlugin,
    createWaveformPlugin,
} from "./plugins/WaveformPlugin"
export {
    CueManifestPlugin,
    createCueManifestPlugin,
} from "./cues/CueManifestPlugin"
export { validateCueManifest } from "./cues/cueManifestSchema"
export { CueRuntime } from "./cues/cueRuntime"
export {
    useNarrativeCueController,
} from "./cues/useNarrativeCueController"
export type {
    UseNarrativeCueControllerOptions,
    NarrativeCueControllerState,
} from "./cues/useNarrativeCueController"
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
export {
    getTrackSources,
    getPrimaryTrackSource,
    trackSourcesSignature,
} from "./utils/sources"
export { checkCodecSupport } from "./utils/checkCodecSupport"
export { validateTrackSource } from "./utils/validateTrackSource"
export type { SourceValidationResult } from "./utils/validateTrackSource"
export { isIOS, isMobileDevice, defaultShowVolume } from "./utils/device"
export {
    extractPalette,
    quantizePixels,
    relativeLuminance,
    contrastText,
    rgbToCss,
    gradient,
} from "./utils/colorExtraction"
export { ProgressBar } from "./components/ProgressBar"
export { BackgroundMedia, ensureMuted, resolveMedia } from "./components/BackgroundMedia"
export type {
    BackgroundMediaProps,
    ResolveMediaInput,
    ResolvedMedia,
} from "./components/BackgroundMedia"
export { VolumeControl } from "./components/VolumeControl"
export { WaveformProgress } from "./components/WaveformProgress"
export { WaveformAdapter } from "./components/WaveformAdapter"
export { extractPeaks, computePeaksFromUrl } from "./core/waveform/peaks"
export { QueueDrawer } from "./components/QueueDrawer"
export type { QueueDrawerProps } from "./components/QueueDrawer"
export { SAPController } from "./components/SAPController"
export type {
    SAPControllerProps,
    SAPControllerPlayback,
    SAPControllerQueue,
    SAPControllerInfo,
    SAPControllerShare,
} from "./components/SAPController"
export { useShareTrack } from "./components/useShareTrack"

// Metadata + typography: the reusable TrackMetadata block, the measured marquee,
// the reduced-motion hook, and the pure formatting helpers behind them.
export { TrackMetadata, ExplicitBadge } from "./components/TrackMetadata"
export type {
    TrackMetadataProps,
    TrackMetadataVariant,
} from "./components/TrackMetadata"
export { TextMarquee } from "./components/TextMarquee"
export type { TextMarqueeProps } from "./components/TextMarquee"
export { useReducedMotion } from "./components/useReducedMotion"
export {
    getDisplayTitle,
    getDisplayArtist,
    formatVersionedTitle,
    formatFeatured,
    formatSecondaryLine,
    shouldEnableMarquee,
} from "./utils/formatMetadata"
export type {
    TrackMetadataFields,
    ShouldEnableMarqueeArgs,
} from "./utils/formatMetadata"

// Action Workspace router: the SAP Controller shell, its route model, and the
// placeholder workspace surfaces the radial menu opens.
export {
    WORKSPACE_ROUTES,
    parseWorkspaceRoute,
    isWorkspaceRoute,
} from "./components/workspace/workspaceRoutes"
export type {
    WorkspaceRoute,
    WorkspaceRouteCategory,
    ParsedWorkspaceRoute,
} from "./components/workspace/workspaceRoutes"
export { WorkspaceShell } from "./components/workspace/WorkspaceShell"
export type { WorkspaceShellProps } from "./components/workspace/WorkspaceShell"
export { LibraryPlaylistsWorkspace } from "./components/workspace/LibraryPlaylistsWorkspace"
export { LibraryQueueWorkspace } from "./components/workspace/LibraryQueueWorkspace"
export { PluginSettingsWorkspace } from "./components/workspace/PluginSettingsWorkspace"
export type { PluginSettingsWorkspaceProps } from "./components/workspace/PluginSettingsWorkspace"
export { PlaybackAutomixWorkspace } from "./components/workspace/PlaybackAutomixWorkspace"
export { AgentQueueDirectorWorkspace } from "./components/workspace/AgentQueueDirectorWorkspace"
export { VisualLyricsWorkspace } from "./components/workspace/VisualLyricsWorkspace"
export type { VisualLyricsWorkspaceProps } from "./components/workspace/VisualLyricsWorkspace"

// Visual slot intake layer: a minimal registry + renderers that mount
// Workshop-Light style React components into the player's three visual slots
// (seiCanvas, scrubberCanvas, controllerPanel). Register a component into a slot
// to extend the player without editing its core.
export {
    registerVisualComponent,
    getVisualComponent,
    getVisualComponentsForSlot,
    getDefaultComponentForSlot,
    getAllVisualComponents,
    VisualSlotsProvider,
    useVisualSlots,
    SEICanvasRenderer,
    ScrubberCanvasRenderer,
    ControllerPanelRenderer,
    BUILTIN_VISUAL_COMPONENTS,
    LyricDisplay,
    LyricSettingsPanel,
    lyricDisplayDefinition,
    lyricDefaultSettings,
    LYRIC_DISPLAY_ID,
    VisualSlotPicker,
} from "./visual-slots"
export type {
    VisualSlot,
    VisualPlaybackContext,
    VisualComponentProps,
    VisualSettingsPanelProps,
    VisualComponentDefinition,
    AnyVisualComponentDefinition,
    VisualSlotsContextValue,
    VisualSlotsProviderProps,
    SEICanvasRendererProps,
    ScrubberCanvasRendererProps,
    ControllerPanelRendererProps,
    LyricSettings,
    VisualSlotPickerProps,
} from "./visual-slots"

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
export { serializeSession, deserializeSession } from "./session/sessionSerializer"
export type { SerializedSession } from "./session/sessionSerializer"
export { FullCardPlayer } from "./skins/FullCardPlayer"
export { VaultRowPlayer } from "./skins/VaultRowPlayer"
export { StickyBottomPlayer } from "./skins/StickyBottomPlayer"
export { MiniSidebarPlayer } from "./skins/MiniSidebarPlayer"
export { SeaCardPlayer } from "./skins/SeaCardPlayer"
export { NarrativeFace } from "./skins/NarrativeFace"
// Narrative family: the headless layer orchestrator behind NarrativeFace,
// exposed so reader apps can drive narration/ambience/FX without the UI.
export { useNarrativeAudio } from "./narrative/useNarrativeAudio"
export type {
    UseNarrativeAudioOptions,
    NarrativeAudioController,
    NarrationState,
    SoundscapeIndicatorState,
} from "./narrative/useNarrativeAudio"
export {
    VAULT_CATEGORY_META,
    getVaultCategoryMeta,
    registerVaultCategory,
    clearCustomCategories,
    getAllVaultCategories,
} from "./skins/vaultCategories"
export type { VaultCategoryMeta } from "./skins/vaultCategories"

// Phase 1 surface infrastructure: render zones (SEICanvas, ScrubberCanvas), the
// per-face capability model, shared surface buttons, and hero collapse.
export {
    PLAYER_FACE_CAPABILITIES,
    FAMILY_DEFAULTS,
    getFaceCapability,
    getFaceFamily,
    faceSupportsAction,
    faceSupportsSEICanvas,
    faceSupportsScrubberCanvas,
    faceSupportsContextualActions,
    faceSupportsWaveform,
    faceSupportsHeroCollapse,
    getScrubberDensity,
    getScrubberHeight,
    getPreferredCanvasPlacement,
    INITIAL_SURFACE_STATE,
    canEnterCanvas,
    deriveHeroCollapsed,
    surfaceReducer,
    usePlayerSurface,
    SurfaceButton,
    PlayerSurfaceButtons,
    SEICanvasActionMenu,
    arcOffsets,
    ARC_RADIUS,
    ArcActionButton,
    buildMenuTree,
    isNodeInteractive,
    SEICanvasHost,
    ScrubberCanvasHost,
    PlayerHero,
    QueueSurface,
} from "./surfaces"

export type {
    PlayerFace,
    PlayerFamily,
    PlayerFaceCapability,
    ScrubberDensity,
    PlayerSurfaceMode,
    SurfaceAction,
    SurfaceState,
    UsePlayerSurfaceResult,
    SurfaceButtonProps,
    PlayerSurfaceButtonsProps,
    SEICanvasActionMenuProps,
    ArcOffset,
    ArcAction,
    ArcActionButtonProps,
    MenuNode,
    MenuItemState,
    MenuActionId,
    BuildMenuTreeOptions,
    SEICanvasHostProps,
    ScrubberCanvasHostProps,
    PlayerHeroProps,
    QueueSurfaceProps,
} from "./surfaces"

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
    PluginSoundLayer,
} from "./core/plugins/PluginInterface"
export type {
    AudioSpriteClipDefinition,
    AudioSpriteInstanceId,
    AudioSpriteInstanceInfo,
    AudioSpriteManifest,
    AudioSpritePlayOptions,
} from "./core/audio/AudioSpriteEngine"
export type {
    AudioBackend,
    AudioBackendKind,
    AudioBackendEvent,
    AudioBackendErrorCode,
    AudioBackendInfo,
    AudioBackendCapabilities,
} from "./core/audio/AudioBackend"
export type { WaveformProgressProps } from "./components/WaveformProgress"
export type { WaveformAdapterProps } from "./components/WaveformAdapter"
export type { ComputedPeaks } from "./core/waveform/peaks"
export type { AutomixPluginConfig } from "./plugins/AutomixPlugin"
export type { AutoThemePluginConfig } from "./plugins/AutoThemePlugin"
export type {
    ArtworkPalette,
    ExtractPaletteOptions,
    Rgb,
} from "./utils/colorExtraction"
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
export type { WaveformPluginConfig } from "./plugins/WaveformPlugin"
export type {
    CueAction,
    CueEvent,
    CueManifest,
} from "./cues/cueTypes"
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

// Diagnostics — Activity Log system for recording and viewing lifecycle events.
// Lightweight, bounded, non-blocking. Any component can safely record events.
export {
    ActivityLogProvider,
    useActivityLog,
    useActivityLogRecording,
    ActivityLogPanel,
    ActivityLogWorkspace,
    createActivityLogStore,
    ActivityLogContext,
} from "./diagnostics"
export type {
    ActivityArea,
    ActivityStatus,
    ActivityEvent,
    ActivityLogEntry,
    ActivityLogConfig,
    ActivityLogApi,
    ActivityLogProviderProps,
    UseActivityLogRecordingOptions,
} from "./diagnostics"
export { DEFAULT_ACTIVITY_LOG_CONFIG } from "./diagnostics"

// Plugin surface routing (Phase 1 foundation): declarative contract for where
// each plugin's UI belongs (settings / SEI Canvas / both / headless), pure
// helpers, and a default catalog for the built-in plugins. Metadata only — no
// runtime menu/canvas behavior change.
export {
    hasSettingsSurface,
    hasCanvasSurface,
    isHeadlessPlugin,
    getPluginSettingsRoute,
    getPluginCanvasSurfaceId,
    sortPluginSurfaceDefinitions,
    DEFAULT_PLUGIN_SURFACES,
    getPluginSurfaceDefinition,
    getPluginSurfaceDefinitionsByCategory,
    getPluginSurfaceDefinitionsForMenuBranch,
} from "./plugins/surfaces"
export type {
    PluginSurfaceKind,
    PluginSurfaceCategory,
    PluginMenuBranch,
    PluginSettingsSurface,
    PluginCanvasSurface,
    PluginMenuSurface,
    PluginSurfaceDefinition,
} from "./plugins/surfaces"
// Shared property model: the single registry of editable properties (group,
// control, default, per-face applicability) consumed by faces and the panel.
export {
    PROPERTY_REGISTRY,
    PROPERTY_GROUPS,
    PROPERTY_GROUP_LABELS,
    MAJOR_FACES,
    getPropertiesForFace,
    getPropertiesForGroup,
    getPropertyDefaults,
    getByPropPath,
    setByPropPath,
} from "./properties"
export type {
    PropertyGroup,
    PropertyControl,
    PropertyDescriptor,
    MediaKind,
    MediaSource,
    SelectOption,
} from "./properties"

export type { TransitionPlan } from "./automix/transitionPlanner"
export type {
    Track,
    TrackSource,
    FallbackSourceEvent,
    VaultCategory,
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
    DistanceModelType,
    SpatialAudioOptions,
    SpatialAudioState,
} from "./types"
export type { FullCardPlayerProps } from "./skins/FullCardPlayer"
export type { VaultRowPlayerProps } from "./skins/VaultRowPlayer"
export type { StickyBottomPlayerProps } from "./skins/StickyBottomPlayer"
export type { MiniSidebarPlayerProps } from "./skins/MiniSidebarPlayer"
export type { SeaCardPlayerProps } from "./skins/SeaCardPlayer"
export type { NarrativeFaceProps } from "./skins/NarrativeFace"