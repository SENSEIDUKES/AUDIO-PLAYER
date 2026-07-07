import { AudioPlayerPlugin, PluginPlayerContext, PluginHookResult } from '../core/plugins/PluginInterface';
import { Track } from '../types';
export declare class CueManifestPlugin implements AudioPlayerPlugin {
    name: string;
    private context;
    private runtime;
    private abortController;
    init(context: PluginPlayerContext): void;
    destroy(): void;
    private handleDispatchCue;
    private cleanup;
    onTrackLoad(track: Track | null): PluginHookResult;
    onTimeUpdate(position: number): PluginHookResult;
    onSeek(position: number): PluginHookResult;
    onStop(): PluginHookResult;
}
export declare function createCueManifestPlugin(): CueManifestPlugin;
//# sourceMappingURL=CueManifestPlugin.d.ts.map