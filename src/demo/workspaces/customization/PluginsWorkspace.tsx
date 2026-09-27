import { useMemo, useRef, useState } from "react"
import {
    AudioPlayer,
    DEFAULT_PLUGIN_SURFACES,
    PluginManagerPanel,
    PluginRegistryProvider,
    createAnalyticsPlugin,
    createKeyboardShortcutPlugin,
    createLyricsPlugin,
    createSleepTimerPlugin,
    isWorkspaceRoute,
    usePluginRegistry,
} from "../../../audio-player"
import type { AudioPlayerPlugin } from "../../../audio-player"
import { OG_BG, playlist } from "../../data"
import {
    Button,
    EventLog,
    Note,
    Panel,
    Readout,
    Segmented,
    SplitLayout,
    StatusBadge,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { ROUTE_STATUS } from "../shared/routes"

/* Plugins: lifecycle add-ons that hook into playback without touching the
   engine. Try the registry the product will use, the fixed stacks from the old
   Lab, and a plugin that crashes on purpose to prove failures stay contained. */

type Mode = "registry" | "stack-0" | "stack-1" | "stack-4"

const TIMED_LYRICS = [
    "[00:00.00]Plugin-ready player",
    "[00:06.00]Keyboard, analytics, and lyrics",
    "[00:12.00]Hooks stay isolated",
    "[00:18.00]Playback keeps running",
].join("\n")

function makeCrasher(report: (hook: string) => void): AudioPlayerPlugin {
    return {
        name: "workshop-crasher",
        init: () => undefined,
        destroy: () => undefined,
        onPlay: () => {
            report("onPlay")
            throw new Error("Deliberate crash in onPlay")
        },
        onSeek: () => {
            report("onSeek")
            throw new Error("Deliberate crash in onSeek")
        },
        onPause: () => {
            report("onPause")
            throw new Error("Deliberate crash in onPause")
        },
    }
}

function useStack(mode: Mode, append: (text: string, tone?: LogLine["tone"]) => void) {
    const [lyric, setLyric] = useState("Waiting for playback…")
    const plugins = useMemo<AudioPlayerPlugin[]>(() => {
        if (mode === "stack-1") {
            return [
                createKeyboardShortcutPlugin({
                    name: "demo-keyboard-shortcuts",
                    enablePlaylistKeys: false,
                }),
            ]
        }
        if (mode === "stack-4") {
            return [
                createKeyboardShortcutPlugin({ name: "demo-keyboard", enablePlaylistKeys: true }),
                createAnalyticsPlugin({
                    name: "demo-analytics",
                    includeTimeUpdates: false,
                    send: (event) =>
                        append(
                            `analytics: ${event.type} · ${event.track?.title ?? "(none)"} @ ${event.position.toFixed(1)} s`
                        ),
                }),
                createLyricsPlugin({
                    name: "demo-lyrics",
                    lyrics: TIMED_LYRICS,
                    onLineChange: (line) => setLyric(line?.text ?? "Waiting for playback…"),
                }),
                createSleepTimerPlugin({ name: "demo-sleep-timer" }),
            ]
        }
        return []
    }, [mode, append])
    return { plugins, lyric }
}

function PluginSurfaces() {
    return (
        <div className="wk-table-wrap">
            <table className="wk-table">
                <thead>
                    <tr>
                        <th scope="col">Plugin</th>
                        <th scope="col">Interface</th>
                        <th scope="col">Settings screen</th>
                        <th scope="col">Canvas</th>
                    </tr>
                </thead>
                <tbody>
                    {DEFAULT_PLUGIN_SURFACES.map((def) => {
                        const route = def.settings?.route
                        return (
                            <tr key={def.pluginId}>
                                <td>{def.label}</td>
                                <td>{def.kind}</td>
                                <td>
                                    {route ? <code>{route}</code> : "—"}{" "}
                                    {route && isWorkspaceRoute(route) && (
                                        <StatusBadge status={ROUTE_STATUS[route].status} />
                                    )}
                                </td>
                                <td>{def.canvas?.surfaceId ?? "—"}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function PluginsWorkspaceInner() {
    const [mode, setMode] = useState<Mode>("registry")
    const [crash, setCrash] = useState(false)
    const { lines, append, clear } = useEventLog(50)
    const registry = usePluginRegistry()
    const stack = useStack(mode, append)
    const crashCount = useRef(0)
    const crasher = useMemo(
        () =>
            makeCrasher((hook) => {
                crashCount.current += 1
                append(`crasher threw in ${hook} — contained, playback continues`, "error")
            }),
        [append]
    )

    const base = mode === "registry" ? registry.activeInstances : stack.plugins
    const plugins = useMemo(() => (crash ? [...base, crasher] : base), [base, crash, crasher])

    return (
        <SplitLayout
            stage={
                <>
                    <div className="wk-stage-card">
                        <p className="wk-stage-card__title">
                            AudioPlayer with {plugins.length} plugin
                            {plugins.length === 1 ? "" : "s"}
                        </p>
                        <AudioPlayer
                            key={mode}
                            tracks={playlist}
                            showTracklist
                            repeatMode="all"
                            plugins={plugins}
                            backgroundImage={{ src: OG_BG }}
                            darkenAmount={45}
                            accentColor="#7C5CFF"
                            progressColor="#7C5CFF"
                            backgroundColor="rgba(20,20,28,0.6)"
                        />
                        {mode === "registry" ? (
                            <p id="registry-lyrics-line" className="wk-lyric-line">
                                Install Lyrics Sync to see synced text here
                            </p>
                        ) : mode === "stack-4" ? (
                            <p className="wk-lyric-line">lyric: {stack.lyric}</p>
                        ) : null}
                        <Note>
                            Focus the player and use Space, J, K, L (N and P for tracks) when a
                            keyboard plugin is active.
                        </Note>
                    </div>
                    <Panel
                        title="Plugin events"
                        actions={
                            <Button variant="ghost" onClick={clear}>
                                Clear
                            </Button>
                        }
                    >
                        <EventLog
                            lines={lines}
                            empty="Analytics events and contained crashes appear here."
                        />
                    </Panel>
                    <Panel
                        title="Where each plugin's interface lives"
                        hint="Declared in the default plugin surface catalog: settings screen, SEI Canvas, both, or headless."
                    >
                        <PluginSurfaces />
                    </Panel>
                </>
            }
            controls={
                <>
                    <Panel title="Plugin source">
                        <Segmented
                            label="Plugins"
                            value={mode}
                            options={[
                                { value: "registry", label: "Registry" },
                                { value: "stack-0", label: "0" },
                                { value: "stack-1", label: "1" },
                                { value: "stack-4", label: "4" },
                            ]}
                            onChange={setMode}
                        />
                        <Switch
                            label="Add a plugin that crashes"
                            hint="Throws on play, pause, and seek"
                            checked={crash}
                            onChange={setCrash}
                        />
                        <Readout
                            rows={[
                                [
                                    "Active on the player",
                                    plugins.map((p) => p.name).join(", ") || "none",
                                ],
                            ]}
                        />
                    </Panel>
                    {mode === "registry" ? (
                        <PluginManagerPanel />
                    ) : (
                        <Note>
                            {mode === "stack-0"
                                ? "Baseline: no optional plugins."
                                : mode === "stack-1"
                                  ? "Keyboard shortcuts only."
                                  : "Keyboard shortcuts, analytics, lyric sync, and the sleep timer together."}
                        </Note>
                    )}
                    {mode === "registry" && (
                        <Note>
                            Registry Analytics prints to the browser console (console.table) rather
                            than this log; the 4-plugin stack feeds this log instead.
                        </Note>
                    )}
                </>
            }
        />
    )
}

export function PluginsWorkspace() {
    return (
        <PluginRegistryProvider>
            <PluginsWorkspaceInner />
        </PluginRegistryProvider>
    )
}
