/**
 * Example: Using the Plugin Error Boundary Pattern
 * 
 * This file demonstrates how to use the new structured error handling
 * for plugins in the SEIHouse Audio Player.
 */

import type { AudioPlayerPlugin, PluginPlayerContext } from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import type {
    PluginErrorHandler,
    PluginErrorInfo,
    ErrorHandlerResult,
    RecoveryAction,
} from "../core/plugins/PluginErrorBoundary"
import {
    PluginErrorBoundary,
    PluginErrorBoundaryFactory,
    GracefulDegradation,
    setGlobalErrorHandler,
    isPluginError,
} from "../core/plugins/PluginErrorBoundary"

// ============================================================================
// 1. CUSTOM ERROR HANDLER FOR HOST APPLICATIONS
// ============================================================================

/**
 * Example custom error handler that a host application might provide.
 * This allows the host to control error logging, UI notifications, and recovery.
 */
class HostAppErrorHandler implements PluginErrorHandler {
    private readonly errorLog: Array<{ plugin: string; error: Error; timestamp: Date }> = []
    private readonly disabledPlugins = new Set<string>()
    private failureCounts = new Map<string, number>()

    onError(info: PluginErrorInfo): ErrorHandlerResult | Promise<ErrorHandlerResult> {
        const { error, severity, context } = info
        
        // Track failure counts
        const count = (this.failureCounts.get(error.pluginName) || 0) + 1
        this.failureCounts.set(error.pluginName, count)

        // Log to host's error tracking service
        this.errorLog.push({
            plugin: error.pluginName,
            error: error instanceof Error ? error : new Error(String(error)),
            timestamp: error.timestamp,
        })

        // Send to external error tracking (Sentry, LogRocket, etc.)
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            (window as any).Sentry.captureException(error, {
                tags: {
                    plugin: error.pluginName,
                    operation: error.operation,
                    severity,
                },
                extra: context,
            })
        }

        // Determine recovery action
        if (!error.recoverable) {
            this.disabledPlugins.add(error.pluginName)
            return {
                action: 'disable_plugin' as RecoveryAction,
                suppressLogging: false,
                userMessage: `Plugin "${error.pluginName}" has been disabled due to a critical error.`,
            }
        }

        // For hook errors, skip the hook but keep plugin alive
        if (error.operation.startsWith('hook:')) {
            return {
                action: 'skip_hook' as RecoveryAction,
                suppressLogging: severity === 'warning',
            }
        }

        // For init errors, disable the plugin
        if (error.operation.startsWith('init:')) {
            this.disabledPlugins.add(error.pluginName)
            return {
                action: 'disable_plugin' as RecoveryAction,
                suppressLogging: false,
                userMessage: `Plugin "${error.pluginName}" failed to initialize.`,
            }
        }

        // Default: try fallback
        return {
            action: 'fallback' as RecoveryAction,
            suppressLogging: false,
        }
    }

    onWarning(pluginName: string, message: string, _context?: Record<string, unknown>) {
        // Show non-intrusive toast notification
        this.showToast(`Plugin "${pluginName}": ${message}`, 'warning')
    }

    onPluginDisabled(pluginName: string, failureCount: number) {
        this.showToast(`Plugin "${pluginName}" disabled after ${failureCount} failures`, 'error')
    }

    onPluginRecovered(pluginName: string, _previousAction: RecoveryAction) {
        this.disabledPlugins.delete(pluginName)
        this.showToast(`Plugin "${pluginName}" recovered`, 'success')
    }

    private showToast(message: string, type: 'success' | 'warning' | 'error') {
        // Integrate with host's toast/notification system
        console.log(`[${type.toUpperCase()}] ${message}`)
    }

    // Public API for host app
    getErrorLog() { return [...this.errorLog] }
    isPluginDisabled(pluginName: string) { return this.disabledPlugins.has(pluginName) }
    clearErrorLog() { this.errorLog.length = 0 }
}

// ============================================================================
// 2. PLUGIN USING ERROR BOUNDARY INTERNALLY
// ============================================================================

/**
 * Example plugin that uses an error boundary for its internal operations.
 * This pattern allows plugins to handle their own errors gracefully.
 */
class AnalyticsPlugin implements AudioPlayerPlugin {
    readonly name = 'analytics'
    private boundary: PluginErrorBoundary
    private eventQueue: Array<{ event: string; data: unknown }> = []
    private flushTimer: ReturnType<typeof setTimeout> | null = null

    constructor(boundary: PluginErrorBoundary) {
        this.boundary = boundary
    }

    init(context: PluginPlayerContext) {
        // Use error boundary for initialization
        return this.boundary.executeSync('init', () => {
            // Setup analytics (might throw if API unavailable)
            this.setupAnalytics(context)
            
            // Return cleanup function
            return () => this.cleanup()
        }, {
            fallback: undefined,
            severity: 'error',
        })
    }

    destroy() {
        this.boundary.executeSync('destroy', () => {
            this.cleanup()
        }, {
            severity: 'warning',
        })
    }

    onTrackLoad(track: Track | null) {
        this.boundary.executeSync('hook:onTrackLoad', () => {
            if (track) {
                this.queueEvent('track_load', { 
                    trackId: track.id, 
                    title: track.title,
                    artist: track.artist,
                })
            }
        }, {
            severity: 'warning',
        })
    }

    onPlay() {
        this.boundary.executeSync('hook:onPlay', () => {
            this.queueEvent('play', { timestamp: Date.now() })
        }, {
            severity: 'warning',
        })
    }

    onPause() {
        this.boundary.executeSync('hook:onPause', () => {
            this.queueEvent('pause', { timestamp: Date.now() })
        }, {
            severity: 'warning',
        })
    }

    private setupAnalytics(_context: PluginPlayerContext) {
        // Simulate potential failure
        if (typeof window === 'undefined') {
            throw new Error('Analytics requires browser environment')
        }
        // ... actual analytics setup
    }

    private queueEvent(event: string, data: unknown) {
        this.eventQueue.push({ event, data })
        this.scheduleFlush()
    }

    private scheduleFlush() {
        if (this.flushTimer) return
        this.flushTimer = setTimeout(() => this.flush(), 5000)
    }

    private async flush() {
        this.flushTimer = null
        const events = [...this.eventQueue]
        this.eventQueue.length = 0

        await this.boundary.execute('flush', async () => {
            // Send to analytics endpoint
            const response = await fetch('/api/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events }),
            })
            if (!response.ok) throw new Error(`Analytics flush failed: ${response.status}`)
        }, {
            recoverable: true,
            fallback: undefined,
        })
        // Re-queue events on failure (handled by catch)
        this.eventQueue.unshift(...events)
    }

    private cleanup() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer)
            this.flushTimer = null
        }
        this.flush()
    }
}

// ============================================================================
// 3. USING THE PLUGIN WITH ERROR BOUNDARY
// ============================================================================

/**
 * Example of how a host application would create and use plugins
 * with the error boundary pattern.
 */
async function setupPluginsWithErrorHandling() {
    // 1. Create custom error handler (host app provides this)
    const hostErrorHandler = new HostAppErrorHandler()
    
    // 2. Set as global handler (optional, but recommended)
    setGlobalErrorHandler(hostErrorHandler)

    // 3. Create error boundary factory with custom handler
    const factory = new PluginErrorBoundaryFactory(hostErrorHandler)

    // 4. Create plugins with their own error boundaries
    const analyticsBoundary = factory.createBoundary('analytics')
    const analyticsPlugin = new AnalyticsPlugin(analyticsBoundary)

    // Or use global factory for automatic boundary creation
    // const autoBoundary = createPluginErrorBoundary('auto-theme')
    // const autoThemePlugin = new AutoThemePlugin(autoBoundary)

    // 5. Register with PluginManager (which also creates boundaries)
    // const manager = new PluginManager(context, { errorHandler: hostErrorHandler })
    // manager.register(analyticsPlugin)

    return { analyticsPlugin, analyticsBoundary }
}

// ============================================================================
// 4. GRACEFUL DEGRADATION EXAMPLES
// ============================================================================

/**
 * Example showing how to use GracefulDegradation constants
 * for common plugin hook scenarios.
 */
class ExamplePluginWithDegradation implements AudioPlayerPlugin {
    readonly name = 'example-degradation'
    private boundary: PluginErrorBoundary

    constructor(boundary: PluginErrorBoundary) {
        this.boundary = boundary
    }

    init(context: PluginPlayerContext) {
        return this.boundary.executeSync('init', () => {
            // Complex init that might fail
            this.initialize(context)
        }, {
            // If init fails, plugin simply won't be registered
            // No fallback needed - PluginManager handles this
        })
    }

    destroy() {
        this.boundary.executeSync('destroy', () => {
            this.cleanup()
        }, {
            // Destruction should never block
            fallback: GracefulDegradation.forDestroy(),
        })
    }

    onTrackLoad(track: Track | null) {
        this.boundary.executeSync('hook:onTrackLoad', () => {
            if (track) this.handleTrackLoad(track)
        }, {
            // If this hook fails, just skip it for this track
            fallback: GracefulDegradation.forTrackLoad(track),
        })
    }

    onPlay() {
        this.boundary.executeSync('hook:onPlay', () => {
            this.handlePlay()
        }, {
            // Play hook failures shouldn't break playback
            fallback: GracefulDegradation.forPlay(),
        })
    }

    onSeek(position: number) {
        this.boundary.executeSync('hook:onSeek', () => {
            this.handleSeek(position)
        }, {
            fallback: GracefulDegradation.forSeek(position) as any,
        })
    }

    onTrackEnded(track: Track | null) {
        return this.boundary.executeSync('hook:onTrackEnded', () => {
            return this.handleTrackEnded(track)
        }, {
            // Return false to let normal advancement happen
            fallback: GracefulDegradation.forTrackEnded(),
        })
    }

    private initialize(_context: PluginPlayerContext) { /* ... */ }
    private cleanup() { /* ... */ }
    private handleTrackLoad(_track: Track) { /* ... */ }
    private handlePlay() { /* ... */ }
    private handleSeek(_position: number) { /* ... */ }
    private handleTrackEnded(_track: Track | null): boolean { return false }
}

// ============================================================================
// 5. ERROR RECOVERY STRATEGIES
// ============================================================================

/**
 * Demonstrates different recovery strategies for different error types.
 */
class ResilientPlugin implements AudioPlayerPlugin {
    readonly name = 'resilient-plugin'
    private boundary: PluginErrorBoundary

    constructor(boundary: PluginErrorBoundary) {
        this.boundary = boundary
    }

    init(_context: PluginPlayerContext) {
        this.boundary.execute('init', async () => {
            await this.connectToService()
        }, {
            // Init failures are critical - don't recover silently
            recoverable: false,
        })
    }

    destroy() {
        this.boundary.executeSync('destroy', () => {
            this.disconnect()
        })
    }

    onTimeUpdate(position: number) {
        // Time updates happen frequently - use warning severity
        // and skip on failure to avoid spam
        this.boundary.executeSync('hook:onTimeUpdate', () => {
            this.sendHeartbeat(position)
        }, {
            severity: 'warning',
            fallback: GracefulDegradation.forTimeUpdate(position) as any,
        })
    }

    private async connectToService() {
        // Simulate connection that might need retries
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await this.attemptConnection()
                return
            } catch (error) {
                if (attempt === 3) throw error
                await new Promise(r => setTimeout(r, 1000 * attempt))
            }
        }
    }

    private async attemptConnection() {
        // Actual connection logic
    }

    private disconnect() { /* ... */ }
    private sendHeartbeat(_position: number) { /* ... */ }
}

// ============================================================================
// 6. CHECKING PLUGIN HEALTH
// ============================================================================

/**
 * Example of monitoring plugin health from the host application.
 */
function monitorPluginHealth() {
    // Host app can check if plugins are disabled
    // const manager = new PluginManager(context, { errorHandler: hostErrorHandler })
    
    // Check specific plugin
    // if (manager.isPluginDisabled('analytics')) {
    //     console.warn('Analytics plugin is disabled, fallback to basic tracking')
    //     // Enable basic tracking
    // }

    // Get error boundary for detailed inspection
    // const boundary = manager.getErrorBoundary('analytics')
    // if (boundary?.isPluginDisabled()) {
    //     // Show in UI that plugin is disabled
    //     // Offer "Retry" button to re-enable
    // }

    // Re-enable if needed
    // manager.enablePlugin('analytics')
}

// ============================================================================
// 7. TYPE-SAFE ERROR HANDLING
// ============================================================================

/**
 * Example of using the isPluginError type guard for precise error handling.
 */
function handlePluginError(error: unknown) {
    if (isPluginError(error)) {
        // TypeScript knows this is a PluginError
        console.log(`Plugin: ${error.pluginName}`)
        console.log(`Operation: ${error.operation}`)
        console.log(`Recoverable: ${error.recoverable}`)
        console.log(`Timestamp: ${error.timestamp.toISOString()}`)
        
        // Access original cause
        if (error.cause instanceof Error) {
            console.log(`Original error: ${error.cause.message}`)
        }
        
        // Serialize for logging
        const logEntry = error.toJSON()
        sendToLoggingService(logEntry)
    } else if (error instanceof Error) {
        // Regular error
        console.error('Unexpected error:', error.message)
    } else {
        // Unknown error type
        console.error('Unknown error:', error)
    }
}

function sendToLoggingService(data: object) {
    // Send to logging service
    console.log('Logging:', data)
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    HostAppErrorHandler,
    AnalyticsPlugin,
    ExamplePluginWithDegradation,
    ResilientPlugin,
    setupPluginsWithErrorHandling,
    monitorPluginHealth,
    handlePluginError,
}