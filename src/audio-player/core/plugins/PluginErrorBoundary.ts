/**
 * Plugin Error Boundary Pattern
 * 
 * Provides structured error handling for plugins with:
 * - Custom error classes with plugin context
 * - Error handler interface for host applications
 * - Graceful degradation strategies
 * - Recovery mechanisms
 */

export class PluginError extends Error {
  public readonly timestamp: Date
  public readonly stack?: string

  constructor(
    public readonly pluginName: string,
    public readonly operation: string,
    public readonly cause: unknown,
    public readonly recoverable: boolean
  ) {
    const message = `Plugin "${pluginName}" failed during ${operation}`
    super(message)
    this.name = 'PluginError'
    this.timestamp = new Date()
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, PluginError.prototype)
  }

  /**
   * Create a PluginError from a caught error
   */
  static fromError(
    pluginName: string,
    operation: string,
    error: unknown,
    recoverable: boolean = true
  ): PluginError {
    if (error instanceof PluginError) {
      return new PluginError(pluginName, operation, error.cause, recoverable)
    }
    return new PluginError(pluginName, operation, error, recoverable)
  }

  /**
   * Create a non-recoverable PluginError
   */
  static fatal(
    pluginName: string,
    operation: string,
    cause: unknown
  ): PluginError {
    return new PluginError(pluginName, operation, cause, false)
  }

  /**
   * Create a recoverable PluginError (warning-level)
   */
  static warning(
    pluginName: string,
    operation: string,
    cause: unknown
  ): PluginError {
    return new PluginError(pluginName, operation, cause, true)
  }

  /**
   * Get a sanitized error object for logging/serialization
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      pluginName: this.pluginName,
      operation: this.operation,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause instanceof PluginError ? this.cause.toJSON() : (this.cause instanceof Error ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : this.cause),
      stack: this.stack
    }
  }
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info'

/**
 * Extended error information for detailed reporting
 */
export interface PluginErrorInfo {
  error: PluginError
  severity: ErrorSeverity
  context?: Record<string, unknown>
  recoveryAction?: RecoveryAction
}

/**
 * Recovery actions that can be taken after a plugin error
 */
export type RecoveryAction =
  | 'none'                    // No recovery possible
  | 'disable_plugin'          // Disable the failing plugin
  | 'retry_operation'         // Retry the failed operation
  | 'fallback'                // Use fallback behavior
  | 'reset_plugin'            // Reset plugin to initial state
  | 'skip_hook'               // Skip this hook for this cycle

/**
 * Result of an error handler's decision
 */
export interface ErrorHandlerResult {
  /** Action to take for recovery */
  action: RecoveryAction
  /** Whether to suppress the error from default logging */
  suppressLogging: boolean
  /** Optional message for user-facing UI */
  userMessage?: string
  /** Delay before retry (ms), if action is 'retry_operation' */
  retryDelayMs?: number
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
  onError(info: PluginErrorInfo): ErrorHandlerResult | Promise<ErrorHandlerResult>

  /**
   * Called for non-fatal warnings from plugins
   * @param pluginName Name of the plugin that issued the warning
   * @param message Warning message
   * @param context Optional additional context
   */
  onWarning(
    pluginName: string,
    message: string,
    context?: Record<string, unknown>
  ): void | Promise<void>

  /**
   * Called when a plugin is disabled due to repeated failures
   * @param pluginName Name of the disabled plugin
   * @param failureCount Number of failures before disable
   */
  onPluginDisabled(
    pluginName: string,
    failureCount: number
  ): void | Promise<void>

  /**
   * Called when a plugin successfully recovers
   * @param pluginName Name of the recovered plugin
   * @param previousAction The recovery action that was taken
   */
  onPluginRecovered(
    pluginName: string,
    previousAction: RecoveryAction
  ): void | Promise<void>
}

/**
 * Default error handler implementation - logs to console
 */
export class DefaultPluginErrorHandler implements PluginErrorHandler {
  private failureCounts = new Map<string, number>()
  private readonly maxFailuresBeforeDisable: number
  private readonly logger: Console

  constructor(
    maxFailuresBeforeDisable: number = 3,
    logger: Console = console
  ) {
    this.maxFailuresBeforeDisable = maxFailuresBeforeDisable
    this.logger = logger
  }

  onError(info: PluginErrorInfo): ErrorHandlerResult {
    const { error, severity, context } = info
    const { pluginName, operation, recoverable, cause } = error

    // Track failures
    const count = (this.failureCounts.get(pluginName) || 0) + 1
    this.failureCounts.set(pluginName, count)

    // Log with structured format
    const logData = {
      plugin: pluginName,
      operation,
      severity,
      recoverable,
      failureCount: count,
      cause: cause instanceof Error ? {
        name: cause.name,
        message: cause.message,
        stack: cause.stack
      } : cause,
      context,
      timestamp: error.timestamp.toISOString()
    }

    if (severity === 'error') {
      this.logger.error('[PluginError]', JSON.stringify(logData, null, 2))
    } else if (severity === 'warning') {
      this.logger.warn('[PluginWarning]', JSON.stringify(logData, null, 2))
    } else {
      this.logger.info('[PluginInfo]', JSON.stringify(logData, null, 2))
    }

    // Determine recovery action based on failure count and recoverability
    if (!recoverable || count >= this.maxFailuresBeforeDisable) {
      return {
        action: 'disable_plugin',
        suppressLogging: false,
        userMessage: `Plugin "${pluginName}" has been disabled due to repeated failures.`
      }
    }

    // For recoverable errors, try fallback first
    if (operation.startsWith('hook:')) {
      return {
        action: 'skip_hook',
        suppressLogging: false
      }
    }

    if (operation.startsWith('init:')) {
      return {
        action: 'disable_plugin',
        suppressLogging: false,
        userMessage: `Plugin "${pluginName}" failed to initialize and has been disabled.`
      }
    }

    return {
      action: 'fallback',
      suppressLogging: false
    }
  }

  onWarning(
    pluginName: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.logger.warn(`[PluginWarning] ${pluginName}: ${message}`, context ?? '')
  }

  onPluginDisabled(pluginName: string, failureCount: number): void {
    this.logger.error(
      `[PluginError] Plugin "${pluginName}" disabled after ${failureCount} failures`
    )
  }

  onPluginRecovered(pluginName: string, previousAction: RecoveryAction): void {
    this.logger.info(
      `[PluginRecovery] Plugin "${pluginName}" recovered after ${previousAction}`
    )
    // Reset failure count on successful recovery
    this.failureCounts.delete(pluginName)
  }

  /**
   * Get the failure count for a plugin
   */
  getFailureCount(pluginName: string): number {
    return this.failureCounts.get(pluginName) || 0
  }

  /**
   * Reset the failure count for a plugin
   */
  resetFailureCount(pluginName: string): void {
    this.failureCounts.delete(pluginName)
  }
}

/**
 * Error boundary that wraps plugin operations with structured error handling
 */
export class PluginErrorBoundary {
  private readonly handler: PluginErrorHandler
  private readonly pluginName: string
  private isDisabled = false

  constructor(pluginName: string, handler: PluginErrorHandler) {
    this.pluginName = pluginName
    this.handler = handler
  }

  getPluginName(): string {
    return this.pluginName
  }

  isPluginDisabled(): boolean {
    return this.isDisabled
  }

  async execute<T>(
    operation: string,
    fn: () => T | Promise<T>,
    options: {
      recoverable?: boolean
      severity?: ErrorSeverity
      context?: Record<string, unknown>
      fallback?: T
    } = {}
  ): Promise<T> {
    if (this.isDisabled) {
      throw new PluginError(this.pluginName, operation, new Error('Plugin is disabled'), false)
    }

    const {
      recoverable = true,
      severity = 'error',
      context,
      fallback
    } = options

    try {
      return await fn()
    } catch (error) {
      const pluginError = PluginError.fromError(
        this.pluginName,
        operation,
        error,
        recoverable
      )

      const info: PluginErrorInfo = {
        error: pluginError,
        severity,
        context
      }

      const result = await this.handler.onError(info)

      // Handle recovery action
      switch (result.action) {
        case 'disable_plugin':
          this.isDisabled = true
          await this.handler.onPluginDisabled(
            this.pluginName,
            this.getFailureCount()
          )
          if (fallback !== undefined) {
            return fallback
          }
          throw pluginError

        case 'skip_hook':
          return fallback as T

        case 'fallback':
          if (fallback !== undefined) {
            return fallback
          }
          throw pluginError

        case 'retry_operation': {
          const delay = result.retryDelayMs ?? 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.execute(operation, fn, options)
        }

        case 'reset_plugin':
          // The plugin should handle its own reset
          throw pluginError

        case 'none':
        default:
          throw pluginError
      }
    }
  }

  executeSync<T>(
    operation: string,
    fn: () => T,
    options: {
      recoverable?: boolean
      severity?: ErrorSeverity
      context?: Record<string, unknown>
      fallback?: T
    } = {}
  ): T {
    if (this.isDisabled) {
      throw new PluginError(this.pluginName, operation, new Error('Plugin is disabled'), false)
    }

    const {
      recoverable = true,
      severity = 'error',
      context,
      fallback
    } = options

    try {
      return fn()
    } catch (error) {
      const pluginError = PluginError.fromError(
        this.pluginName,
        operation,
        error,
        recoverable
      )

      const info: PluginErrorInfo = {
        error: pluginError,
        severity,
        context
      }

      // Try to get a synchronous result from the handler.
      // If the handler is async, fall back to basic recoverable/fallback logic.
      const handlerResult = this.handler.onError(info)

      if (handlerResult instanceof Promise) {
        // Async handler can't be awaited in a sync context.
        // Fire the handler in the background for logging/reporting.
        handlerResult.then(result => {
          if (result.action === 'disable_plugin') {
            this.isDisabled = true
            Promise.resolve(this.handler.onPluginDisabled(this.pluginName, this.getFailureCount())).catch(() => {})
          }
        }).catch(() => {})

        // Fall back to simple recoverable/fallback logic
        if (!recoverable) {
          throw pluginError
        }
        if (fallback !== undefined) {
          return fallback
        }
        throw pluginError
      }

      // Synchronous handler result - apply recovery action.
      // For sync execution, always aim to complete without throwing so the
      // caller can continue iterating other plugins. Only throw for truly
      // non-recoverable errors or the 'none' action.
      switch (handlerResult.action) {
        case 'disable_plugin':
          this.isDisabled = true
          // Fire async callback in background
          Promise.resolve(
            this.handler.onPluginDisabled(this.pluginName, this.getFailureCount())
          ).catch(() => {})
          if (fallback !== undefined) return fallback
          throw pluginError

        case 'skip_hook':
          return fallback as T

        case 'fallback':
          if (fallback !== undefined) return fallback
          throw pluginError

        default:
          // For 'none' or unknown actions, throw
          throw pluginError
      }
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.handler.onWarning(this.pluginName, message, context)
  }

  enable(): void {
    this.isDisabled = false
  }

  disable(): void {
    this.isDisabled = true
  }

  reset(): void {
    this.isDisabled = false
    // Try to reset failure count if the handler supports it
    if (this.handler instanceof DefaultPluginErrorHandler) {
      this.handler.resetFailureCount(this.pluginName)
    } else if (typeof (this.handler as unknown as Record<string, unknown>).resetFailureCount === 'function') {
      ;(this.handler as unknown as { resetFailureCount(name: string): void }).resetFailureCount(this.pluginName)
    }
  }

  /**
   * Get failure count for this plugin from the handler (if supported)
   */
  getFailureCount(): number {
    if (this.handler instanceof DefaultPluginErrorHandler) {
      return this.handler.getFailureCount(this.pluginName)
    }
    if (typeof (this.handler as unknown as Record<string, unknown>).getFailureCount === 'function') {
      return (this.handler as unknown as { getFailureCount(name: string): number }).getFailureCount(this.pluginName)
    }
    return 0
  }
}

/**
 * Factory for creating plugin error boundaries with a shared handler
 */
export class PluginErrorBoundaryFactory {
  private readonly handler: PluginErrorHandler

  constructor(handler?: PluginErrorHandler) {
    this.handler = handler ?? new DefaultPluginErrorHandler()
  }

  createBoundary(pluginName: string): PluginErrorBoundary {
    return new PluginErrorBoundary(pluginName, this.handler)
  }

  getHandler(): PluginErrorHandler {
    return this.handler
  }
}

/**
 * Global error boundary factory instance (can be replaced by host app)
 */
let globalErrorBoundaryFactory: PluginErrorBoundaryFactory = 
  new PluginErrorBoundaryFactory()

/**
 * Set a custom error handler for all plugins
 * Call this before initializing any plugins
 */
export function setGlobalErrorHandler(handler: PluginErrorHandler): void {
  globalErrorBoundaryFactory = new PluginErrorBoundaryFactory(handler)
}

/**
 * Get the current global error boundary factory
 */
export function getGlobalErrorBoundaryFactory(): PluginErrorBoundaryFactory {
  return globalErrorBoundaryFactory
}

/**
 * Create an error boundary for a specific plugin using the global handler
 */
export function createPluginErrorBoundary(pluginName: string): PluginErrorBoundary {
  return globalErrorBoundaryFactory.createBoundary(pluginName)
}

/**
 * Graceful degradation strategies for common plugin operations
 */
export const GracefulDegradation = {
  forInit: <T>(defaultValue: T) => defaultValue,
  forHook: <T>(defaultValue: T) => defaultValue,
  forTrackLoad: (track: unknown) => track,
  forPlay: () => undefined,
  forPause: () => undefined,
  forSeek: (position: number) => position,
  forTimeUpdate: (position: number) => position,
  forTrackEnded: () => false,
  forDestroy: () => undefined
} as const

/**
 * Helper to wrap a plugin with error boundary protection.
 * Proxies method calls through the error boundary for structured error handling.
 */
export function withErrorBoundary<P extends Record<string, unknown>>(
  plugin: P,
  boundary: PluginErrorBoundary
): P & { _errorBoundary: PluginErrorBoundary } {
  const wrapped = { ...plugin } as P & { _errorBoundary: PluginErrorBoundary }
  wrapped._errorBoundary = boundary

  return new Proxy(wrapped, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function' || prop === '_errorBoundary' || prop === 'constructor') {
        return value
      }

      // Wrap functions to go through the error boundary
      return function (this: unknown, ...args: unknown[]) {
        const fn = value.bind(target)
        const operation = `method:${String(prop)}`
        try {
          const result = fn(...args)
          if (result instanceof Promise || (result && typeof (result as any).then === 'function')) {
            return boundary.execute(operation, () => result)
          }
          return result
        } catch (error) {
          return boundary.executeSync(operation, () => { throw error })
        }
      }
    }
  })
}

/**
 * Type guard to check if an error is a PluginError
 */
export function isPluginError(error: unknown): error is PluginError {
  return error instanceof PluginError
}