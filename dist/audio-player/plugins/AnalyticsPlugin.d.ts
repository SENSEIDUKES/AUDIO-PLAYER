import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
export type AnalyticsEventType = "track_load" | "play" | "pause" | "stop" | "seek" | "time_update" | "track_ended";
export interface AnalyticsEventPayload {
    type: AnalyticsEventType;
    track: Track | null;
    sourceKey: string;
    position: number;
    duration: number;
    timestamp: number;
    plugin: string;
}
export interface AnalyticsPluginConfig {
    name?: string;
    endpoint?: string;
    send?: (event: AnalyticsEventPayload) => void | Promise<void>;
    includeTimeUpdates?: boolean;
    timeUpdateIntervalSeconds?: number;
}
/** Small analytics adapter. Provide `send` or `endpoint` to emit events. */
export declare class AnalyticsPlugin implements AudioPlayerPlugin {
    readonly name: string;
    private readonly endpoint?;
    private readonly sendCallback?;
    private readonly includeTimeUpdates;
    private readonly timeUpdateIntervalSeconds;
    private context;
    private lastTimeUpdateBucket;
    constructor(config?: AnalyticsPluginConfig);
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    onTrackLoad: (_track: Track | null) => void;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSeek: (position: number) => void;
    onTrackEnded: () => void;
    onTimeUpdate: (position: number) => void;
    private emit;
}
export declare function createAnalyticsPlugin(config?: AnalyticsPluginConfig): AnalyticsPlugin;
//# sourceMappingURL=AnalyticsPlugin.d.ts.map