import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import { computePeaksFromUrl } from "../core/waveform/peaks"

export interface WaveformPluginConfig {
    name?: string
    /**
     * Pre-warm the peaks cache on track load so the waveform paints instantly
     * when the scrubber mounts. Best-effort: failures (CORS, missing file) are
     * swallowed and the waveform falls back to its own resolution path. Default
     * true.
     */
    prewarmPeaks?: boolean
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
export class WaveformPlugin implements AudioPlayerPlugin {
    readonly name: string
    readonly providesWaveform = true
    private readonly prewarmPeaks: boolean
    private prewarmed: string | null = null

    constructor(config: WaveformPluginConfig = {}) {
        this.name = config.name ?? "waveform"
        this.prewarmPeaks = config.prewarmPeaks ?? true
    }

    init(playerInstance: PluginPlayerContext) {
        this.warm(playerInstance.getCurrentTrack())
    }

    destroy() {
        this.prewarmed = null
    }

    onTrackLoad(track: Track | null) {
        this.warm(track)
    }

    /** Best-effort peaks pre-warm; never throws into the host. */
    private warm(track: Track | null) {
        if (!this.prewarmPeaks) return
        const url = track?.audioFile
        // Tracks shipping their own peaks need no fetch+decode pass.
        if (!url || track?.peaks || this.prewarmed === url) return
        this.prewarmed = url
        void computePeaksFromUrl(url).catch(() => {
            // Ignore: the waveform component resolves peaks on its own and falls
            // back to the progress bar if none can be produced.
        })
    }
}

/** Factory mirroring the other registry plugins (fresh instance per install). */
export function createWaveformPlugin(
    config: WaveformPluginConfig = {}
): AudioPlayerPlugin {
    return new WaveformPlugin(config)
}
