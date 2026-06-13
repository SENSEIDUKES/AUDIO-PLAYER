import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PluginPlayerContext } from "../core/plugins/PluginInterface"
import { AutomixPlugin } from "../plugins/AutomixPlugin"
import type { AudioPlayerEngine, Track } from "../types"

export { AUTOMIX_FADE_MS } from "../plugins/AutomixPlugin"

export interface UseAutomixOptions {
    engine: AudioPlayerEngine
    /** Master switch. When false the hook does nothing at all. */
    enabled: boolean
    /** The host's source identity key (its `sourceKey`). */
    sourceKey: string
    currentTrack: Track | null
    /**
     * The track that would play after the current one, already resolved by the
     * host through its own shuffle/repeat order. Pass `null` when there is no
     * automixable next track (single-track mode, repeat-one, end of queue, or
     * the next index equals the current one).
     */
    nextTrack: Track | null
    /** @deprecated No-op retained for older callers. */
    suppressDeprecatedWarning?: boolean
    /**
     * Advance the queue to the next track using the host's normal end-of-track
     * path (deferred play + index change). Must NOT route back through the
     * host's `onEnded` guard, or the advance would suppress itself.
     */
    requestAdvance: () => void
}

export interface AutomixController {
    /** True while a crossfade or handoff is in progress. */
    isTransitioning: boolean
    /**
     * Must be called first inside the host's end-of-track advance handler.
     * Returns true when automix already advanced (or is advancing) the queue,
     * in which case the host must skip its own advance.
     */
    handleTrackEnded: () => boolean
}

/**
 * Deprecated compatibility adapter for older integrations.
 *
 * New hosts should register `createAutomixPlugin()` instead. This hook now
 * delegates to the same plugin implementation so the transition lifecycle stays
 * single-sourced.
 */
export function useAutomix(options: UseAutomixOptions): AutomixController {
    const [isTransitioning, setIsTransitioning] = useState(false)
    const optionsRef = useRef(options)
    optionsRef.current = options

    const pluginRef = useRef<AutomixPlugin | null>(null)
    if (pluginRef.current === null) {
        pluginRef.current = new AutomixPlugin({
            name: "legacy-use-automix",
            enabled: options.enabled,
            smartAnalysis: false,
            onTransitionChange: setIsTransitioning,
        })
    }

    const context = useMemo<PluginPlayerContext>(
        () => ({
            getEngine: () => optionsRef.current.engine,
            getRootElement: () => null,
            getAudioElement: () => optionsRef.current.engine.audioRef.current,
            getCurrentTrack: () => optionsRef.current.currentTrack,
            getNextTrack: () => optionsRef.current.nextTrack,
            getSourceKey: () => optionsRef.current.sourceKey,
            requestAdvance: () => optionsRef.current.requestAdvance(),
        }),
        []
    )

    useEffect(() => {
        const plugin = pluginRef.current
        if (!plugin) return
        plugin.init(context)
        plugin.onTrackLoad?.(optionsRef.current.currentTrack)
        return () => plugin.destroy()
    }, [context])

    useEffect(() => {
        pluginRef.current?.updateConfig({
            enabled: options.enabled,
            smartAnalysis: false,
        })
    }, [options.enabled])

    useEffect(() => {
        pluginRef.current?.onTrackLoad?.(options.currentTrack)
    }, [options.currentTrack, options.sourceKey])

    const previousPlayingRef = useRef(options.engine.isPlaying)
    useEffect(() => {
        if (previousPlayingRef.current === options.engine.isPlaying) return
        previousPlayingRef.current = options.engine.isPlaying
        pluginRef.current?.[options.engine.isPlaying ? "onPlay" : "onPause"]?.()
    }, [options.engine.isPlaying])

    useEffect(() => {
        if (options.engine.isSeeking) {
            pluginRef.current?.onSeek?.()
        }
        pluginRef.current?.onTimeUpdate?.()
    }, [
        options.currentTrack,
        options.engine.currentTime,
        options.engine.duration,
        options.engine.hasError,
        options.engine.isPlaying,
        options.engine.isSeeking,
        options.nextTrack,
        options.sourceKey,
    ])

    const handleTrackEnded = useCallback(
        () => pluginRef.current?.handleTrackEnded() ?? false,
        []
    )

    return { isTransitioning, handleTrackEnded }
}
