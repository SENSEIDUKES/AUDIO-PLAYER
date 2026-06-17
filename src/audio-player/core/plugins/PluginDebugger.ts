export interface PluginDebugInfo {
    name: string
    initialized: boolean
    lastHookCalled: string | null
    lastHookTime: number | null
    errorCount: number
    memoryUsage?: number
}

export class PluginDebugger {
    private debugMode: boolean = false
    private hooks: Map<string, number> = new Map()

    constructor() {
        if (typeof window !== "undefined") {
            // @ts-ignore
            if (window.AUDIO_PLAYER_DEBUG === "1" || window.AUDIO_PLAYER_DEBUG === 1 || import.meta.env?.AUDIO_PLAYER_DEBUG === "1") {
                this.debugMode = true
            }
        }
    }

    measure<T>(plugin: string, hook: string, fn: () => T): T {
        if (!this.debugMode) return fn()

        const start = performance.now()
        try {
            return fn()
        } finally {
            const duration = performance.now() - start
            this.hooks.set(`${plugin}:${hook}`, duration)
            console.log(`[Plugin:${plugin}] ${hook} took ${duration.toFixed(2)}ms`)
        }
    }

    async measureAsync<T>(plugin: string, hook: string, fn: () => Promise<T>): Promise<T> {
        if (!this.debugMode) return fn()

        const start = performance.now()
        try {
            return await fn()
        } finally {
            const duration = performance.now() - start
            this.hooks.set(`${plugin}:${hook}`, duration)
            console.log(`[Plugin:${plugin}] ${hook} took ${duration.toFixed(2)}ms`)
        }
    }

    getMemoryUsage(): number | undefined {
        if (typeof performance !== "undefined" && "memory" in performance) {
            // @ts-ignore
            return performance.memory.usedJSHeapSize
        }
        return undefined
    }
}
