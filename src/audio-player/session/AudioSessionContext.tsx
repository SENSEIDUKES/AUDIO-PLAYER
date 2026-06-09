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
    RepeatMode,
    SessionEngine,
    Track,
} from "../types"
import { useAudioPlayer } from "../useAudioPlayer"

const AudioSessionContext = createContext<SessionEngine | null>(null)

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
}: AudioSessionProviderProps) {
    const [queue, setQueueState] = useState<Track[]>(initialQueue)
    const [currentIndex, setCurrentIndex] = useState<number>(
        initialQueue.length > 0
            ? Math.min(Math.max(initialIndex, 0), initialQueue.length - 1)
            : -1
    )
    const [shuffle, setShuffle] = useState(initialShuffle)
    const [repeatMode, setRepeatMode] = useState<RepeatMode>(initialRepeat)

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

    // Forward declaration: onEnded needs the latest queue navigation logic.
    const advanceRef = useRef<() => void>(() => {})

    const engine = useAudioPlayer({
        src,
        autoPlay,
        loop: repeatMode === "one", // native loop suppresses `ended` (no double-advance)
        onEnded: () => advanceRef.current(),
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

    // End-of-track auto-advance: always continue into the next track. We force
    // the deferred play here because the engine has already flipped its internal
    // "was playing" flag to false by the time onEnded fires, so its own continue
    // path won't run.
    advanceRef.current = () => {
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

    // Start playback for any pending request after a track change. Keyed on
    // `currentIndex` (the navigation signal) rather than `src`, so it still
    // fires when two queue entries happen to share the same audio URL. The
    // engine's own [src] effect is registered earlier in the body, so any
    // needed reload has already run; the ref guard keeps this idempotent.
    useEffect(() => {
        if (pendingPlayRef.current) {
            pendingPlayRef.current = false
            if (src) engine.play(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex])

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
            const existing = queue.findIndex(
                (t) => t.audioFile === track.audioFile && t.title === track.title
            )
            if (existing !== -1) {
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
        [queue, goTo, engine.isPlaying]
    )

    const next = useCallback(() => {
        const target = stepIndex(currentIndex, 1)
        if (target !== null) goTo(target, engine.isPlaying)
    }, [stepIndex, currentIndex, goTo, engine.isPlaying])

    const previous = useCallback(() => {
        // Restart the current track if we're more than 3s in.
        if (engine.currentTime > 3) {
            engine.seek(0)
            return
        }
        const target = stepIndex(currentIndex, -1)
        if (target !== null) goTo(target, engine.isPlaying)
    }, [stepIndex, currentIndex, goTo, engine])

    const clearQueue = useCallback(() => {
        engine.pause()
        setQueueState([])
        setCurrentIndex(-1)
    }, [engine])

    const toggleShuffle = useCallback(() => setShuffle((s) => !s), [])

    const cycleRepeat = useCallback(() => {
        setRepeatMode((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))
    }, [])

    const canNext = stepIndex(currentIndex, 1) !== null
    const canPrevious = queue.length > 1 || engine.currentTime > 3

    const value = useMemo<SessionEngine>(
        () => ({
            ...engine,
            queue,
            currentIndex,
            currentTrack,
            shuffle,
            repeatMode,
            canNext,
            canPrevious,
            setQueue,
            playTrack,
            enqueue,
            playNow,
            next,
            previous,
            clearQueue,
            toggleShuffle,
            cycleRepeat,
        }),
        [
            engine,
            queue,
            currentIndex,
            currentTrack,
            shuffle,
            repeatMode,
            canNext,
            canPrevious,
            setQueue,
            playTrack,
            enqueue,
            playNow,
            next,
            previous,
            clearQueue,
            toggleShuffle,
            cycleRepeat,
        ]
    )

    return (
        <AudioSessionContext.Provider value={value}>
            {/* The single, app-wide audio element. Skins never render their own. */}
            <audio ref={engine.audioRef} src={src || undefined} />
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
