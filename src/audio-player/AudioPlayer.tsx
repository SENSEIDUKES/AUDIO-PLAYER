import {
    Component,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type {
    CSSProperties,
    KeyboardEvent,
    ReactNode,
} from "react"
import type { AudioPlayerProps, RepeatMode, Track } from "./types"
import type { AudioPlayerPlugin, PluginPlayerContext } from "./core/plugins/PluginInterface"
import { useAudioPlayer } from "./useAudioPlayer"
import { AutomixPlugin, createAutomixPlugin } from "./plugins/AutomixPlugin"
import {
    AUTOMIX_PLUGIN_NAME,
    hasAutomixPlugin,
    withInternalAutomix,
} from "./plugins/automixIntegration"
import { useMediaSessionObserver } from "./headless/useMediaSessionObserver"
import { usePluginManager } from "./core/plugins/usePluginManager"
import { ProgressBar } from "./components/ProgressBar"
import { WaveformProgress } from "./components/WaveformProgress"
import { VolumeControl } from "./components/VolumeControl"
import { QueueDrawer } from "./components/QueueDrawer"
import { SAPController } from "./components/SAPController"
import { useShareTrack } from "./components/useShareTrack"
import { formatTime } from "./utils/formatTime"
import { defaultShowVolume } from "./utils/device"
import { resolveTrackList } from "./utils/trackList"
import { trackKey } from "./utils/trackKey"
import "./audio-player.css"

const DEFAULT_AUDIO =
    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"
const EMPTY_PLUGINS: readonly AudioPlayerPlugin[] = []


function trackPeaksSignature(peaks: Track["peaks"]): string {
    if (!peaks) return ""
    return peaks
        .map((channel) => {
            const last = channel.length > 0 ? channel[channel.length - 1] : ""
            return `${channel.length}:${channel[0] ?? ""}:${last}`
        })
        .join(",")
}

function trackListSignature(tracks: Track[]): string {
    return JSON.stringify(
        tracks.map((track) => [
            trackKey(track),
            track.title ?? "",
            track.artist ?? "",
            track.audioFile ?? "",
            track.purchaseUrl ?? "",
            track.lyrics ?? "",
            track.waveformDuration ?? null,
            trackPeaksSignature(track.peaks),
        ])
    )
}

function buildPlaybackOrder(length: number, startIndex: number, shuffle: boolean): number[] {
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
 * React error boundary wrapping the player body. Keeps an unexpected render
 * error in a child component (slider, menu, etc.) from crashing the entire
 * host app. The fallback surfaces a minimal message and a way to retry the
 * render attempt.
 */
class AudioPlayerErrorBoundary extends Component<
    { children: ReactNode; fallbackTitle: string },
    { error: Error | null }
> {
    state = { error: null as Error | null }

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    componentDidCatch(error: Error) {
        // eslint-disable-next-line no-console
        console.error("[AudioPlayer] render error:", error)
    }

    handleReset = () => {
        this.setState({ error: null })
    }

    render() {
        if (this.state.error) {
            return (
                <div className="ap-error-boundary" role="alert">
                    <p className="ap-error-boundary__title">
                        {this.props.fallbackTitle}
                    </p>
                    <p className="ap-error-boundary__message">
                        {this.state.error.message}
                    </p>
                    <button
                        type="button"
                        className="ap-retry-btn"
                        onClick={this.handleReset}
                    >
                        Retry
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export function AudioPlayer(props: AudioPlayerProps) {
    return (
        <AudioPlayerErrorBoundary fallbackTitle="Audio player failed to render">
            <AudioPlayerInner {...props} />
        </AudioPlayerErrorBoundary>
    )
}

function AudioPlayerInner(props: AudioPlayerProps) {
    const {
        tracks: tracksProp,
        audioFile = DEFAULT_AUDIO,
        title = "Audio Track",
        artist = "Artist Name",
        purchaseUrl = "",
        lyrics = "",
        autoPlay = false,
        loop = false,
        shuffle = false,
        repeatMode: repeatModeProp,
        automix = false,
        backgroundImage,
        blurSize = 20,
        darkenAmount = 0,
        showTracklist = false,
        showVolume = defaultShowVolume(),
        showWaveform = false,
        waveformHeight = 48,
        titleFont,
        artistFont,
        accentColor = "#FFFFFF",
        playIconColor = "#000000",
        textColor = "#FFFFFF",
        progressColor = "#FFFFFF",
        trackColor = "rgba(204, 204, 204, 0.35)",
        backgroundColor = "rgba(255, 255, 255, 0)",
        glowColor = "transparent",
        plugins: externalPlugins = EMPTY_PLUGINS,
        audioBackend = "html5",
        className,
        style,
    } = props

    const tracks = resolveTrackList(tracksProp)
    const tracksSignature = useMemo(() => trackListSignature(tracks), [tracks])
    const isPlaylistMode = tracks.length > 0
    const [trackIndex, setTrackIndex] = useState(0)
    const [announcement, setAnnouncement] = useState("")
    const [controllerOpen, setControllerOpen] = useState(false)
    const [localAutoPlay, setLocalAutoPlay] = useState(autoPlay)
    const [localShuffle, setLocalShuffle] = useState(shuffle)
    const [localRepeatMode, setLocalRepeatMode] = useState<RepeatMode>(
        repeatModeProp ?? (loop ? "one" : "off")
    )
    const [localAutomix, setLocalAutomix] = useState(automix)
    // Editable local queue (copy of tracks prop, updated by reorder/remove).
    const [localQueue, setLocalQueue] = useState<Track[]>(tracks)
    const [queueOpen, setQueueOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const previousTracksSignatureRef = useRef(tracksSignature)

    // Sync localQueue only when the logical track list changes. Parent renders
    // often recreate the array instance; resetting on identity alone would wipe
    // local queue edits such as reorder/remove.
    useEffect(() => {
        if (previousTracksSignatureRef.current === tracksSignature) return
        previousTracksSignatureRef.current = tracksSignature
        setLocalQueue(tracks)
        setTrackIndex((index) => {
            if (tracks.length === 0) return 0
            return Math.min(index, tracks.length - 1)
        })
    }, [tracks, tracksSignature])

    // Keep local toggles in sync with prop changes (e.g. properties panel edits).
    useEffect(() => {
        setLocalAutoPlay(autoPlay)
    }, [autoPlay])
    useEffect(() => {
        setLocalShuffle(shuffle)
    }, [shuffle])
    useEffect(() => {
        setLocalRepeatMode(repeatModeProp ?? (loop ? "one" : "off"))
    }, [loop, repeatModeProp])
    useEffect(() => {
        setLocalAutomix(automix)
    }, [automix])

    // Keep the index valid if the queue shrinks / mode changes.
    useEffect(() => {
        if (isPlaylistMode && trackIndex >= localQueue.length) setTrackIndex(0)
        if (!isPlaylistMode && trackIndex !== 0) setTrackIndex(0)
    }, [isPlaylistMode, trackIndex, localQueue.length])

    const currentTrack: Track = useMemo(() => {
        if (isPlaylistMode && localQueue[trackIndex]) return localQueue[trackIndex]
        return { title, artist, audioFile, purchaseUrl, lyrics }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isPlaylistMode,
        localQueue,
        trackIndex,
        title,
        artist,
        audioFile,
        purchaseUrl,
        lyrics,
    ])

    const src = currentTrack.audioFile?.trim() ?? ""

    const sourceKey = isPlaylistMode
        ? `${trackIndex}:${trackKey(currentTrack)}`
        : src

    const playbackOrder = useMemo(
        () => buildPlaybackOrder(localQueue.length, trackIndex, localShuffle),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [localQueue, localShuffle]
    )

    const stepTrackIndex = useCallback(
        (from: number, direction: 1 | -1): number | null => {
            if (!isPlaylistMode || playbackOrder.length === 0) return null
            const position = playbackOrder.indexOf(from)
            if (position === -1) return direction === 1 ? playbackOrder[0] : null
            let nextPosition = position + direction
            if (nextPosition >= playbackOrder.length) {
                if (localRepeatMode === "all") nextPosition = 0
                else return null
            } else if (nextPosition < 0) {
                if (localRepeatMode === "all") nextPosition = playbackOrder.length - 1
                else return null
            }
            return playbackOrder[nextPosition]
        },
        [isPlaylistMode, playbackOrder, localRepeatMode]
    )

    const advanceRef = useRef<() => void>(() => {})
    const pendingPlayRef = useRef(false)

    const engine = useAudioPlayer({
        src,
        sourceKey,
        autoPlay: localAutoPlay,
        loop: localRepeatMode === "one",
        onEnded: () => advanceRef.current(),
        audioBackend,
    })

    const {
        audioRef,
        isPlaying,
        currentTime,
        duration,
        buffered,
        volume,
        isMuted,
        isBuffering,
        isSeeking,
        hasError,
        errorMessage,
        hasAudio,
        volumeUnsupported,
        autoplayBlocked,
        toggle,
        seek,
        setSeeking,
        setVolume,
        toggleMute,
        retry,
        dismissAutoplayBlocked,
    } = engine

    // `isBuffering` is the engine's gated source of truth: it is only true
    // during active or pending-play waiting, and is cleared on
    // pause/ended/error/source-reset. So the spinner renders straight from it —
    // no idle/paused spinner, but the initial pending-play load still shows one.
    const showPlaySpinner = isBuffering

    const goToTrack = useCallback(
        (next: number | null) => {
            if (!isPlaylistMode || next === null) return
            const clamped = ((next % localQueue.length) + localQueue.length) % localQueue.length
            if (clamped !== trackIndex) setTrackIndex(clamped)
        },
        [isPlaylistMode, trackIndex, localQueue.length]
    )

    const previousTrack = useCallback(
        () => goToTrack(stepTrackIndex(trackIndex, -1)),
        [goToTrack, stepTrackIndex, trackIndex]
    )
    const nextTrack = useCallback(
        () => goToTrack(stepTrackIndex(trackIndex, 1)),
        [goToTrack, stepTrackIndex, trackIndex]
    )

    const canPreviousTrack = isPlaylistMode && stepTrackIndex(trackIndex, -1) !== null
    const canNextTrack = isPlaylistMode && stepTrackIndex(trackIndex, 1) !== null

    // Continue playback after automatic end-of-track advances. The engine marks
    // itself paused before it calls onEnded, so its source-change continuation
    // path sees `wasPlaying === false`; this deferred play mirrors the global
    // session provider and keeps playlist playback seamless.
    useEffect(() => {
        if (pendingPlayRef.current) {
            pendingPlayRef.current = false
            if (src) engine.play(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey, src])

    // Raw playlist advance shared by the natural end-of-track path and Automix
    // handoffs (same split as the global session provider).
    const advanceToNextRef = useRef<() => void>(() => {})
    advanceToNextRef.current = () => {
        const next = stepTrackIndex(trackIndex, 1)
        if (next === null) return
        if (next === trackIndex) {
            seek(0)
            engine.play(true)
            return
        }
        pendingPlayRef.current = true
        setTrackIndex(next)
    }
    const requestAdvance = useCallback(() => advanceToNextRef.current(), [])

    const pluginNextIndex =
        isPlaylistMode && localRepeatMode !== "one"
            ? stepTrackIndex(trackIndex, 1)
            : null
    const pluginNextTrack =
        pluginNextIndex !== null && pluginNextIndex !== trackIndex
            ? localQueue[pluginNextIndex] ?? null
            : null

    // Automix runs through a single internal plugin (the same lifecycle plugin
    // external consumers use). Created once so its identity is stable across
    // renders — the rAF playback loop re-renders ~60/s and an unstable plugin
    // identity would make usePluginManager destroy/recreate it every frame.
    const automixPluginRef = useRef<AutomixPlugin | null>(null)
    if (automixPluginRef.current === null) {
        automixPluginRef.current = createAutomixPlugin({
            name: AUTOMIX_PLUGIN_NAME,
            // Enabled is driven entirely by the effect below (from the prop/menu).
            enabled: false,
        })
    }
    // If the consumer already supplied an external automix plugin, it wins and
    // the internal one is omitted entirely — only ever one Automix controller.
    const hasExternalAutomix = hasAutomixPlugin(externalPlugins)
    const automixEnabled =
        localAutomix && isPlaylistMode && !hasExternalAutomix
    useEffect(() => {
        automixPluginRef.current?.updateConfig({ enabled: automixEnabled })
    }, [automixEnabled])
    const allPlugins = useMemo<readonly AudioPlayerPlugin[]>(
        () => withInternalAutomix(externalPlugins, automixPluginRef.current!),
        [externalPlugins]
    )

    const pluginContextStateRef = useRef({
        engine,
        currentTrack: currentTrack as Track | null,
        nextTrack: pluginNextTrack as Track | null,
        sourceKey,
        tracks: localQueue,
        trackIndex,
        repeatMode: localRepeatMode,
        shuffle: localShuffle,
        requestAdvance,
        nextTrackFn: nextTrack,
        previousTrackFn: previousTrack,
    })
    pluginContextStateRef.current = {
        engine,
        currentTrack,
        nextTrack: pluginNextTrack,
        sourceKey,
        tracks: localQueue,
        trackIndex,
        repeatMode: localRepeatMode,
        shuffle: localShuffle,
        requestAdvance,
        nextTrackFn: nextTrack,
        previousTrackFn: previousTrack,
    }

    const pluginContext = useMemo<PluginPlayerContext>(
        () => ({
            getEngine: () => pluginContextStateRef.current.engine,
            getRootElement: () => rootRef.current,
            getAudioElement: () => pluginContextStateRef.current.engine.audioRef.current,
            getCurrentTrack: () => pluginContextStateRef.current.currentTrack,
            getNextTrack: () => pluginContextStateRef.current.nextTrack,
            getSourceKey: () => pluginContextStateRef.current.sourceKey,
            requestAdvance: () => pluginContextStateRef.current.requestAdvance(),
            next: () => pluginContextStateRef.current.nextTrackFn(),
            previous: () => pluginContextStateRef.current.previousTrackFn(),
            getQueue: () => pluginContextStateRef.current.tracks,
            getCurrentIndex: () => pluginContextStateRef.current.trackIndex,
            getRepeatMode: () => pluginContextStateRef.current.repeatMode,
            getShuffle: () => pluginContextStateRef.current.shuffle,
        }),
        []
    )
    const pluginManager = usePluginManager(allPlugins, pluginContext)
    const hasKeyboardShortcutPlugin = externalPlugins.some(
        (plugin) => plugin.handlesKeyboardShortcuts
    )

    // Single advance path: whichever plugin (internal automix or an external
    // one) claims the track-end suppresses the host advance, so a crossfade
    // handoff can never double-advance the queue.
    advanceRef.current = () => {
        if (pluginManager.triggerUntilHandled("onTrackEnded", currentTrack)) return
        advanceToNextRef.current()
    }

    useEffect(() => {
        pluginManager.trigger("onTrackLoad", currentTrack)
    }, [pluginManager, sourceKey, currentTrack])

    const previousPluginPlayingRef = useRef(isPlaying)
    useEffect(() => {
        if (previousPluginPlayingRef.current === isPlaying) return
        previousPluginPlayingRef.current = isPlaying
        pluginManager.trigger(isPlaying ? "onPlay" : "onPause")
    }, [pluginManager, isPlaying])

    useEffect(() => {
        pluginManager.trigger("onTimeUpdate", currentTime)
    }, [pluginManager, currentTime])

    useEffect(() => {
        if (!hasAudio) pluginManager.trigger("onStop")
    }, [pluginManager, hasAudio])

    useEffect(() => () => {
        pluginManager.trigger("onStop")
    }, [pluginManager])

    const seekWithPlugins = useCallback(
        (time: number) => {
            const next = duration > 0 ? Math.max(0, Math.min(duration, time)) : time
            seek(time)
            pluginManager.trigger("onSeek", next)
        },
        [duration, pluginManager, seek]
    )

    const seekByWithPlugins = useCallback(
        (delta: number) => {
            const base = audioRef.current?.currentTime ?? currentTime
            seekWithPlugins(base + delta)
        },
        [audioRef, currentTime, seekWithPlugins]
    )

    const pluginAwareEngine = useMemo(
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
        tracks: localQueue,
        trackIndex,
        repeatMode: localRepeatMode,
        shuffle: localShuffle,
        requestAdvance,
        nextTrackFn: nextTrack,
        previousTrackFn: previousTrack,
    }

    const handleAutoPlayToggle = useCallback(
        () => setLocalAutoPlay((v) => !v),
        []
    )
    const handleShuffleToggle = useCallback(
        () => setLocalShuffle((v) => !v),
        []
    )
    const handleRepeatCycle = useCallback(
        () => setLocalRepeatMode((mode) =>
            mode === "off" ? "all" : mode === "all" ? "one" : "off"
        ),
        []
    )
    const handleAutomixToggle = useCallback(
        () => setLocalAutomix((v) => !v),
        []
    )

    // Queue drawer callbacks (local queue management for standalone player).
    const handleQueuePlayTrack = useCallback(
        (index: number) => {
            if (index !== trackIndex) {
                pendingPlayRef.current = true
                setTrackIndex(index)
            } else if (!isPlaying) {
                engine.play(true)
            }
            setQueueOpen(false)
        },
        [engine, isPlaying, trackIndex]
    )

    const handleQueueReorder = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (fromIndex === toIndex) return
            setLocalQueue((q) => {
                const next = [...q]
                const [moved] = next.splice(fromIndex, 1)
                next.splice(toIndex, 0, moved)
                return next
            })
            // Adjust trackIndex if the active track was moved.
            if (fromIndex === trackIndex) {
                setTrackIndex(toIndex)
            } else {
                // Shift trackIndex if removal was before it and insertion after (or vice versa).
                let adjusted = trackIndex
                if (fromIndex < trackIndex && toIndex >= trackIndex) {
                    adjusted = trackIndex - 1
                } else if (fromIndex > trackIndex && toIndex <= trackIndex) {
                    adjusted = trackIndex + 1
                }
                if (adjusted !== trackIndex) {
                    setTrackIndex(adjusted)
                }
            }
        },
        [trackIndex]
    )

    const handleQueueRemove = useCallback(
        (index: number) => {
            if (index === trackIndex) return // Never remove the active track.
            setLocalQueue((q) => q.filter((_, i) => i !== index))
            if (index < trackIndex) {
                setTrackIndex((ti) => ti - 1)
            }
        },
        [trackIndex]
    )

    const { share, copied: shareCopied, nativeShare } = useShareTrack(
        currentTrack.title ?? "",
        currentTrack.artist ?? ""
    )
    const handleShareClick = useCallback(() => {
        // The native share sheet takes over the screen, so the controller
        // closes first; the clipboard fallback keeps it open so the inline
        // "copied" feedback stays visible.
        if (nativeShare) setControllerOpen(false)
        share()
    }, [nativeShare, share])

    // Keyboard shortcuts scoped to the player root (not window) so they never
    // fight focused controls or other parts of the host app. Space/Enter on an
    // actual button is left to the button, preventing double-triggering.
    const handleRootKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (hasKeyboardShortcutPlugin) return
            const target = event.target as HTMLElement
            const onInteractive = !!target.closest(
                "button, a, input, [role='slider']"
            )
            const key = event.key.toLowerCase()

            if ((event.key === " " || key === "k") && !onInteractive) {
                event.preventDefault()
                toggle()
            } else if (key === "j") {
                event.preventDefault()
                seekByWithPlugins(-10)
            } else if (key === "l") {
                event.preventDefault()
                seekByWithPlugins(10)
            } else if (key === "n" && isPlaylistMode) {
                event.preventDefault()
                nextTrack()
            } else if (key === "p" && isPlaylistMode) {
                event.preventDefault()
                previousTrack()
            }
        },
        [hasKeyboardShortcutPlugin, isPlaylistMode, nextTrack, previousTrack, seekByWithPlugins, toggle]
    )

    // Track which play/pause transitions we have *already* announced so we
    // don't spam the live region on every rAF tick. `isBuffering` is
    // intentionally debounced: a brief buffer burst is not interesting.
    const lastPlayedRef = useRef<boolean | null>(null)
    const lastErrorRef = useRef<string | null>(null)
    const lastAutoplayRef = useRef<boolean | null>(null)
    const lastMissingRef = useRef<boolean | null>(null)
    useEffect(() => {
        // Track play/pause transitions, not levels.
        if (lastPlayedRef.current !== isPlaying) {
            lastPlayedRef.current = isPlaying
            if (isPlaying) {
                setAnnouncement(
                    `Playing ${currentTrack.title} by ${currentTrack.artist}`
                )
            }
        }
    }, [isPlaying, currentTrack.title, currentTrack.artist])

    useEffect(() => {
        const msg = errorMessage || ""
        if (lastErrorRef.current !== msg && hasError) {
            lastErrorRef.current = msg
            setAnnouncement(`Error: ${msg}`)
        } else if (!hasError) {
            lastErrorRef.current = null
        }
    }, [hasError, errorMessage])

    useEffect(() => {
        if (lastAutoplayRef.current !== autoplayBlocked) {
            lastAutoplayRef.current = autoplayBlocked
            if (autoplayBlocked) {
                setAnnouncement(
                    "Autoplay blocked. Tap play to start audio."
                )
            }
        }
    }, [autoplayBlocked])

    useEffect(() => {
        if (lastMissingRef.current !== hasAudio) {
            lastMissingRef.current = hasAudio
            if (!hasAudio) setAnnouncement("Audio file missing")
        }
    }, [hasAudio])

    // ── Media Session API (progressive enhancement) ──
    useMediaSessionObserver(pluginAwareEngine, {
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: "",
        artwork: backgroundImage?.src
            ? [{ src: backgroundImage.src, sizes: "512x512", type: "image/jpeg" }]
            : [],
        onNext: nextTrack,
        onPrevious: previousTrack,
        sourceKey,
    })

    // Pause the equalizer CSS animation when the tab is hidden so we don't
    // keep the GPU and rAF clock busy in the background.
    const [pageVisible, setPageVisible] = useState(() =>
        typeof document === "undefined"
            ? true
            : document.visibilityState !== "hidden"
    )
    useEffect(() => {
        if (typeof document === "undefined") return
        const onVis = () => setPageVisible(document.visibilityState !== "hidden")
        document.addEventListener("visibilitychange", onVis)
        return () => document.removeEventListener("visibilitychange", onVis)
    }, [])

    const themeVars = {
        "--ap-accent": accentColor,
        "--ap-play-icon": playIconColor,
        "--ap-text": textColor,
        "--ap-progress": progressColor,
        "--ap-track": trackColor,
        "--ap-bg": backgroundColor,
        "--ap-glow": glowColor,
        "--ap-blur": `${blurSize}px`,
    } as CSSProperties

    return (
        <div
            ref={rootRef}
            className={`ap-root${className ? ` ${className}` : ""}${
                pageVisible ? "" : " ap-root--hidden"
            }`}
            style={{ ...themeVars, ...style }}
            role="region"
            aria-label="Audio player"
            onKeyDown={handleRootKeyDown}
        >
            {/* Queue drawer (Up Next) */}
            {isPlaylistMode && (
                <QueueDrawer
                    queue={localQueue}
                    currentIndex={trackIndex}
                    isPlaying={isPlaying}
                    open={queueOpen}
                    onClose={() => setQueueOpen(false)}
                    onPlayTrack={handleQueuePlayTrack}
                    onReorder={handleQueueReorder}
                    onRemove={handleQueueRemove}
                />
            )}

            {/* SAP Controller: screen-level sheet for the advanced actions
                that used to crowd the face (shuffle, repeat, automix,
                autoplay, queue, lyrics/info, share, plugins). */}
            <SAPController
                open={controllerOpen}
                onClose={() => setControllerOpen(false)}
                playback={{
                    shuffle: localShuffle,
                    onToggleShuffle: handleShuffleToggle,
                    repeatMode: localRepeatMode,
                    onCycleRepeat: handleRepeatCycle,
                    ...(isPlaylistMode
                        ? {
                              automix: localAutomix,
                              onToggleAutomix: handleAutomixToggle,
                          }
                        : {}),
                    autoPlay: localAutoPlay,
                    onToggleAutoPlay: handleAutoPlayToggle,
                }}
                queue={
                    isPlaylistMode
                        ? {
                              count: localQueue.length,
                              onOpenQueue: () => setQueueOpen(true),
                          }
                        : undefined
                }
                info={{
                    title: currentTrack.title ?? "",
                    artist: currentTrack.artist ?? "",
                    duration,
                    lyrics: currentTrack.lyrics,
                }}
                share={{ onShare: handleShareClick, copied: shareCopied }}
                pluginNames={externalPlugins.map((plugin) => plugin.name)}
                accentColor={accentColor}
                playIconColor={playIconColor}
                textColor={textColor}
                progressColor={progressColor}
                trackColor={trackColor}
                backgroundColor={backgroundColor}
            />

            {/* SR live region */}
            <div className="ap-sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announcement}
            </div>

            {backgroundImage?.src && (
                <div
                    className="ap-bg-image"
                    style={{ backgroundImage: `url("${backgroundImage.src}")` }}
                    aria-hidden="true"
                />
            )}
            {backgroundImage?.src && darkenAmount > 0 && (
                <div
                    className="ap-bg-darken"
                    style={{ backgroundColor: `rgba(0,0,0,${darkenAmount / 100})` }}
                    aria-hidden="true"
                />
            )}

            <div className="ap-content">
                {engine.getBackendInfo().active === "html5" && (
                    <audio ref={audioRef} src={hasAudio ? src : undefined} />
                )}

                {!hasAudio && (
                    <div className="ap-banner ap-banner--error ap-anim-in">
                        <ErrorIcon />
                        <span>Audio file missing</span>
                    </div>
                )}

                {autoplayBlocked && hasAudio && !hasError && (
                    <div
                        className="ap-banner ap-banner--info ap-banner--col ap-anim-in"
                        role="status"
                    >
                        <div className="ap-banner__row">
                            <InfoIcon />
                            <span>Autoplay blocked. Tap play to start audio.</span>
                        </div>
                        <button
                            type="button"
                            className="ap-retry-btn"
                            onClick={() => {
                                dismissAutoplayBlocked()
                                toggle()
                            }}
                        >
                            Play
                        </button>
                    </div>
                )}

                {hasError && hasAudio && (
                    <div className="ap-banner ap-banner--error ap-banner--col ap-anim-in">
                        <div className="ap-banner__row">
                            <ErrorIcon />
                            <span>{errorMessage}</span>
                        </div>
                        <button type="button" className="ap-retry-btn" onClick={retry}>
                            Retry
                        </button>
                    </div>
                )}

                <div className="ap-top-actions">
                    <div className="ap-menu">
                        <button
                            type="button"
                            className="ap-icon-btn ap-tap ap-menu__btn"
                            onClick={() => setControllerOpen(true)}
                            aria-label="Player options"
                            aria-haspopup="dialog"
                            aria-expanded={controllerOpen}
                        >
                            <DotsIcon />
                        </button>
                    </div>
                </div>

                {isPlaylistMode && (
                    <div className="ap-track-counter">
                        Track {trackIndex + 1} of {localQueue.length}
                        {localShuffle ? " · Shuffle" : ""}
                        {localRepeatMode !== "off" ? ` · Repeat ${localRepeatMode}` : ""}
                        {localAutomix ? " · Automix" : ""}
                    </div>
                )}

                <div className="ap-track-info" role="group" aria-label="Track information">
                    <div
                        className="ap-track-info__title"
                        style={titleFont}
                        title={currentTrack.title}
                    >
                        {currentTrack.title}
                    </div>
                    <div
                        className="ap-track-info__artist"
                        style={artistFont}
                        title={currentTrack.artist}
                    >
                        {currentTrack.artist}
                    </div>
                </div>

                <div className="ap-progress-group" role="group" aria-label="Playback progress">
                    {showWaveform ? (
                        <WaveformProgress
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            disabled={!hasAudio}
                            isSeeking={isSeeking}
                            onSeek={seekWithPlugins}
                            onSeekStart={() => setSeeking(true)}
                            onSeekEnd={() => setSeeking(false)}
                            peaks={currentTrack.peaks}
                            peaksDuration={currentTrack.waveformDuration}
                            getDecodedData={engine.getDecodedData}
                            // Only the streaming backend needs the second
                            // fetch+decode; webaudio supplies decoded PCM.
                            url={
                                engine.getBackendInfo().active === "html5"
                                    ? src
                                    : undefined
                            }
                            sourceKey={sourceKey}
                            height={waveformHeight}
                            waveColor={trackColor}
                            progressColor={progressColor}
                            cursorColor={accentColor}
                        />
                    ) : (
                        <ProgressBar
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            disabled={!hasAudio}
                            isSeeking={isSeeking}
                            onSeek={seekWithPlugins}
                            onSeekStart={() => setSeeking(true)}
                            onSeekEnd={() => setSeeking(false)}
                        />
                    )}
                    <div className="ap-times" aria-hidden="true">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="ap-transport" role="group" aria-label="Playback controls">
                    {isPlaylistMode && (
                        <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={previousTrack}
                            disabled={!canPreviousTrack}
                            aria-label="Previous track"
                        >
                            <PrevIcon />
                        </button>
                    )}

                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-tap"
                        onClick={() => seekByWithPlugins(-10)}
                        disabled={!hasAudio}
                        aria-label="Skip backward 10 seconds"
                    >
                        <Back10Icon />
                    </button>

                    <button
                        type="button"
                        className={`ap-btn ap-btn--play ap-tap${isPlaying ? " ap-btn--play-active" : ""}`}
                        onClick={toggle}
                        disabled={!hasAudio}
                        aria-label={
                            !hasAudio
                                ? "Audio file missing"
                                : showPlaySpinner
                                  ? "Buffering audio"
                                  : isPlaying
                                    ? "Pause"
                                    : "Play"
                        }
                    >
                        {showPlaySpinner ? (
                            <SpinnerIcon />
                        ) : isPlaying ? (
                            <PauseIcon />
                        ) : (
                            <PlayIcon />
                        )}
                    </button>

                    <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-tap"
                        onClick={() => seekByWithPlugins(10)}
                        disabled={!hasAudio}
                        aria-label="Skip forward 10 seconds"
                    >
                        <Fwd10Icon />
                    </button>

                    {isPlaylistMode && (
                        <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-tap"
                            onClick={nextTrack}
                            disabled={!canNextTrack}
                            aria-label="Next track"
                        >
                            <NextIcon />
                        </button>
                    )}
                </div>

                {showVolume && (
                    <VolumeControl
                        volume={volume}
                        isMuted={isMuted}
                        disabled={!hasAudio}
                        volumeUnsupported={volumeUnsupported}
                        onVolumeChange={setVolume}
                        onToggleMute={toggleMute}
                    />
                )}

                {currentTrack.purchaseUrl && (
                    <a
                        className="ap-wide-btn ap-wide-btn--solid ap-tap"
                        href={currentTrack.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <HeartIcon />
                        Support Artist
                    </a>
                )}

                {isPlaylistMode && showTracklist && (
                    <div
                        className="ap-tracklist ap-anim-in"
                        role="list"
                        aria-label="Playlist tracks"
                    >
                        {localQueue.map((track, index) => {
                            const active = index === trackIndex
                            return (
                                <button
                                    type="button"
                                    key={`${track.audioFile}-${index}`}
                                    role="listitem"
                                    className={`ap-tracklist__item${active ? " ap-tracklist__item--active" : ""}`}
                                    onClick={() => goToTrack(index)}
                                    aria-current={active ? "true" : undefined}
                                >
                                    <span className="ap-tracklist__num">{index + 1}</span>
                                    <span className="ap-tracklist__meta">
                                        <span className="ap-tracklist__title">{track.title}</span>
                                        <span className="ap-tracklist__artist">{track.artist}</span>
                                    </span>
                                    {active && isPlaying && (
                                        <span className="ap-eq" aria-hidden="true">
                                            <i /><i /><i />
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AudioPlayer

/* ----------------------------- Icons ----------------------------- */

const ErrorIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
)
const InfoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
)
const PlayIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l12-7z" />
    </svg>
)
const PauseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
)
const SpinnerIcon = () => (
    <svg className="ap-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
)
const Back10Icon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
        <polyline points="3 3 6.2 5.8 3.4 8.5" />
        <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
    </svg>
)
const Fwd10Icon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.5 12a8.5 8.5 0 1 1-2.7-6.2" />
        <polyline points="21 3 17.8 5.8 20.6 8.5" />
        <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, -apple-system, sans-serif">10</text>
    </svg>
)
const PrevIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="4" width="2.5" height="16" rx="0.5" />
        <path d="M20 5v14L9 12z" />
    </svg>
)
const NextIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4 5v14l11-7z" />
        <rect x="16.5" y="4" width="2.5" height="16" rx="0.5" />
    </svg>
)
const HeartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
)
const DotsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
    </svg>
)
