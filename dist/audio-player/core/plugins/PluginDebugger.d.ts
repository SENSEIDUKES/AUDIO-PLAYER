export interface PluginDebugInfo {
    name: string;
    initialized: boolean;
    lastHookCalled: string | null;
    lastHookTime: number | null;
    errorCount: number;
    memoryUsage?: number;
}
export declare class PluginDebugger {
    private debugMode;
    private hooks;
    constructor();
    measure<T>(plugin: string, hook: string, fn: () => T): T;
    measureAsync<T>(plugin: string, hook: string, fn: () => Promise<T>): Promise<T>;
    getMemoryUsage(): number | undefined;
}
//# sourceMappingURL=PluginDebugger.d.ts.map