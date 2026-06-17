/**
 * Tests for PluginErrorBoundary pattern
 * Demonstrates usage and verifies error handling behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    PluginError,
    DefaultPluginErrorHandler,
    PluginErrorBoundary,
    PluginErrorBoundaryFactory,
    GracefulDegradation,
    isPluginError,
    setGlobalErrorHandler,
    getGlobalErrorBoundaryFactory,
    createPluginErrorBoundary,
    type RecoveryAction,
} from '../PluginErrorBoundary'
import { PluginManager, PluginManagerOptions } from '../PluginManager'
import type { AudioPlayerPlugin, PluginPlayerContext } from '../PluginInterface'

// Mock PluginPlayerContext
const createMockContext = (): PluginPlayerContext => ({
    getEngine: () => ({
        isPlaying: true,
        currentTime: 10,
        duration: 100,
        volume: 0.5,
        volumeUnsupported: false,
        isBuffering: false,
        isSeeking: false,
        hasError: false,
        errorMessage: '',
        hasAudio: true,
        currentSrc: 'test.mp3',
        currentSourceIndex: 0,
        sourceCount: 1,
        autoplayBlocked: false,
        audioRef: { current: null },
        buffered: 50,
        bufferedRanges: [{ start: 0, end: 50 }],
        isMuted: false,
        play: vi.fn(),
        pause: vi.fn(),
        toggle: vi.fn(),
        seek: vi.fn(),
        seekBy: vi.fn(),
        setSeeking: vi.fn(),
        setVolume: vi.fn(),
        toggleMute: vi.fn(),
        retry: vi.fn(),
        loadAndPlay: vi.fn(),
        dismissAutoplayBlocked: vi.fn(),
        preload: vi.fn(),
        unload: vi.fn(),
        fade: vi.fn(),
        getBackendInfo: vi.fn(),
        getDecodedData: vi.fn(),
    }),
    getRootElement: () => null,
    getAudioElement: () => null,
    getCurrentTrack: () => null,
    getNextTrack: () => null,
    getSourceKey: () => 'test-key',
    requestAdvance: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    getQueue: vi.fn(),
    getCurrentIndex: vi.fn(),
    getRepeatMode: vi.fn(),
    getShuffle: vi.fn(),
})

describe('PluginError', () => {
    it('creates a structured error with plugin context', () => {
        const error = new PluginError('test-plugin', 'init', new Error('Failed to init'), true)
        
        expect(error.pluginName).toBe('test-plugin')
        expect(error.operation).toBe('init')
        expect(error.recoverable).toBe(true)
        expect(error.message).toBe('Plugin "test-plugin" failed during init')
        expect(error.timestamp).toBeInstanceOf(Date)
    })

    it('creates fatal errors', () => {
        const error = PluginError.fatal('test-plugin', 'destroy', new Error('Fatal'))
        
        expect(error.recoverable).toBe(false)
    })

    it('creates warning-level errors', () => {
        const error = PluginError.warning('test-plugin', 'hook:onPlay', new Error('Warning'))
        
        expect(error.recoverable).toBe(true)
    })

    it('serializes to JSON correctly', () => {
        const cause = new Error('Original error')
        const error = new PluginError('test-plugin', 'init', cause, true)
        const json = error.toJSON()
        
        expect(json).toEqual(expect.objectContaining({
            name: 'PluginError',
            pluginName: 'test-plugin',
            operation: 'init',
            recoverable: true,
            cause: expect.objectContaining({
                name: 'Error',
                message: 'Original error',
            }),
        }))
    })

    it('wraps existing PluginError', () => {
        const original = new PluginError('test', 'op', new Error('cause'), true)
        const wrapped = PluginError.fromError('other', 'other-op', original, false)
        
        expect(wrapped.pluginName).toBe('other')
        expect(wrapped.operation).toBe('other-op')
        expect(wrapped.recoverable).toBe(false)
        expect(wrapped.cause).toBe(original.cause)
    })
})

describe('DefaultPluginErrorHandler', () => {
    let handler: DefaultPluginErrorHandler
    let consoleSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        handler = new DefaultPluginErrorHandler(3)
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'info').mockImplementation(() => {})
    })

    afterEach(() => {
        consoleSpy.mockRestore()
    })

    it('tracks failure counts per plugin', async () => {
        const error = new PluginError('test-plugin', 'hook:onPlay', new Error('fail'), true)
        
        await handler.onError({ error, severity: 'error' })
        await handler.onError({ error, severity: 'error' })
        
        expect(handler.getFailureCount('test-plugin')).toBe(2)
    })

    it('returns disable_plugin after max failures', async () => {
        const error = new PluginError('test-plugin', 'hook:onPlay', new Error('fail'), true)
        
        // First 2 failures - should skip hook
        const result1 = await handler.onError({ error, severity: 'error' })
        expect(result1.action).toBe('skip_hook')
        
        const result2 = await handler.onError({ error, severity: 'error' })
        expect(result2.action).toBe('skip_hook')
        
        // Third failure - should disable
        const result3 = await handler.onError({ error, severity: 'error' })
        expect(result3.action).toBe('disable_plugin')
        expect(result3.userMessage).toContain('disabled')
    })

    it('disables immediately for non-recoverable errors', async () => {
        const error = PluginError.fatal('test-plugin', 'init', new Error('fatal'))
        
        const result = await handler.onError({ error, severity: 'error' })
        
        expect(result.action).toBe('disable_plugin')
    })

    it('handles init errors specially', async () => {
        const error = new PluginError('test-plugin', 'init:test-plugin', new Error('init failed'), true)
        
        const result = await handler.onError({ error, severity: 'error' })
        
        expect(result.action).toBe('disable_plugin')
    })

    it('calls onWarning', async () => {
        const warnSpy = vi.spyOn(console, 'warn')
        
        await handler.onWarning('test-plugin', 'Something weird happened', { detail: 'info' })
        
        expect(warnSpy).toHaveBeenCalledWith(
            '[PluginWarning] test-plugin: Something weird happened',
            { detail: 'info' }
        )
    })

    it('calls onPluginDisabled', async () => {
        const errorSpy = vi.spyOn(console, 'error')
        
        await handler.onPluginDisabled('test-plugin', 3)
        
        expect(errorSpy).toHaveBeenCalledWith(
            '[PluginError] Plugin "test-plugin" disabled after 3 failures'
        )
    })

    it('resets failure count on recovery', async () => {
        const error = new PluginError('test-plugin', 'hook:onPlay', new Error('fail'), true)
        
        await handler.onError({ error, severity: 'error' })
        await handler.onError({ error, severity: 'error' })
        expect(handler.getFailureCount('test-plugin')).toBe(2)
        
        await handler.onPluginRecovered('test-plugin', 'skip_hook')
        
        expect(handler.getFailureCount('test-plugin')).toBe(0)
    })
})

describe('PluginErrorBoundary', () => {
    let handler: DefaultPluginErrorHandler
    let boundary: PluginErrorBoundary

    beforeEach(() => {
        handler = new DefaultPluginErrorHandler(3)
        boundary = new PluginErrorBoundary('test-plugin', handler)
    })

    it('executes successful operations normally', async () => {
        const result = await boundary.execute('test-op', () => 'success')
        
        expect(result).toBe('success')
    })

    it('catches errors and applies recovery', async () => {
        const error = new Error('Operation failed')
        
        const result = await boundary.execute('test-op', () => {
            throw error
        }, { fallback: 'fallback-value' })
        
        expect(result).toBe('fallback-value')
    })

    it('re-throws when no fallback and action is none', async () => {
        // Use a handler that returns 'none' action
        const customHandler = {
            onError: vi.fn().mockResolvedValue({
                action: 'none' as RecoveryAction,
                suppressLogging: false,
            }),
            onWarning: vi.fn(),
            onPluginDisabled: vi.fn(),
            onPluginRecovered: vi.fn(),
        }
        
        const customBoundary = new PluginErrorBoundary('test', customHandler)
        
        await expect(customBoundary.execute('test-op', () => {
            throw new Error('fail')
        })).rejects.toThrow(PluginError)
    })

    it('retries on retry_operation action', async () => {
        let attempts = 0
        const customHandler = {
            onError: vi.fn()
                .mockResolvedValueOnce({
                    action: 'retry_operation' as RecoveryAction,
                    suppressLogging: false,
                    retryDelayMs: 10,
                })
                .mockResolvedValueOnce({
                    action: 'fallback' as RecoveryAction,
                    suppressLogging: false,
                }),
            onWarning: vi.fn(),
            onPluginDisabled: vi.fn(),
            onPluginRecovered: vi.fn(),
        }
        
        const customBoundary = new PluginErrorBoundary('test', customHandler)
        
        const result = await customBoundary.execute('test-op', () => {
            attempts++
            if (attempts === 1) throw new Error('fail')
            return 'success'
        }, { fallback: 'fallback' })
        
        expect(attempts).toBe(2)
        expect(result).toBe('success')
    })

    it('disables plugin on disable_plugin action', async () => {
        const customHandler = {
            onError: vi.fn().mockResolvedValue({
                action: 'disable_plugin' as RecoveryAction,
                suppressLogging: false,
            }),
            onWarning: vi.fn(),
            onPluginDisabled: vi.fn(),
            onPluginRecovered: vi.fn(),
        }
        
        const customBoundary = new PluginErrorBoundary('test', customHandler)
        
        await expect(customBoundary.execute('test-op', () => {
            throw new Error('fail')
        }, { fallback: 'fallback' })).resolves.toBe('fallback')
        
        expect(customBoundary.isPluginDisabled()).toBe(true)
        
        // Subsequent calls should fail immediately
        await expect(customBoundary.execute('test-op', () => 'success')).rejects.toThrow(
            'failed during test-op'
        )
    })

    it('can be manually enabled/disabled', () => {
        expect(boundary.isPluginDisabled()).toBe(false)
        
        boundary.disable()
        expect(boundary.isPluginDisabled()).toBe(true)
        
        boundary.enable()
        expect(boundary.isPluginDisabled()).toBe(false)
    })

    it('can be reset', async () => {
        const customHandler = {
            onError: vi.fn().mockResolvedValue({
                action: 'disable_plugin' as RecoveryAction,
                suppressLogging: false,
            }),
            onWarning: vi.fn(),
            onPluginDisabled: vi.fn(),
            onPluginRecovered: vi.fn(),
            resetFailureCount: vi.fn(),
        }
        
        const customBoundary = new PluginErrorBoundary('test', customHandler)
        
        await customBoundary.execute('test-op', () => {
            throw new Error('fail')
        }, { fallback: 'fallback' })
        
        expect(customBoundary.isPluginDisabled()).toBe(true)
        
        customBoundary.reset()
        
        expect(customBoundary.isPluginDisabled()).toBe(false)
        expect(customHandler.resetFailureCount).toHaveBeenCalledWith('test')
    })

    it('logs warnings through handler', () => {
        const warnSpy = vi.spyOn(handler, 'onWarning')
        
        boundary.warn('Test warning', { detail: 'info' })
        
        expect(warnSpy).toHaveBeenCalledWith('test-plugin', 'Test warning', { detail: 'info' })
    })
})

describe('PluginErrorBoundaryFactory', () => {
    it('creates boundaries with shared handler', () => {
        const handler = new DefaultPluginErrorHandler()
        const factory = new PluginErrorBoundaryFactory(handler)
        
        const boundary1 = factory.createBoundary('plugin-1')
        const boundary2 = factory.createBoundary('plugin-2')
        
        expect(boundary1.getPluginName()).toBe('plugin-1')
        expect(boundary2.getPluginName()).toBe('plugin-2')
        expect(factory.getHandler()).toBe(handler)
    })
})

describe('Global error handler', () => {
    beforeEach(() => {
        // Reset to default
        setGlobalErrorHandler(new DefaultPluginErrorHandler())
    })

    it('allows setting custom global handler', () => {
        const customHandler = new DefaultPluginErrorHandler(5)
        setGlobalErrorHandler(customHandler)
        
        const factory = getGlobalErrorBoundaryFactory()
        expect(factory.getHandler()).toBe(customHandler)
    })

    it('creates boundaries using global handler', () => {
        const boundary = createPluginErrorBoundary('test-plugin')
        
        expect(boundary.getPluginName()).toBe('test-plugin')
    })
})

describe('GracefulDegradation', () => {
    it('provides default values for all hook types', () => {
        expect(GracefulDegradation.forInit(42)).toBe(42)
        expect(GracefulDegradation.forHook('default')).toBe('default')
        expect(GracefulDegradation.forTrackLoad({ id: 'track' })).toEqual({ id: 'track' })
        expect(GracefulDegradation.forPlay()).toBeUndefined()
        expect(GracefulDegradation.forPause()).toBeUndefined()
        expect(GracefulDegradation.forSeek(50)).toBe(50)
        expect(GracefulDegradation.forTimeUpdate(25)).toBe(25)
        expect(GracefulDegradation.forTrackEnded()).toBe(false)
        expect(GracefulDegradation.forDestroy()).toBeUndefined()
    })
})

describe('isPluginError type guard', () => {
    it('returns true for PluginError instances', () => {
        const error = new PluginError('test', 'op', new Error(), true)
        expect(isPluginError(error)).toBe(true)
    })

    it('returns false for regular Errors', () => {
        expect(isPluginError(new Error('regular'))).toBe(false)
    })

    it('returns false for other values', () => {
        expect(isPluginError(null)).toBe(false)
        expect(isPluginError(undefined)).toBe(false)
        expect(isPluginError('string')).toBe(false)
        expect(isPluginError({})).toBe(false)
    })
})

// Integration test with PluginManager
describe('PluginManager with error boundaries', () => {
    let context: PluginPlayerContext
    let options: PluginManagerOptions

    beforeEach(() => {
        context = createMockContext()
        options = {
            maxFailuresBeforeDisable: 2,
        }
    })

    it('registers plugins with error boundaries', () => {
        const manager = new PluginManager(context, options)
        
        const plugin: AudioPlayerPlugin = {
            name: 'test-plugin',
            init: vi.fn(),
            destroy: vi.fn(),
        }
        
        manager.register(plugin)
        
        expect(manager.has('test-plugin')).toBe(true)
        expect(manager.getErrorBoundary('test-plugin')).toBeDefined()
    })

    it('handles init errors through error boundary', () => {
        const manager = new PluginManager(context, options)
        
        const plugin: AudioPlayerPlugin = {
            name: 'failing-plugin',
            init: () => { throw new Error('Init failed') },
            destroy: vi.fn(),
        }
        
        manager.register(plugin)
        
        // Plugin should not be registered due to init failure
        expect(manager.has('failing-plugin')).toBe(false)
    })

    it('tracks disabled plugins', () => {
        const manager = new PluginManager(context, { maxFailuresBeforeDisable: 1 })
        
        const plugin: AudioPlayerPlugin = {
            name: 'test-plugin',
            init: vi.fn(),
            destroy: vi.fn(),
            onPlay: () => { throw new Error('Hook failed') },
        }
        
        manager.register(plugin)
        
        // Trigger the hook - first failure
        manager.trigger('onPlay')
        
        // Plugin should still be registered but disabled
        expect(manager.isPluginDisabled('test-plugin')).toBe(true)
        
        // Second trigger should not execute the hook
        manager.trigger('onPlay')
    })

    it('can re-enable disabled plugins', () => {
        const manager = new PluginManager(context, { maxFailuresBeforeDisable: 1 })
        
        const plugin: AudioPlayerPlugin = {
            name: 'test-plugin',
            init: vi.fn(),
            destroy: vi.fn(),
            onPlay: () => { throw new Error('Hook failed') },
        }
        
        manager.register(plugin)
        manager.trigger('onPlay')
        
        expect(manager.isPluginDisabled('test-plugin')).toBe(true)
        
        const reenabled = manager.enablePlugin('test-plugin')
        
        expect(reenabled).toBe(true)
        expect(manager.isPluginDisabled('test-plugin')).toBe(false)
    })

    it('exposes error boundary for direct access', () => {
        const manager = new PluginManager(context)
        
        const plugin: AudioPlayerPlugin = {
            name: 'test-plugin',
            init: vi.fn(),
            destroy: vi.fn(),
        }
        
        manager.register(plugin)
        
        const boundary = manager.getErrorBoundary('test-plugin')
        
        expect(boundary).toBeDefined()
        expect(boundary?.getPluginName()).toBe('test-plugin')
    })
})

// Example plugin demonstrating error boundary usage
describe('Example: Plugin with error boundary', () => {
    it('demonstrates proper error handling in plugin hooks', async () => {
        const handler = new DefaultPluginErrorHandler()
        const boundary = new PluginErrorBoundary('example-plugin', handler)
        
        // Simulate a plugin that might fail in various ways
        class ExamplePlugin {
            private boundary: PluginErrorBoundary
            
            constructor(boundary: PluginErrorBoundary) {
                this.boundary = boundary
            }
            
            async onTrackLoad(track: unknown) {
                return this.boundary.execute<{ processed: boolean; track: unknown }>('hook:onTrackLoad', async () => {
                    // Simulate async operation that might fail
                    if (!track) throw new Error('No track provided')
                    return { processed: true, track }
                }, {
                    fallback: { processed: false, track: null },
                    severity: 'warning',
                })
            }
            
            onPlay() {
                this.boundary.executeSync('hook:onPlay', () => {
                    // Synchronous operation that might throw
                    throw new Error('Play failed')
                }, {
                    severity: 'warning',
                })
            }
            
            async riskyOperation() {
                return this.boundary.execute('risky-op', async () => {
                    await new Promise(r => setTimeout(r, 10))
                    if (Math.random() > 0.5) throw new Error('Random failure')
                    return 'success'
                }, {
                    recoverable: true,
                    fallback: 'recovered',
                })
            }
        }
        
        const plugin = new ExamplePlugin(boundary)
        
        // Test successful track load
        const result1 = await plugin.onTrackLoad({ id: 'track-1' })
        expect(result1.processed).toBe(true)
        
        // Test failed track load (with fallback)
        const result2 = await plugin.onTrackLoad(null)
        expect(result2.processed).toBe(false)
        
        // Test warning-level error (doesn't throw)
        plugin.onPlay() // Should not throw, just log warning
        
        // Test recoverable operation
        const result3 = await plugin.riskyOperation()
        expect(['success', 'recovered']).toContain(result3)
    })
})