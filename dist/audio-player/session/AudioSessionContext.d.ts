import { AudioSessionProviderProps, SessionEngine } from '../types';
/**
 * Owns the one and only `<audio>` element for the app plus the shared queue.
 * Internally reuses `useAudioPlayer` (the proven per-source engine) and drives
 * its `src` from the queue index. Every UI skin reads this via `useAudioSession`
 * and controls the same playback — so interacting with any skin updates all of
 * them, because there is a single audio element behind them.
 */
export declare function AudioSessionProvider({ children, initialQueue, initialIndex, autoPlay, repeatMode: initialRepeat, shuffle: initialShuffle, automix: initialAutomix, plugins: externalPlugins, audioBackend, onFallbackSource, preloadConfig, }: AudioSessionProviderProps): import("react").JSX.Element;
/** Read the global audio session. Throws if used outside an AudioSessionProvider. */
export declare function useAudioSession(): SessionEngine;
//# sourceMappingURL=AudioSessionContext.d.ts.map