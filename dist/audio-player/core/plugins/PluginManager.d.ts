import { AudioPlayerPlugin, PluginHookArgs, PluginHookName, PluginPlayerContext } from './PluginInterface';
import { PluginErrorHandler, PluginErrorBoundary } from './PluginErrorBoundary';
import { PluginDebugInfo } from './PluginDebugger';
/** Configuration options for PluginManager error handling */
export interface PluginManagerOptions {
    /** Custom error handler for all plugins */
    errorHandler?: PluginErrorHandler;
    /** Maximum failures before a plugin is disabled (used by default handler) */
    maxFailuresBeforeDisable?: number;
}
/** Register plugins and safely dispatch player lifecycle hooks. */
export declare class PluginManager {
    private readonly plugins;
    private context;
    private errorBoundaryFactory;
    private readonly defaultOptions;
    private readonly debugger;
    constructor(context: PluginPlayerContext, options?: PluginManagerOptions);
    setContext(context: PluginPlayerContext): void;
    /**
     * Set a custom error handler for future plugin registrations
     * Note: Already registered plugins keep their original error boundaries
     */
    setErrorHandler(handler: PluginErrorHandler): void;
    register(plugin: AudioPlayerPlugin): void;
    unregister(name: string): void;
    replace(nextPlugins: readonly AudioPlayerPlugin[]): void;
    clear(): void;
    has(name: string): boolean;
    list(): AudioPlayerPlugin[];
    /**
     * Get health and debug status for all plugins
     */
    getDebugStatus(): PluginDebugInfo[];
    /**
     * Get the error boundary for a specific plugin
     */
    getErrorBoundary(pluginName: string): PluginErrorBoundary | undefined;
    /**
     * Check if a plugin is disabled due to errors
     */
    isPluginDisabled(pluginName: string): boolean;
    /**
     * Manually re-enable a disabled plugin
     */
    enablePlugin(pluginName: string): boolean;
    trigger<K extends PluginHookName>(hook: K, ...args: PluginHookArgs[K]): unknown[];
    triggerUntilHandled<K extends PluginHookName>(hook: K, ...args: PluginHookArgs[K]): boolean;
    /**
     * Handle plugin errors with structured error handling
     */
    private handleError;
    private getBoundaryHandler;
}
//# sourceMappingURL=PluginManager.d.ts.map