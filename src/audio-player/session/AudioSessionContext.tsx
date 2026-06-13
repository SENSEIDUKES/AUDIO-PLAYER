import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type {
    AudioSessionProviderProps,
    AudioPlayerEngine,
    RepeatMode,
    SessionEngine,
    Track,
} from "../types"
import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
    PluginRenderSlot,
    PluginRenderSlotProps,
} from "../core/plugins/PluginInterface"
import { useAudioPlayer } from "../useAudioPlayer"
import { usePluginManager } from "../core/plugins/usePluginManager"
import { renderPluginSlot as renderPluginSlotContent } from "../core/plugins/renderPluginSlot"
import { createAutomixPlugin } from "../plugins/AutomixPlugin"
import { trackKey } from "../utils/trackKey"

const AudioSessionContext = createContext<SessionEngine | null>(null)
const EMPTY_PLUGINS: readonly AudioPlayerPlugin[] = []

/**
 * Build a playback order (a list of queue indices). When shuffle is off this is
 * the natural order. When on it is a Fisher–Yates shuffle with `startIndex`
 * pulled to the front so the current track keeps playing and the rest are
 * randomized — giving shuffle a definite end (so "repeat off" can stop).
 */
function buildOrder(length: number, startIndex: number, shuffle: boolean): number[] {
    const indices = Array.from({ length }, (_, i) => i)
    if (!shuffle || length <= 1) return indices
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const at = indices.indexOf(startIndex)
    if (at > 0) [indices[0], indices[at]] = [indices[at], indices[0]]
    return indices
}

/**
 * Owns the one and only `<audio>` element for the app plus the shared queue.
 * Internally reuses `useAudioPlayer` (the proven per-source engine) and drives
 * its `src` from the queue index. Every UI skin reads this via `useAudioSession`
 * and controls the same playback — so interacting with any skin updates all of
 * them, because there is a single audio element behind them.
 */
export function AudioSessionProvider({
    children,
    initialQueue = [],
    initialIndex = 0,
    autoPlay = false,
    repeatMode: initialRepeat = "off",
    shuffle: initialShuffle = false,
    automix: initialAutomix = false,
    plugins: externalPlugins = EMPTY_PLUGINS,
    audioBackend = "html5",
}: AudioSessionProviderProps) {
    const [queue, setQueueState] = useState<Track[]>(initialQueue)
    const [currentIndex, setCurrentIndex] = useState<number>(
        initialQueue.length > 0
            ? Math.min(Math.max(initialIndex, 0), initialQueue.length - 1)
            : -1
    )
    const [shuffle, setShuffle] = useState(initialShuffle)
    const [repeatMode, setRepeatMode] = useState<RepeatMode>(initialRepeat)
    const [automix, setAutomix] = useState(initialAutomix)

    // Playback order (queue indices). Computed during render so canNext /
    // canPrevious never read a stale value. Deliberately keyed on [queue,
    // shuffle] only: re-anchoring on every track change would reshuffle
    // mid-queue. The current index is used purely to seed the shuffle front.
    const order = useMemo(
        () => buildOrder(queue.length, currentIndex < 0 ? 0 : currentIndex, shuffle),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [queue, shuffle]
    )
    // Set true to play once the next source has loaded (used by end-of-track
    // advance, playTrack, playNow, and setQueue's autoPlay). We can't rely on
    // the engine's "continue if it was playing" path here because the engine
    // flips isPlaying to false *before* firing onEnded.
    const pendingPlayRef = useRef(false)

    const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null
    const src = currentTrack?.audioFile?.trim() ?? ""
    // Identity key for the engine's reset lifecycle. Encodes the queue position
    // AND the track identity so switching between two tracks that share the same
    // audio URL still resets currentTime/duration/buffered/error state — `src`
    // alone wouldn't change in that case.
    const sourceKey = currentTrack
        ? `${currentIndex}:${trackKey(currentTrack)}`
        : "empty"

    // Forward declaration: onEnded needs the latest queue navigation logic.
    const advanceRef = useRef<() => void>(() => {})

    const engine = useAudioPlayer({
        src,
        sourceKey,
        autoPlay,
        loop: repeatMode === "one", // native loop suppresses `ended` (no double-advance)
        onEnded: () => advanceRef.current(),
        audioBackend,
    })

    // Clamp the index if the queue shrinks out from under it.
    useEffect(() => {
        if (queue.length === 0 && currentIndex !== -1) setCurrentIndex(-1)
        else if (currentIndex >= queue.length) setCurrentIndex(queue.length - 1)
    }, [queue.length, currentIndex])

    // Resolve the queue index that sits `dir` steps from `from` in play order.
    // Returns null when there is nothing to advance to (end + repeat off).
    const stepIndex = useCallback(
        (from: number, dir: 1 | -1): number | null => {
            if (order.length === 0) return null
            const pos = order.indexOf(from)
            // No active track yet: "next" starts at the first track in order.
            if (pos === -1) return dir === 1 ? order[0] : null
            let nextPos = pos + dir
            if (nextPos >= order.length) {
                if (repeatMode === "all") nextPos = 0
                else return null
            } else if (nextPos < 0) {
                nextPos = repeatMode === "all" ? order.length - 1 : 0
            }
            return order[nextPos]
        },
        [order, repeatMode]
    )

    // Move to a queue index, optionally requesting playback once it loads.
    // When the engine is already playing it continues across the source swap on
    // its own (the engine's "was playing" path), so we only arm a deferred play
    // when we want playback but are currently paused — avoiding a double play().
    const goTo = useCallback(
        (index: number, wantPlay: boolean) => {
            if (index < 0 || index >= queue.length) return
            if (index === currentIndex) {
                // Same source: the [src] effect won't re-fire, so act directly.
                if (wantPlay && !engine.isPlaying) engine.play(true)
                return
            }
            if (wantPlay && !engine.isPlaying) pendingPlayRef.current = true
            setCurrentIndex(index)
        },
        [queue.length, currentIndex, engine]
    )

    // Raw queue advance shared by the natural end-of-track path and Automix
    // handoffs. Kept in a ref so the automix hook always calls the latest
    // closure without routing back through the onEnded guard below.
    const advanceToNextRef = useRef<() => void>(() => {})
    advanceToNextRef.current = () => {
        const next = stepIndex(currentIndex, 1)
        if (next === null) return
        if (next === currentIndex) {
            // Single-track repeat-all: restart in place.
            engine.seek(0)
            engine.play(true)
            return
        }
        pendingPlayRef.current = true
        setCurrentIndex(next)
    }
    const requestAdvance = useCallback(() => advanceToNextRef.current(), [])

    const pluginNextIndex =
        repeatMode !== "one" ? stepIndex(currentIndex, 1) : null
    const pluginNextTrack =
        pluginNextIndex !== null && pluginNextIndex !== currentIndex
            ? queue[pluginNextIndex] ?? null
            : null

    // Compatibility bridge: the legacy session `automix` flag preserves the
    // old basic crossfade behavior. New smart AutoMix should be registered as
    // a plugin until a core crossfade API lands.
    const legacyAutomixPlugin = useMemo(
        () => (automix ? createAutomixPlugin({ smartAnalysis: false }) : null),
        [automix]
    )
    const activePlugins = useMemo<readonly AudioPlayerPlugin[]>(() => {
        const plugins: AudioPlayerPlugin[] = []
        if (legacyAutomixPlugin) plugins.push(legacyAutomixPlugin)
        plugins.push(...externalPlugins)
        return plugins
    }, [externalPlugins, legacyAutomixPlugin])

    const pluginContextStateRef = useRef({
        engine,
        currentTrack,
        nextTrack: pluginNextTrack,
        sourceKey,
        queue,
        currentIndex,
        repeatMode,
        shuffle,
        requestAdvance,
        next: () => {},
        previous: () => {},
    })

    const pluginContext = useMemo<PluginPlayerContext>(
        () => ({
            getEngine: () => pluginContextStateRef.current.engine,
            getRootElement: () => null,
            getAudioElement: () => pluginContextStateRef.current.engine.audioRef.current,
            getCurrentTrack: () => pluginContextStateRef.current.currentTrack,
            getNextTrack: () => pluginContextStateRef.current.nextTrack,
            getSourceKey: () => pluginContextStateRef.current.sourceKey,
            requestAdvance: () => pluginContextStateRef.current.requestAdvance(),
            next: () => pluginContextStateRef.current.next(),
            previous: () => pluginContextStateRef.current.previous(),
            getQueue: () => pluginContextStateRef.current.queue,
            getCurrentIndex: () => pluginContextStateRef.current.currentIndex,
            getRepeatMode: () => pluginContextStateRef.current.repeatMode,
            getShuffle: () => pluginContextStateRef.current.shuffle,
        }),
        []
    )
    const pluginManager = usePluginManager(activePlugins, pluginContext)

    const seekWithPlugins = useCallback(
        (time: number) => {
            const nextPosition =
                engine.duration > 0 ? Math.max(0, Math.min(engine.duration, time)) : time
            engine.seek(time)
            pluginManager.trigger("onSeek", nextPosition)
        },
        [engine, pluginManager]
    )

    const seekByWithPlugins = useCallback(
        (delta: number) => {
            const base = engine.audioRef.current?.currentTime ?? engine.currentTime
            seekWithPlugins(base + delta)
        },
        [engine.audioRef, engine.currentTime, seekWithPlugins]
    )

    const pluginAwareEngine = useMemo<AudioPlayerEngine>(
        () => ({
            ...engine,
            seek: seekWithPlugins,
            seekBy: seekByWithPlugins,
        }),
        [engine, seekByWithPlugins, seekWithPlugins]
    )

    pluginContextStateRef.current = {
        engine: pluginAwareEngine,
        currentTrack,
        nextTrack: pluginNextTrack,
        sourceKey,
        queue,
        currentIndex,
        repeatMode,
        shuffle,
        requestAdvance,
        next: () => {},
        previous: () => {},
    }

    // End-of-track auto-advance: always continue into the next track. We force
    // the deferred play here because the engine has already flipped its internal
    // "was playing" flag to false by the time onEnded fires, so its own continue
    // path won't run. Transition plugins can claim the event first to avoid a
    // double advance during handoff.
    advanceRef.current = () => {
        if (pluginManager.triggerUntilHandled("onTrackEnded", currentTrack)) return
        advanceToNextRef.current()
    }

    useEffect(() => {
        pluginManager.trigger("onTrackLoad", currentTrack)
    }, [pluginManager, sourceKey, currentTrack])

    const previousPluginPlayingRef = useRef(engine.isPlaying)
    useEffect(() => {
        if (previousPluginPlayingRef.current === engine.isPlaying) return
        previousPluginPlayingRef.current = engine.isPlaying
        pluginManager.trigger(engine.isPlaying ? "onPlay" : "onPause")
    }, [pluginManager, engine.isPlaying])

    useEffect(() => {
        pluginManager.trigger("onTimeUpdate", engine.currentTime)
    }, [pluginManager, engine.currentTime])

    useEffect(() => {
        if (!engine.hasAudio || queue.length === 0) pluginManager.trigger("onStop")
    }, [pluginManager, engine.hasAudio, queue.length])

    useEffect(() => () => {
        pluginManager.trigger("onStop")
    }, [pluginManager])

    // Start playback for any pending request after a track/source change. Keyed
    // on both `sourceKey` and `src`: a same-id active refresh can keep the
    // sourceKey stable while changing a re-signed/new audioFile URL. The
    // engine's own [src, sourceKey] reset effect is registered earlier in the
    // body, so any needed reload has already run; the ref guard keeps this
    // idempotent and prevents stale pending plays from leaking into later
    // navigation.
    useEffect(() => {
        if (pendingPlayRef.current) {
            pendingPlayRef.current = false
            if (src) engine.play(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey, src])

    const setQueue = useCallback(
        (tracks: Track[], startIndex = 0, autoPlayNext = false) => {
            const idx = tracks.length > 0
                ? Math.min(Math.max(startIndex, 0), tracks.length - 1)
                : -1
            // `order` recomputes from the new queue during the next render.
            // If already playing, the engine continues into the new source; only
            // arm a deferred play when starting from a paused session.
            if (autoPlayNext && idx >= 0 && !engine.isPlaying) {
                pendingPlayRef.current = true
            }
            setQueueState(tracks)
            setCurrentIndex(idx)
        },
        [engine.isPlaying]
    )

    const playTrack = useCallback(
        (index: number) => goTo(index, true),
        [goTo]
    )

    const enqueue = useCallback((track: Track) => {
        setQueueState((q) => [...q, track])
    }, [])

    const playNow = useCallback(
        (track: Track) => {
            const key = trackKey(track)
            const existing = queue.findIndex((t) => trackKey(t) === key)
            if (existing !== -1) {
                // A track with the same identity (e.g. a stable id) is already
                // queued, but its audioFile/metadata may have been refreshed
                // (re-signed CDN URL, updated title). Replace the stale entry
                // with the fresh argument so we don't replay old data.
                if (queue[existing] !== track) {
                    setQueueState((q) =>
                        q.map((t, i) => (i === existing ? track : t))
                    )
                    if (existing === currentIndex) {
                        const nextSrc = track.audioFile?.trim() ?? ""
                        const sourceChanged = nextSrc !== src
                        if (!engine.isPlaying) {
                            if (sourceChanged) {
                                // Same stable id, new active URL: sourceKey is
                                // unchanged, so consume the deferred play on the
                                // `src` effect instead of leaking it to a later
                                // navigation.
                                pendingPlayRef.current = true
                            } else {
                                engine.play(true)
                            }
                        }
                        return
                    }
                }
                goTo(existing, true)
                return
            }
            const nextIndex = queue.length
            // If paused, arm a deferred play; if already playing, the engine
            // continues into the appended track on its own.
            if (!engine.isPlaying) pendingPlayRef.current = true
            setQueueState((q) => [...q, track])
            setCurrentIndex(nextIndex)
        },
        [queue, goTo, engine, currentIndex, src]
    )

    const next = useCallback(() => {
        const target = stepIndex(currentIndex, 1)
        if (target !== null) goTo(target, engine.isPlaying)
    }, [stepIndex, currentIndex, goTo, engine.isPlaying])

    const previous = useCallback(() => {
        // Restart the current track if we're more than 3s in.
        if (engine.currentTime > 3) {
            seekWithPlugins(0)
            return
        }
        const target = stepIndex(currentIndex, -1)
        if (target !== null) goTo(target, engine.isPlaying)
    }, [stepIndex, currentIndex, goTo, engine.currentTime, engine.isPlaying, seekWithPlugins])

    // Move a queue item from one index to another (drag-and-drop reorder).
    // Preserves the current index pointing to the active track.
    const moveQueueItem = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (fromIndex === toIndex) return
            if (fromIndex < 0 || fromIndex >= queue.length) return
            if (toIndex < 0 || toIndex >= queue.length) return

            setQueueState((q) => {
                const next = [...q]
                const [moved] = next.splice(fromIndex, 1)
                next.splice(toIndex, 0, moved)

                // Adjust currentIndex to stay on the same track.
                // If the moved track was after currentIndex and inserted before it,
                // or before and inserted after, the currentIndex needs shifting.
                if (fromIndex === currentIndex) {
                    // The active track was moved — update currentIndex to its new position.
                    // We'll update it in a separate setState.
                } else {
                    // A non-active track moved. Adjust currentIndex if needed.
                    // The currentIndex shifts +1 if the removed gap was before it and the
                    // insertion point is after it, or -1 if the gap was after it and the
                    // insertion point is before it, etc.
                    let adjusted = currentIndex
                    if (fromIndex < currentIndex && toIndex >= currentIndex) {
                        adjusted = currentIndex - 1
                    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
                        adjusted = currentIndex + 1
                    }
                    if (adjusted !== currentIndex) {
                        // Use queueMicrotask to avoid setState-during-render.
                        queueMicrotask(() => setCurrentIndex(adjusted))
                    }
                }
                return next
            })

            // If the active track was moved, update currentIndex in the next microtask
            // to avoid setting state during render.
            if (fromIndex === currentIndex) {
                queueMicrotask(() => setCurrentIndex(toIndex))
            }
        },
        [queue.length, currentIndex]
    )

    // Remove a track from the queue by index. No-op if it's the active track
    // (we don't want to stop playback by removing what's playing).
    const removeFromQueue = useCallback(
        (index: number) => {
            if (index < 0 || index >= queue.length) return
            // Prevent removing the currently playing track.
            if (index === currentIndex) return

            setQueueState((q) => {
                const next = [...q]
                next.splice(index, 1)
                return next
            })

            // Adjust currentIndex if removal happened before the active track.
            if (index < currentIndex) {
                setCurrentIndex((ci) => ci - 1)
            }
        },
        [queue.length, currentIndex]
    )

    pluginContextStateRef.current = {
        engine: pluginAwareEngine,
        currentTrack,
        nextTrack: pluginNextTrack,
        sourceKey,
        queue,
        currentIndex,
        repeatMode,
        shuffle,
        requestAdvance,
        next,
        previous,
    }

    const clearQueue = useCallback(() => {
        engine.pause()
        setQueueState([])
        setCurrentIndex(-1)
    }, [engine])

    const toggleShuffle = useCallback(() => setShuffle((s) => !s), [])

    const cycleRepeat = useCallback(() => {
        setRepeatMode((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))
    }, [])

    const toggleAutomix = useCallback(() => setAutomix((v) => !v), [])

    const canNext = stepIndex(currentIndex, 1) !== null
    const canPrevious = queue.length > 1 || engine.currentTime > 3
    const renderSessionPluginSlot = useCallback(
        function <K extends PluginRenderSlot>(
            slot: K,
            props: PluginRenderSlotProps[K]
        ) {
            return renderPluginSlotContent(activePlugins, slot, props)
        },
        [activePlugins]
    )

    const value = useMemo<SessionEngine>(
        () => ({
            ...pluginAwareEngine,
            sourceKey,
            queue,
            currentIndex,
            currentTrack,
            shuffle,
            repeatMode,
            automix,
            canNext,
            canPrevious,
            setQueue,
            playTrack,
            enqueue,
            playNow,
            next,
            previous,
            clearQueue,
            moveQueueItem,
            removeFromQueue,
            toggleShuffle,
            cycleRepeat,
            toggleAutomix,
            renderPluginSlot: renderSessionPluginSlot,
        }),
        [
            pluginAwareEngine,
            sourceKey,
            queue,
            currentIndex,
            currentTrack,
            shuffle,
            repeatMode,
            automix,
            canNext,
            canPrevious,
            setQueue,
            playTrack,
            enqueue,
            playNow,
            next,
            previous,
            clearQueue,
            moveQueueItem,
            removeFromQueue,
            toggleShuffle,
            cycleRepeat,
            toggleAutomix,
            renderSessionPluginSlot,
        ]
    )

    return (
        <AudioSessionContext.Provider value={value}>
            {/* The single, app-wide audio element. Skins never render their own. */}
            {engine.getBackendInfo().active === "html5" && (
                <audio ref={engine.audioRef} src={src || undefined} />
            )}
            {children}
        </AudioSessionContext.Provider>
    )
}

/** Read the global audio session. Throws if used outside an AudioSessionProvider. */
export function useAudioSession(): SessionEngine {
    const ctx = useContext(AudioSessionContext)
    if (!ctx) {
        throw new Error(
            "useAudioSession must be used within an <AudioSessionProvider>"
        )
    }
    return ctx
}
