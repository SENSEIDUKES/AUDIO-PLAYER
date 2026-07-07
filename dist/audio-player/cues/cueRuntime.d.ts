import { PluginPlayerContext } from '../core/plugins/PluginInterface';
import { CueManifest } from './cueTypes';
export declare class CueRuntime {
    private context;
    private firedCueIds;
    private timeCues;
    private cueMap;
    private triggerMap;
    private lastTime;
    private activeSprites;
    constructor(context: PluginPlayerContext, manifest: CueManifest);
    reset(): void;
    handleTimeUpdate(currentTime: number, isSeeking?: boolean): void;
    /** Manually execute a cue by its ID, ignoring time checks. */
    executeCueById(id: string): void;
    /** Execute any cues matching the given trigger kind and value. */
    executeCueByTrigger(kind: string, value: string | number): void;
    private executeActions;
}
//# sourceMappingURL=cueRuntime.d.ts.map