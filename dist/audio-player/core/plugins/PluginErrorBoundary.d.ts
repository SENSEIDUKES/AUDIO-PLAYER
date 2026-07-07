/**
 * Plugin Error Boundary Pattern
 *
 * Provides structured error handling for plugins with:
 * - Custom error classes with plugin context
 * - Error handler interface for host applications
 * - Graceful degradation strategies
 * - Recovery mechanisms
 */
export declare class PluginError extends Error {
    readonly pluginName: string;
    readonly operation: string;
    readonly cause: unknown;
    readonly recoverable: boolean;
    readonly timestamp: Date;
    readonly stack?: string;
    constructor(pluginName: string, operation: string, cause: unknown, recoverable: boolean);
    /**
     * Create a PluginError from a caught error
     */
    static fromError(pluginName: string, operation: string, error: unknown, recoverable?: boolean): PluginError;
    /**
     * Create a non-recoverable PluginError
     */
    static fatal(pluginName: string, operation: string, cause: unknown): PluginError;
    /**
     * Create a recoverable PluginError (warning-level)
     */
    static warning(pluginName: string, operation: string, cause: unknown): PluginError;
    /**
     * Get a sanitized error object for logging/serialization
     */
    toJSON(): object;
}
/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';
/**
 * Extended error information for detailed reporting
 */
export interface PluginErrorInfo {
    error: PluginError;
    severity: ErrorSeverity;
    context?: Record<string, unknown>;
    recoveryAction?: RecoveryAction;
}
/**
 * Recovery actions that can be taken after a plugin error
 */
export type RecoveryAction = 'none' | 'disable_plugin' | 'retry_operation' | 'fallback' | 'reset_plugin' | 'skip_hook';
/**
 * Result of an error handler's decision
 */
export interface ErrorHandlerResult {
    /** Action to take for recovery */
    action: RecoveryAction;
    /** Whether to suppress the error from default logging */
    suppressLogging: boolean;
    /** Optional message for user-facing UI */
    userMessage?: string;
    /** Delay before retry (ms), if action is 'retry_operation' */
    retryDelayMs?: number;
}
/**
 * Interface for custom error handlers provided by host applications
 */
export interface PluginErrorHandler {
    /**
     * Called when a plugin throws an error during any operation
     * @param info Detailed error information
     * @returns Recovery decision
     */
    onError(info: PluginErrorInfo): ErrorHandlerResult | Promise<ErrorHandlerResult>;
    /**
     * Called for non-fatal warnings from plugins
     * @param pluginName Name of the plugin that issued the warning
     * @param message Warning message
     * @param context Optional additional context
     */
    onWarning(pluginName: string, message: string, context?: Record<string, unknown>): void | Promise<void>;
    /**
     * Called when a plugin is disabled due to repeated failures
     * @param pluginName Name of the disabled plugin
     * @param failureCount Number of failures before disable
     */
    onPluginDisabled(pluginName: string, failureCount: number): void | Promise<void>;
    /**
     * Called when a plugin successfully recovers
     * @param pluginName Name of the recovered plugin
     * @param previousAction The recovery action that was taken
     */
    onPluginRecovered(pluginName: string, previousAction: RecoveryAction): void | Promise<void>;
}
/**
 * Default error handler implementation - logs to console
 */
export declare class DefaultPluginErrorHandler implements PluginErrorHandler {
    private failureCounts;
    private readonly maxFailuresBeforeDisable;
    private readonly logger;
    constructor(maxFailuresBeforeDisable?: number, logger?: Console);
    onError(info: PluginErrorInfo): ErrorHandlerResult;
    onWarning(pluginName: string, message: string, context?: Record<string, unknown>): void;
    onPluginDisabled(pluginName: string, failureCount: number): void;
    onPluginRecovered(pluginName: string, previousAction: RecoveryAction): void;
    /**
     * Get the failure count for a plugin
     */
    getFailureCount(pluginName: string): number;
    /**
     * Reset the failure count for a plugin
     */
    resetFailureCount(pluginName: string): void;
}
/**
 * Error boundary that wraps plugin operations with structured error handling
 */
export declare class PluginErrorBoundary {
    private readonly handler;
    private readonly pluginName;
    private isDisabled;
    constructor(pluginName: string, handler: PluginErrorHandler);
    getHandler(): PluginErrorHandler;
    getPluginName(): string;
    isPluginDisabled(): boolean;
    execute<T>(operation: string, fn: () => T | Promise<T>, options?: {
        recoverable?: boolean;
        severity?: ErrorSeverity;
        context?: Record<string, unknown>;
        fallback?: T;
    }): Promise<T>;
    executeSync<T>(operation: string, fn: () => T, options?: {
        recoverable?: boolean;
        severity?: ErrorSeverity;
        context?: Record<string, unknown>;
        fallback?: T;
    }): T;
    warn(message: string, context?: Record<string, unknown>): void;
    enable(): void;
    disable(): void;
    reset(): void;
    /**
     * Get failure count for this plugin from the handler (if supported)
     */
    getFailureCount(): number;
}
/**
 * Factory for creating plugin error boundaries with a shared handler
 */
export declare class PluginErrorBoundaryFactory {
    private readonly handler;
    constructor(handler?: PluginErrorHandler);
    createBoundary(pluginName: string): PluginErrorBoundary;
    getHandler(): PluginErrorHandler;
}
/**
 * Set a custom error handler for all plugins
 * Call this before initializing any plugins
 */
export declare function setGlobalErrorHandler(handler: PluginErrorHandler): void;
/**
 * Get the current global error boundary factory
 */
export declare function getGlobalErrorBoundaryFactory(): PluginErrorBoundaryFactory;
/**
 * Create an error boundary for a specific plugin using the global handler
 */
export declare function createPluginErrorBoundary(pluginName: string): PluginErrorBoundary;
/**
 * Graceful degradation strategies for common plugin operations
 */
export declare const GracefulDegradation: {
    readonly forInit: <T>(defaultValue: T) => T;
    readonly forHook: <T>(defaultValue: T) => T;
    readonly forTrackLoad: (track: unknown) => unknown;
    readonly forPlay: () => undefined;
    readonly forPause: () => undefined;
    readonly forSeek: (position: number) => number;
    readonly forTimeUpdate: (position: number) => number;
    readonly forTrackEnded: () => boolean;
    readonly forDestroy: () => undefined;
};
/**
 * Helper to wrap a plugin with error boundary protection.
 * Proxies method calls through the error boundary for structured error handling.
 */
export declare function withErrorBoundary<P extends Record<string, unknown>>(plugin: P, boundary: PluginErrorBoundary): P & {
    _errorBoundary: PluginErrorBoundary;
};
/**
 * Type guard to check if an error is a PluginError
 */
export declare function isPluginError(error: unknown): error is PluginError;
//# sourceMappingURL=PluginErrorBoundary.d.ts.map