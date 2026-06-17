import type {
    AudioPlayerPlugin,
    PluginHookArgs,
    PluginHookName,
    PluginPlayerContext,
} from "./PluginInterface"
import {
    PluginError,
    PluginErrorHandler,
    DefaultPluginErrorHandler,
    PluginErrorBoundary,
    PluginErrorBoundaryFactory,
    ErrorSeverity,
    PluginErrorInfo,
    isPluginError,
} from "./PluginErrorBoundary"
import { PluginDebugger, type PluginDebugInfo } from "./PluginDebugger"

type HookCallable<K extends PluginHookName> = (
    this: AudioPlayerPlugin,
    ...args: PluginHookArgs[K]
) => unknown

type RegisteredPlugin = {
    plugin: AudioPlayerPlugin
    cleanup?: () => void
    /** Error boundary for this plugin instance */
    errorBoundary: PluginErrorBoundary
}

/** Configuration options for PluginManager error handling */
export interface PluginManagerOptions {
    /** Custom error handler for all plugins */
    errorHandler?: PluginErrorHandler
    /** Maximum failures before a plugin is disabled (used by default handler) */
    maxFailuresBeforeDisable?: number
}

/** Register plugins and safely dispatch player lifecycle hooks. */
export class PluginManager {
    private readonly plugins = new Map<string, RegisteredPlugin>()
    private context: PluginPlayerContext
    private errorBoundaryFactory: PluginErrorBoundaryFactory
    private readonly defaultOptions: Required<PluginManagerOptions>
    private readonly debugger: PluginDebugger

    constructor(context: PluginPlayerContext, options: PluginManagerOptions = {}) {
        this.context = context
        this.defaultOptions = {
            errorHandler: options.errorHandler ?? new DefaultPluginErrorHandler(options.maxFailuresBeforeDisable),
            maxFailuresBeforeDisable: options.maxFailuresBeforeDisable ?? 3,
        }
        this.errorBoundaryFactory = new PluginErrorBoundaryFactory(this.defaultOptions.errorHandler)
        this.debugger = new PluginDebugger()
    }

    setContext(context: PluginPlayerContext) {
        this.context = context
    }

    /**
     * Set a custom error handler for future plugin registrations
     * Note: Already registered plugins keep their original error boundaries
     */
    setErrorHandler(handler: PluginErrorHandler): void {
        this.defaultOptions.errorHandler = handler
        this.errorBoundaryFactory = new PluginErrorBoundaryFactory(handler)
    }

    register(plugin: AudioPlayerPlugin) {
        if (!plugin?.name) {
            this.handleError("register", new Error("Plugin is missing a name"), "error")
            return
        }

        const existing = this.plugins.get(plugin.name)
        if (existing?.plugin === plugin) return
        if (existing) this.unregister(plugin.name)

        // Create error boundary for this plugin
        const errorBoundary = this.errorBoundaryFactory.createBoundary(plugin.name)

        let cleanup: (() => void) | undefined
        try {
            const result = errorBoundary.executeSync(
                "init",
                () => plugin.init(this.context),
                {
                    recoverable: false,
                    severity: "error",
                    context: { pluginName: plugin.name }
                }
            )
            if (typeof result === "function") cleanup = result
            this.plugins.set(plugin.name, { plugin, cleanup, errorBoundary })
        } catch (error) {
            try {
                errorBoundary.executeSync(
                    "destroy",
                    () => plugin.destroy(),
                    {
                        recoverable: false,
                        severity: "error",
                        context: { pluginName: plugin.name }
                    }
                )
            } catch {}
        }
    }

    unregister(name: string) {
        const registered = this.plugins.get(name)
        if (!registered) return
        this.plugins.delete(name)
        try {
            registered.cleanup?.()
        } catch (error) {
            this.handleError(`cleanup:${name}`, error, "warning", { pluginName: name })
        }
        try {
            registered.plugin.destroy()
        } catch (error) {
            this.handleError(`destroy:${name}`, error, "warning", { pluginName: name })
        }
    }

    replace(nextPlugins: readonly AudioPlayerPlugin[]) {
        const nextNames = new Set(nextPlugins.map((plugin) => plugin.name))
        for (const name of this.plugins.keys()) {
            if (!nextNames.has(name)) this.unregister(name)
        }
        for (const plugin of nextPlugins) this.register(plugin)
    }

    clear() {
        for (const name of [...this.plugins.keys()]) this.unregister(name)
    }

    has(name: string) {
        return this.plugins.has(name)
    }

    list() {
        return [...this.plugins.values()].map(({ plugin }) => plugin)
    }

    /**
     * Get health and debug status for all plugins
     */
    getDebugStatus(): PluginDebugInfo[] {
        return [...this.plugins.values()].map(({ plugin, errorBoundary }) => ({
            name: plugin.name,
            initialized: true,
            lastHookCalled: null,
            lastHookTime: null,
            errorCount: errorBoundary.getFailureCount(),
            memoryUsage: this.debugger.getMemoryUsage()
        }))
    }

    /**
     * Get the error boundary for a specific plugin
     */
    getErrorBoundary(pluginName: string): PluginErrorBoundary | undefined {
        return this.plugins.get(pluginName)?.errorBoundary
    }

    /**
     * Check if a plugin is disabled due to errors
     */
    isPluginDisabled(pluginName: string): boolean {
        return this.plugins.get(pluginName)?.errorBoundary.isPluginDisabled() ?? false
    }

    /**
     * Manually re-enable a disabled plugin
     */
    enablePlugin(pluginName: string): boolean {
        const boundary = this.plugins.get(pluginName)?.errorBoundary
        if (boundary) {
            boundary.enable()
            return true
        }
        return false
    }

    trigger<K extends PluginHookName>(
        hook: K,
        ...args: PluginHookArgs[K]
    ): unknown[] {
        const results: unknown[] = []
        for (const { plugin, errorBoundary } of this.plugins.values()) {
            const hookFn = plugin[hook]
            if (typeof hookFn !== "function") continue
            
            // Use error boundary to execute the hook with structured error handling
            try {
                const result = errorBoundary.executeSync(
                    `hook:${hook}`,
                    () => this.debugger.measure(plugin.name, hook, () => (hookFn as HookCallable<K>).call(plugin, ...args)),
                    {
                        recoverable: true,
                        severity: "warning",
                        fallback: undefined,
                        context: { hook, pluginName: plugin.name }
                    }
                )
                
                if (result !== undefined) {
                    results.push(result)
                }
            } catch {
                // Plugin is disabled or threw - skip silently for trigger
                continue
            }
        }
        return results
    }

    triggerUntilHandled<K extends PluginHookName>(
        hook: K,
        ...args: PluginHookArgs[K]
    ): boolean {
        for (const { plugin, errorBoundary } of this.plugins.values()) {
            const hookFn = plugin[hook]
            if (typeof hookFn !== "function") continue
            
            try {
                const handled = errorBoundary.executeSync(
                    `hook:${hook}`,
                    () => this.debugger.measure(plugin.name, hook, () => (hookFn as HookCallable<K>).call(plugin, ...args) === true),
                    {
                        recoverable: true,
                        severity: "warning",
                        fallback: false,
                        context: { hook, pluginName: plugin.name }
                    }
                )
                if (handled) return true
            } catch {
                continue
            }
        }
        return false
    }

    /**
     * Handle plugin errors with structured error handling
     */
    private handleError(
        scope: string,
        error: unknown,
        severity: ErrorSeverity = "error",
        context?: Record<string, unknown>
    ): void {
        const pluginName: string = (context?.pluginName as string) ?? scope.split(":")[1] ?? "unknown"
        
        // Don't double-wrap PluginErrors
        const pluginError = isPluginError(error) 
            ? error 
            : PluginError.fromError(pluginName, scope, error, severity !== "error")

        // Use the plugin's error boundary if available, otherwise use default handler
        const boundary = this.plugins.get(pluginName)?.errorBoundary
        const handler: PluginErrorHandler = boundary 
            ? this.getBoundaryHandler(boundary) 
            : this.defaultOptions.errorHandler

        // Execute error handling asynchronously to not block
        const info: PluginErrorInfo = {
            error: pluginError,
            severity,
            context
        }
        
        // Handler can be sync or async - wrap in Promise.resolve to normalize
        Promise.resolve(handler.onError(info))
            .then(result => {
                // Handle recovery actions at the manager level
                if (result.action === "disable_plugin" && boundary) {
                    boundary.disable()
                    const failureCount = boundary.getFailureCount()
                    Promise.resolve(handler.onPluginDisabled(pluginName, failureCount))
                        .catch(() => {})
                }
            })
            .catch(() => {
                // Handler threw - just log if possible
                if (severity === 'error') {
                    console.error('[PluginManager] Error handler threw:', pluginError.message)
                }
            })
    }

    /**
     * Safely retrieve the handler from a boundary. Uses the handler stored at
     * construction time so callers never need to access private members.
     */
    private getBoundaryHandler(_boundary: PluginErrorBoundary): PluginErrorHandler {
        // Every boundary created through the factory shares the factory's handler.
        // We can obtain it through the boundary's getFailureCount method for
        // DefaultPluginErrorHandler, or use the factory's stored reference.
        return this.errorBoundaryFactory.getHandler()
    }
}
