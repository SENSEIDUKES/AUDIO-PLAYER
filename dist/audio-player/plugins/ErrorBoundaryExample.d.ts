import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
import { Track } from '../types';
import { PluginErrorHandler, PluginErrorInfo, ErrorHandlerResult, RecoveryAction, PluginErrorBoundary } from '../core/plugins/PluginErrorBoundary';
/**
 * Example custom error handler that a host application might provide.
 * This allows the host to control error logging, UI notifications, and recovery.
 */
declare class HostAppErrorHandler implements PluginErrorHandler {
    private readonly errorLog;
    private readonly disabledPlugins;
    private failureCounts;
    onError(info: PluginErrorInfo): ErrorHandlerResult | Promise<ErrorHandlerResult>;
    onWarning(pluginName: string, message: string, _context?: Record<string, unknown>): void;
    onPluginDisabled(pluginName: string, failureCount: number): void;
    onPluginRecovered(pluginName: string, _previousAction: RecoveryAction): void;
    private showToast;
    getErrorLog(): {
        plugin: string;
        error: Error;
        timestamp: Date;
    }[];
    isPluginDisabled(pluginName: string): boolean;
    clearErrorLog(): void;
}
/**
 * Example plugin that uses an error boundary for its internal operations.
 * This pattern allows plugins to handle their own errors gracefully.
 */
declare class AnalyticsPlugin implements AudioPlayerPlugin {
    readonly name = "analytics";
    private boundary;
    private eventQueue;
    private flushTimer;
    constructor(boundary: PluginErrorBoundary);
    init(context: PluginPlayerContext): () => void;
    destroy(): void;
    onTrackLoad(track: Track | null): void;
    onPlay(): void;
    onPause(): void;
    private setupAnalytics;
    private queueEvent;
    private scheduleFlush;
    private flush;
    private cleanup;
}
/**
 * Example of how a host application would create and use plugins
 * with the error boundary pattern.
 */
declare function setupPluginsWithErrorHandling(): Promise<{
    analyticsPlugin: AnalyticsPlugin;
    analyticsBoundary: PluginErrorBoundary;
}>;
/**
 * Example showing how to use GracefulDegradation constants
 * for common plugin hook scenarios.
 */
declare class ExamplePluginWithDegradation implements AudioPlayerPlugin {
    readonly name = "example-degradation";
    private boundary;
    constructor(boundary: PluginErrorBoundary);
    init(context: PluginPlayerContext): void;
    destroy(): void;
    onTrackLoad(track: Track | null): void;
    onPlay(): void;
    onSeek(position: number): void;
    onTrackEnded(track: Track | null): boolean;
    private initialize;
    private cleanup;
    private handleTrackLoad;
    private handlePlay;
    private handleSeek;
    private handleTrackEnded;
}
/**
 * Demonstrates different recovery strategies for different error types.
 */
declare class ResilientPlugin implements AudioPlayerPlugin {
    readonly name = "resilient-plugin";
    private boundary;
    constructor(boundary: PluginErrorBoundary);
    init(_context: PluginPlayerContext): void;
    destroy(): void;
    onTimeUpdate(position: number): void;
    private connectToService;
    private attemptConnection;
    private disconnect;
    private sendHeartbeat;
}
/**
 * Example of monitoring plugin health from the host application.
 */
declare function monitorPluginHealth(): void;
/**
 * Example of using the isPluginError type guard for precise error handling.
 */
declare function handlePluginError(error: unknown): void;
export { HostAppErrorHandler, AnalyticsPlugin, ExamplePluginWithDegradation, ResilientPlugin, setupPluginsWithErrorHandling, monitorPluginHealth, handlePluginError, };
//# sourceMappingURL=ErrorBoundaryExample.d.ts.map