import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
export interface WaveformPluginConfig {
    name?: string;
    /**
     * Pre-warm the peaks cache on track load so the waveform paints instantly
     * when the scrubber mounts. Best-effort: failures (CORS, missing file) are
     * swallowed and the waveform falls back to its own resolution path. Default
     * true.
     */
    prewarmPeaks?: boolean;
}
/**
 * Waveform: a marker plugin that switches a standalone player's scrubber from
 * the plain progress bar to the interactive wavesurfer waveform.
 *
 * It owns no playback behavior — it sets `providesWaveform`, which the
 * `AudioPlayer` detects to render the waveform (gated by the player's "Show
 * Waveform" toggle). Its only side effect is an optional best-effort peaks
 * pre-warm via `computePeaksFromUrl`, so removing it cannot disturb playback.
 */
export declare class WaveformPlugin implements AudioPlayerPlugin {
    readonly name: string;
    readonly providesWaveform = true;
    private readonly prewarmPeaks;
    private prewarmed;
    constructor(config?: WaveformPluginConfig);
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    onTrackLoad(track: Track | null): void;
    /** Best-effort peaks pre-warm; never throws into the host. */
    private warm;
}
/** Factory mirroring the other registry plugins (fresh instance per install). */
export declare function createWaveformPlugin(config?: WaveformPluginConfig): AudioPlayerPlugin;
//# sourceMappingURL=WaveformPlugin.d.ts.map