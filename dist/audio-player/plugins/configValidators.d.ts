import { z } from 'zod';
export declare function validateConfig<T extends z.ZodTypeAny>(schema: T, config: unknown, pluginName: string): z.infer<T>;
export declare const WaveformPluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    prewarmPeaks: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const SleepTimerPluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    label: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    renderUi: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    target: z.ZodOptional<z.ZodCustom<HTMLElement | (() => HTMLElement | null) | null, HTMLElement | (() => HTMLElement | null) | null>>;
    now: z.ZodOptional<z.ZodCustom<() => number, () => number>>;
}, z.core.$strip>;
export declare const LyricsPluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    lyrics: z.ZodOptional<z.ZodString>;
    lines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        time: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>>>;
    onLineChange: z.ZodOptional<z.ZodCustom<Function, Function>>;
    target: z.ZodOptional<z.ZodCustom<HTMLElement | (() => HTMLElement | null) | null, HTMLElement | (() => HTMLElement | null) | null>>;
}, z.core.$strip>;
export declare const KeyboardShortcutPluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    scope: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        root: "root";
        document: "document";
    }>>>;
    seekSeconds: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    enableJKL: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    enablePlaylistKeys: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const AutoThemePluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    applyGlow: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    applyGradient: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sampleSize: z.ZodOptional<z.ZodNumber>;
    quantStep: z.ZodOptional<z.ZodNumber>;
    onPaletteChange: z.ZodOptional<z.ZodCustom<Function, Function>>;
}, z.core.$strip>;
export declare const AutomixPluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    confidenceMin: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    onTransitionChange: z.ZodOptional<z.ZodCustom<Function, Function>>;
}, z.core.$strip>;
export declare const AnalyticsPluginConfigSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    endpoint: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
    send: z.ZodOptional<z.ZodCustom<Function, Function>>;
    includeTimeUpdates: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    timeUpdateIntervalSeconds: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
//# sourceMappingURL=configValidators.d.ts.map