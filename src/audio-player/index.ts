export { AudioPlayer, default } from "./AudioPlayer"
export { useAudioPlayer } from "./useAudioPlayer"
export { useAutomix, AUTOMIX_FADE_MS } from "./automix/useAutomix"
export {
    ensureTrackAnalysis,
    getTrackTrims,
} from "./automix/silenceAnalysis"
export { formatTime } from "./utils/formatTime"
export { trackKey } from "./utils/trackKey"
export { ProgressBar } from "./components/ProgressBar"
export { VolumeControl } from "./components/VolumeControl"

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
