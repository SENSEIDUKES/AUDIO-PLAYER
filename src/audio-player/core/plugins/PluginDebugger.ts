export interface PluginDebugInfo {
    name: string
    initialized: boolean
    lastHookCalled: string | null
    lastHookTime: number | null
    errorCount: number
    memoryUsage?: number
}

type AudioPlayerDebugWindow = Window & {
    AUDIO_PLAYER_DEBUG?: "1" | 1
}

type AudioPlayerImportMeta = ImportMeta & {
    env?: {
        AUDIO_PLAYER_DEBUG?: string
    }
}

type PerformanceWithMemory = Performance & {
    memory?: {
        usedJSHeapSize?: number
    }
}

export class PluginDebugger {
    private debugMode: boolean = false
    private hooks: Map<string, number> = new Map()

    constructor() {
        if (typeof window !== "undefined") {
            const debugWindow = window as AudioPlayerDebugWindow
            const debugImportMeta = import.meta as AudioPlayerImportMeta
            if (
                debugWindow.AUDIO_PLAYER_DEBUG === "1" ||
                debugWindow.AUDIO_PLAYER_DEBUG === 1 ||
                debugImportMeta.env?.AUDIO_PLAYER_DEBUG === "1"
            ) {
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
        if (typeof performance !== "undefined") {
            return (performance as PerformanceWithMemory).memory?.usedJSHeapSize
        }
        return undefined
    }
}
