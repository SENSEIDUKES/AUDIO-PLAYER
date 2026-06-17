import { z } from 'zod'

export function validateConfig<T extends z.ZodTypeAny>(schema: T, config: unknown, pluginName: string): z.infer<T> {
    const result = schema.safeParse(config)
    if (result.success) {
        return result.data
    }
    console.warn(`[Plugin:${pluginName}] Configuration validation failed, falling back to safe defaults.`, result.error)
    const fallbackResult = schema.safeParse({})
    if (fallbackResult.success) {
        return fallbackResult.data
    }
    return {} as z.infer<T>
}

export const WaveformPluginConfigSchema = z.object({
    name: z.string().optional().default("waveform"),
    prewarmPeaks: z.boolean().optional().default(true)
})

export const SleepTimerPluginConfigSchema = z.object({
    name: z.string().optional().default("sleep-timer"),
    label: z.string().optional().default("Sleep"),
    renderUi: z.boolean().optional().default(true),
    target: z.custom<HTMLElement | (() => HTMLElement | null) | null>().optional(),
    now: z.custom<() => number>((val) => typeof val === 'function').optional()
})

export const LyricsPluginConfigSchema = z.object({
    name: z.string().optional().default("lyrics"),
    lyrics: z.string().optional(),
    lines: z.array(z.object({
        time: z.number(),
        text: z.string()
    })).optional(),
    onLineChange: z.custom<Function>((val) => typeof val === 'function').optional(),
    target: z.custom<HTMLElement | (() => HTMLElement | null) | null>().optional()
})

export const KeyboardShortcutPluginConfigSchema = z.object({
    name: z.string().optional().default("keyboard-shortcuts"),
    scope: z.enum(["root", "document"]).optional().default("root"),
    seekSeconds: z.number().positive().optional().default(10),
    enableJKL: z.boolean().optional().default(true),
    enablePlaylistKeys: z.boolean().optional().default(true)
})

export const AutoThemePluginConfigSchema = z.object({
    name: z.string().optional().default("auto-theme"),
    applyGlow: z.boolean().optional().default(true),
    applyGradient: z.boolean().optional().default(true),
    sampleSize: z.number().positive().optional(),
    quantStep: z.number().positive().optional(),
    onPaletteChange: z.custom<Function>((val) => typeof val === 'function').optional()
})

export const AutomixPluginConfigSchema = z.object({
    name: z.string().optional().default("automix"),
    enabled: z.boolean().optional().default(true),
    confidenceMin: z.number().min(0).max(1).optional().default(0.1),
    onTransitionChange: z.custom<Function>((val) => typeof val === 'function').optional()
})

export const AnalyticsPluginConfigSchema = z.object({
    name: z.string().optional().default("analytics"),
    endpoint: z.union([z.string().url(), z.string().startsWith('/')]).optional(),
    send: z.custom<Function>((val) => typeof val === 'function').optional(),
    includeTimeUpdates: z.boolean().optional().default(false),
    timeUpdateIntervalSeconds: z.number().positive().optional().default(15),
})
