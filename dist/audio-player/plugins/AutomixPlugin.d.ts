import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
/** Crossfade duration. Conservative fixed value for V1. */
export declare const AUTOMIX_FADE_MS = 5500;
export interface AutomixPluginConfig {
    name?: string;
    /** Master switch. When false the plugin does nothing at all. */
    enabled?: boolean;
    /**
     * Minimum normalized rhythm confidence (0..1) required before beat/BPM
     * analysis steers a transition. Pairs below this — or with no analysis at
     * all — fall back automatically to light-mode (silence-trim) crossfades.
     */
    confidenceMin?: number;
    /** Optional bridge for React UIs that want to expose transition state. */
    onTransitionChange?: (isTransitioning: boolean) => void;
}
/**
 * Automix as a lifecycle plugin.
 *
 * One plugin, automatic fallback: it always attempts rich, beat/BPM-aware
 * transitions (the "pro" path) and degrades per track-pair to light-mode
 * silence-trim crossfades whenever rhythm analysis is unavailable, the browser
 * locks element volume, or confidence is below `confidenceMin`.
 *
 * The implementation intentionally mirrors the legacy `useAutomix` hook: the
 * main engine audio element remains deck A/source-of-truth, while this plugin
 * owns one detached deck B only around a transition.
 */
export declare class AutomixPlugin implements AudioPlayerPlugin {
    readonly name: string;
    private context;
    private enabled;
    private readonly onTransitionChange?;
    private phase;
    private deck;
    private deckAbort;
    private preloadedKey;
    private fadeInterval;
    private fadeT0;
    private fadeAnchor;
    private pendingHandoff;
    private handoffAbort;
    private handoffTimer;
    private failedPair;
    private prevSourceKey;
    private transitioning;
    private readonly confidenceMin;
    private plan;
    private activeFadeMs;
    constructor(config?: AutomixPluginConfig);
    get isTransitioning(): boolean;
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    updateConfig(config: Pick<AutomixPluginConfig, "enabled">): void;
    onTrackLoad: (track: Track | null) => void;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (_position: number) => void;
    onTimeUpdate: (_position: number) => void;
    onTrackEnded: () => boolean;
    /** Legacy controller bridge used by `useAutomix`. */
    handleTrackEnded(): boolean;
    private analyzeCurrentTrack;
    /**
     * Whether to attempt rich (beat/BPM-aware) analysis. Always on, except
     * where fades can't run at all (volume-locked browsers), since beat-aware
     * timing is pointless without crossfades. Per-pair confidence still decides
     * whether a given transition uses the rich plan or the light fallback.
     */
    private usePro;
    private ensureAnalysis;
    /** Trims from the Pro analysis when available, else the Lite silence scan. */
    private effectiveTrims;
    /**
     * Where deck B should be parked before the fade, in milliseconds. The
     * beat-aligned entry point applies only while a confident pair plan is
     * active; any fallback parks at the silence trim start exactly like Lite,
     * so low-confidence beat guesses never skip the next track's intro.
     */
    private deckStartMs;
    private setTransitioning;
    private stopRamp;
    private releaseDeck;
    private clearHandoff;
    /** Abort any in-flight transition and restore normal playback audio. */
    private cancel;
    /**
     * The fade is over (ramp completed, or A reached its natural end first).
     * Mark the upcoming source change as ours; optionally trigger it.
     */
    private finalizeFade;
    /** Wire deck B for the resolved next track and park it at its trim start. */
    private startPreload;
    /**
     * Equal-power ramp driven by wall-clock setInterval (keeps progressing in
     * throttled background tabs, unlike rAF). Re-reads the user volume every
     * tick so a mid-fade volume change re-targets instead of fighting.
     */
    private runRamp;
    private startFade;
    /**
     * After requestAdvance, the host swaps sources and the engine reloads the
     * main element with B's URL. Sync it to deck B's position and flip the
     * audible output back to the main element on its first 'playing'.
     */
    private attachHandoff;
    private supervise;
}
/**
 * Create the Automix plugin. BPM/beat/energy analysis steers fade timing and
 * length when available; any pair without trustworthy analysis falls back to
 * light-mode silence-trim crossfades automatically.
 */
export declare function createAutomixPlugin(config?: AutomixPluginConfig): AutomixPlugin;
//# sourceMappingURL=AutomixPlugin.d.ts.map