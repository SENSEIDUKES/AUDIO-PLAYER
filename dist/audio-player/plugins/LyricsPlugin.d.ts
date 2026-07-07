import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
export interface TimedLyricLine {
    time: number;
    text: string;
}
export interface LyricsPluginConfig {
    name?: string;
    lyrics?: string;
    lines?: TimedLyricLine[];
    onLineChange?: (line: TimedLyricLine | null, index: number, track: Track | null) => void;
    target?: HTMLElement | (() => HTMLElement | null);
}
/** Syncs LRC-style lyrics with playback and optionally writes the active line to a DOM node. */
export declare class LyricsPlugin implements AudioPlayerPlugin {
    readonly name: string;
    private readonly configuredLyrics?;
    private readonly configuredLines?;
    private readonly onLineChangeCallback?;
    private readonly target?;
    private context;
    private lines;
    private activeIndex;
    constructor(config?: LyricsPluginConfig);
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    onTrackLoad: (track: Track | null) => void;
    onTimeUpdate: (position: number) => void;
    private loadLyrics;
    private findTimedLine;
    private findApproximateLine;
    private writeTarget;
}
export declare function createLyricsPlugin(config?: LyricsPluginConfig): LyricsPlugin;
//# sourceMappingURL=LyricsPlugin.d.ts.map