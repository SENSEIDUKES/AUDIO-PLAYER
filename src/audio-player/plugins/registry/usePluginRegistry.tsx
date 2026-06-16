import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import type { ReactNode } from "react"
import type { AudioPlayerPlugin } from "../../core/plugins/PluginInterface"
import {
    createAnalyticsPlugin,
} from "../AnalyticsPlugin"
import {
    createKeyboardShortcutPlugin,
} from "../KeyboardShortcutPlugin"
import {
    createLyricsPlugin,
} from "../LyricsPlugin"
import {
    createSleepTimerPlugin,
} from "../SleepTimerPlugin"
import {
    createAutomixPlugin,
} from "../AutomixPlugin"
import {
    createAutoThemePlugin,
} from "../AutoThemePlugin"
import {
    createWaveformPlugin,
} from "../WaveformPlugin"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Describes a plugin that is *available* to install. */
export interface PluginRegistryEntry {
    /** Unique stable identifier (used as the plugin instance name too). */
    id: string
    /** Human-readable label shown in the UI. */
    label: string
    /** Short description. */
    description: string
    /**
     * Factory that returns a fresh plugin instance.
     * The registry calls this when the user installs the plugin.
     * The caller may merge default config before calling the factory.
     */
    factory: () => AudioPlayerPlugin
    /** Whether this plugin is enabled by default after install. */
    defaultActive: boolean
    /**
     * Optional hint for the UI.
     * e.g. "lifecycle", "analytics", "ui", "playback"
     */
    category?: string
}

/** Tracks a plugin *once installed* by the user. */
export interface InstalledPluginRecord {
    entry: PluginRegistryEntry
    active: boolean
}

/** Snapshot of registry state for consumers that need to rebuild instances. */
export interface PluginRegistrySnapshot {
    available: readonly PluginRegistryEntry[]
    installed: readonly InstalledPluginRecord[]
    install: (id: string) => void
    uninstall: (id: string) => void
    activate: (id: string) => void
    deactivate: (id: string) => void
    toggleActive: (id: string) => void
    /** Materialised active plugin instances — pass this as `plugins` to AudioPlayer. */
    activeInstances: readonly AudioPlayerPlugin[]
}

/* ------------------------------------------------------------------ */
/*  Global available-plugin catalogue                                  */
/* ------------------------------------------------------------------ */

const availablePlugins: PluginRegistryEntry[] = [
    {
        id: "keyboard-shortcuts",
        label: "Keyboard Shortcuts",
        description:
            "Space/J/K/L/N/P keyboard controls scoped to the player root. "
            + "Conflicts with the player's built-in key handler are suppressed.",
        factory: () =>
            createKeyboardShortcutPlugin({
                name: "registry-keyboard-shortcuts",
                enablePlaylistKeys: true,
            }),
        defaultActive: true,
        category: "playback",
    },
    {
        id: "analytics",
        label: "Analytics",
        description:
            "Emits play/pause/seek/stop events to a callback or endpoint. " +
            "Default: console.table output -- no network traffic.",
        factory: () =>
            createAnalyticsPlugin({
                name: "registry-analytics",
                includeTimeUpdates: false,
                send: (event) => {
                    if (typeof console !== "undefined") {
                        console.table([{
                            type: event.type,
                            track: event.track?.title ?? "(none)",
                            position: event.position.toFixed(1),
                            duration: event.duration.toFixed(1),
                        }])
                    }
                },
            }),
        defaultActive: false,
        category: "analytics",
    },
    {
        id: "lyrics",
        label: "Lyrics Sync",
        description:
            "Displays LRC-style lyrics synced to playback time. " +
            "Comes with a sample lyric set so the effect is visible immediately.",
        factory: () =>
            createLyricsPlugin({
                name: "registry-lyrics",
                lyrics: SAMPLE_LYRICS,
                onLineChange: (line) => {
                    if (typeof document !== "undefined") {
                        const el = document.getElementById("registry-lyrics-line")
                        if (el) el.textContent = line?.text ?? ""
                    }
                },
            }),
        defaultActive: false,
        category: "ui",
    },
    {
        id: "sleep-timer",
        label: "Sleep Timer",
        description:
            "Adds a sleep-timer dropdown to the player root. " +
            "Supports 15/30/45/60-minute counts and end-of-track.",
        factory: () =>
            createSleepTimerPlugin({ name: "registry-sleep-timer" }),
        defaultActive: false,
        category: "ui",
    },
    {
        id: "automix",
        label: "Automix",
        description:
            "Beat/BPM-aware crossfades between playlist tracks, with automatic " +
            "light-mode fallback (silence-based trims) when analysis is " +
            "unavailable or low-confidence. No setup required.",
        factory: () =>
            createAutomixPlugin({ name: "registry-automix" }),
        defaultActive: false,
        category: "playback",
    },
    {
        id: "auto-theme",
        label: "Auto Theme",
        description:
            "Derives the player's accent, progress gradient, background tint, " +
            "text contrast, and ambient glow from the album artwork.",
        factory: () =>
            createAutoThemePlugin({ name: "registry-auto-theme" }),
        defaultActive: false,
        category: "ui",
    },
    {
        id: "waveform",
        label: "Waveform",
        description:
            "Replaces the progress bar with an interactive wavesurfer waveform " +
            "on players that support it. Adds a Show Waveform toggle in the " +
            "player's options.",
        factory: () =>
            createWaveformPlugin({ name: "registry-waveform" }),
        defaultActive: false,
        category: "ui",
    },
]

const SAMPLE_LYRICS = [
    "[00:00.00]Plugin registry ready",
    "[00:04.00]Browse available plugins",
    "[00:08.00]Install what you need",
    "[00:12.00]Toggle them on and off",
    "[00:16.00]Watch playback stay smooth",
].join("\n")

/* ------------------------------------------------------------------ */
/*  Context + Provider                                                 */
/* ------------------------------------------------------------------ */

const PluginRegistryContext = createContext<PluginRegistrySnapshot | null>(
    null
)

export interface PluginRegistryProviderProps {
    children: ReactNode
}

/**
 * Wraps children with a plugin registry context.
 * Tracks which plugins are installed and which are active.
 * Exposes `activeInstances` – a stable array of `AudioPlayerPlugin` objects
 * that can be passed directly into `<AudioPlayer plugins={...} />`.
 *
 * The provider only materialises instances for **active** plugins, so an
 * installed-but-inactive plugin does not consume slots in the player.
 */
export function PluginRegistryProvider({
    children,
}: PluginRegistryProviderProps) {
    const [installed, setInstalled] = useState<InstalledPluginRecord[]>(() =>
        availablePlugins
            .filter((e) => e.defaultActive)
            .map((entry) => ({ entry, active: entry.defaultActive }))
    )

    // Unique counter to force instance re-creation when the registry
    // transitions from active→inactive→active (keyed instances).
    const revRef = useRef(0)

    const install = useCallback((id: string) => {
        const entry = availablePlugins.find((e) => e.id === id)
        if (!entry) return
        setInstalled((prev) => {
            if (prev.some((r) => r.entry.id === id)) return prev
            revRef.current++
            return [
                ...prev,
                { entry, active: entry.defaultActive },
            ]
        })
    }, [])

    const uninstall = useCallback((id: string) => {
        setInstalled((prev) => {
            const next = prev.filter((r) => r.entry.id !== id)
            if (next.length === prev.length) return prev
            revRef.current++
            return next
        })
    }, [])

    const activate = useCallback((id: string) => {
        revRef.current++
        setInstalled((prev) =>
            prev.map((r) =>
                r.entry.id === id && !r.active
                    ? { ...r, active: true }
                    : r
            )
        )
    }, [])

    const deactivate = useCallback((id: string) => {
        revRef.current++
        setInstalled((prev) =>
            prev.map((r) =>
                r.entry.id === id && r.active
                    ? { ...r, active: false }
                    : r
            )
        )
    }, [])

    const toggleActive = useCallback((id: string) => {
        revRef.current++
        setInstalled((prev) =>
            prev.map((r) =>
                r.entry.id === id ? { ...r, active: !r.active } : r
            )
        )
    }, [])

    // Materialise active plugin instances, keyed by a revision counter so
    // React sees fresh references after an active→inactive→active toggle.
    const activeInstances = useMemo<readonly AudioPlayerPlugin[]>(() => {
        return installed
            .filter((r) => r.active)
            .map((r) => r.entry.factory())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [installed, revRef.current])

    // Also track a derived RevRef for stable reference.
    const snapshot = useMemo<PluginRegistrySnapshot>(
        () => ({
            available: availablePlugins,
            installed,
            install,
            uninstall,
            activate,
            deactivate,
            toggleActive,
            activeInstances,
        }),
        [
            installed,
            install,
            uninstall,
            activate,
            deactivate,
            toggleActive,
            activeInstances,
        ]
    )

    return (
        <PluginRegistryContext.Provider value={snapshot}>
            {children}
        </PluginRegistryContext.Provider>
    )
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Access the plugin registry from any component within a
 * `<PluginRegistryProvider>`. Returns the full registry snapshot including
 * `activeInstances` which can be spread into an `<AudioPlayer>`.
 */
export function usePluginRegistry(): PluginRegistrySnapshot {
    const ctx = useContext(PluginRegistryContext)
    if (ctx === null) {
        throw new Error(
            "usePluginRegistry must be used within a <PluginRegistryProvider>"
        )
    }
    return ctx
}

/* ------------------------------------------------------------------ */
/*  Convenience: emit active instances as an `<AudioPlayer>` plugins   */
/*  prop whenever the registry changes.                                */
/* ------------------------------------------------------------------ */

/**
 * Returns the current `activeInstances` array from the registry.
 * This is a thin wrapper around `usePluginRegistry()` for convenience.
 */
export function useActivePluginInstances(): readonly AudioPlayerPlugin[] {
    const { activeInstances } = usePluginRegistry()

    // Store instances in a ref so we can detect actual array-content changes
    // vs. the memoised-array-identity changing on every toggle.
    const prev = useRef<readonly AudioPlayerPlugin[]>(activeInstances)
    const [stable, setStable] = useState<readonly AudioPlayerPlugin[]>(
        activeInstances
    )

    useEffect(() => {
        // Simple shallow identity: if the length differs or any element
        // reference differs, emit the new array.
        const a = prev.current
        const b = activeInstances
        if (
            a.length !== b.length ||
            a.some((plugin, i) => plugin !== b[i])
        ) {
            prev.current = b
            setStable(b)
        }
    }, [activeInstances])

    return stable
}