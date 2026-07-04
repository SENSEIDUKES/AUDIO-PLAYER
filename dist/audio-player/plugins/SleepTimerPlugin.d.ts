import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
export type SleepTimerPreset = "off" | "15m" | "30m" | "45m" | "60m" | "track-end";
export interface SleepTimerState {
    preset: SleepTimerPreset;
    deadlineMs: number | null;
    remainingMs: number | null;
}
export interface SleepTimerPluginConfig {
    name?: string;
    label?: string;
    renderUi?: boolean;
    target?: HTMLElement | (() => HTMLElement | null) | null;
    now?: () => number;
}
/** Adds a scoped sleep-timer dropdown and pauses playback when the timer expires. */
export declare class SleepTimerPlugin implements AudioPlayerPlugin {
    readonly name: string;
    private readonly label;
    private readonly renderUi;
    private readonly target?;
    private readonly now;
    private context;
    private preset;
    private deadlineMs;
    private timeoutId;
    private container;
    private select;
    constructor(config?: SleepTimerPluginConfig);
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    setTimer(preset: SleepTimerPreset): void;
    getActiveTimer(): SleepTimerState;
    onTrackEnded: (_track: Track | null) => true | undefined;
    private expire;
    private pauseAndReset;
    private clearCountdown;
    private mountUi;
    private unmountUi;
    private resolveTarget;
    private syncSelect;
    private handleSelectChange;
}
export declare function createSleepTimerPlugin(config?: SleepTimerPluginConfig): SleepTimerPlugin;
//# sourceMappingURL=SleepTimerPlugin.d.ts.map