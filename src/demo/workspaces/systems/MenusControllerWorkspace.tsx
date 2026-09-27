import { useMemo, useState } from "react"
import {
    AudioSessionProvider,
    SeaCardPlayer,
    buildVaultTrackArcActions,
    createAnalyticsPlugin,
    createAutoThemePlugin,
    createLyricsPlugin,
    createSleepTimerPlugin,
    createWaveformPlugin,
    faceSupportsSEICanvas,
    resolvePlayerMenu,
    useAudioSession,
} from "../../../audio-player"
import type {
    ArcAction,
    ArcCommandHost,
    AudioPlayerPlugin,
    PlayerMenuCategoryId,
    PlayerMenuPlacement,
    PlayerMenuProfile,
    Track,
    WorkspaceRoute,
} from "../../../audio-player"
import { NO_LUCK_ART, SEA_THEME, noLuckTracks } from "../../data"
import {
    Button,
    EventLog,
    Note,
    Panel,
    Segmented,
    SplitLayout,
    StatusBadge,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { ALL_ROUTES, ROUTE_STATUS } from "../shared/routes"
import { SessionController } from "../shared/session"

/* One action hierarchy, composed by the host, routed into one controller.
   The live face is a SEA card because it accepts every composition option
   (host tree, profile, entitlements, extra capabilities, and a host-owned
   controller); every music face builds the same menu. */

type Composition = "canonical" | "categories" | "extra" | "host"
type PluginKey = "lyrics" | "waveform" | "analytics" | "sleep-timer" | "auto-theme"

const CANONICAL_ARMS: readonly PlayerMenuCategoryId[] = [
    "plugins",
    "playback",
    "queue",
    "share",
    "agents",
    "vault",
]

const ARM_LABELS: Record<string, string> = {
    plugins: "Plugins",
    playback: "Playback",
    queue: "Queue",
    share: "Share",
    agents: "Agents",
    vault: "Vault",
}

const PLUGIN_FACTORIES: Record<PluginKey, { label: string; create: () => AudioPlayerPlugin }> = {
    lyrics: { label: "Lyrics", create: () => createLyricsPlugin({ name: "registry-lyrics" }) },
    waveform: {
        label: "Waveform",
        create: () => createWaveformPlugin({ name: "registry-waveform" }),
    },
    analytics: {
        label: "Analytics",
        create: () => createAnalyticsPlugin({ name: "registry-analytics", send: () => undefined }),
    },
    "sleep-timer": {
        label: "Sleep Timer",
        create: () => createSleepTimerPlugin({ name: "registry-sleep-timer" }),
    },
    "auto-theme": {
        label: "Auto Theme",
        create: () => createAutoThemePlugin({ name: "registry-auto-theme" }),
    },
}

/** A host-owned arm: one command the host may or may not wire, one controller route. */
const STUDIO_ARM: ArcAction = {
    id: "studio",
    label: "Studio",
    children: [
        {
            id: "studio-bookmark",
            label: "Bookmark",
            target: "immediate-action",
            action: "studio.bookmark",
        },
        {
            id: "studio-log",
            label: "Session log",
            target: "sap-controller",
            workspaceRoute: "diagnostics:activity-log",
        },
    ],
}

interface LeafRow {
    path: string
    opens: string
    route?: WorkspaceRoute
    shown: boolean
    reason: string
}

/** Walk the resolved tree the way the face will prune it, recording why each leaf lives or not. */
function describeLeaves(actions: ArcAction[], host: ArcCommandHost): LeafRow[] {
    const rows: LeafRow[] = []
    const walk = (nodes: ArcAction[], trail: string[], missing: string | null) => {
        for (const node of nodes) {
            const lacks =
                missing ??
                (node.requires ?? []).find(
                    (capability) => host.capabilities?.[capability] !== true
                ) ??
                null
            const path = [...trail, node.label]
            if (node.children?.length) {
                walk(node.children, path, lacks)
                continue
            }
            const target = node.target ?? "immediate-action"
            let opens: string
            let shown: boolean
            let reason: string
            if (target === "sap-controller") {
                opens = node.workspaceRoute ?? "(no route)"
                shown = Boolean(node.workspaceRoute)
                reason = shown ? "Opens in the controller" : "No destination"
            } else if (target === "locked-entitlement") {
                opens = "locked"
                shown = true
                reason = "Shown locked (missing entitlement)"
            } else {
                opens = node.action ? `command ${node.action}` : "inline handler"
                shown = Boolean((node.action && host.commands?.[node.action]) || node.onSelect)
                reason = shown ? "Command wired by this host" : "Pruned: command not wired here"
            }
            if (lacks) {
                shown = false
                reason = `Pruned: needs the “${lacks}” capability`
            }
            rows.push({
                path: path.join(" › "),
                opens,
                route: target === "sap-controller" ? node.workspaceRoute : undefined,
                shown,
                reason,
            })
        }
    }
    walk(actions, [], null)
    return rows
}

function MenuStage({
    track,
    actions,
    menuProfile,
    studioScout,
    wireBookmark,
    hostVault,
    append,
}: {
    track: Track
    actions?: ArcAction[]
    menuProfile?: PlayerMenuProfile
    studioScout: boolean
    wireBookmark: boolean
    hostVault: boolean
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const s = useAudioSession()
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    const { playNext, enqueue, pluginNames } = s

    const commands = useMemo<ArcCommandHost["commands"]>(
        () => ({
            "queue.insertAfterCurrent": () => {
                playNext(track)
                append(`command queue.insertAfterCurrent → Play Next “${track.title}”`, "ok")
            },
            "queue.append": () => {
                enqueue(track)
                append(`command queue.append → Play Later “${track.title}”`, "ok")
            },
            "share.url": () => {
                void navigator.clipboard?.writeText(track.audioFile ?? "")
                append("command share.url → link copied", "ok")
            },
            "track.favorite": () => append(`command track.favorite → “${track.title}”`, "ok"),
            ...(wireBookmark
                ? { "studio.bookmark": () => append("host command studio.bookmark", "ok") }
                : {}),
        }),
        [playNext, enqueue, track, wireBookmark, append]
    )
    const menuCapabilities = useMemo(() => (hostVault ? { vault: true } : undefined), [hostVault])

    const resolved = resolvePlayerMenu({
        actions,
        menuProfile,
        activePluginIds: pluginNames,
        entitlements: { studioScout },
    })
    const rows = describeLeaves(resolved, {
        commands,
        openWorkspace: () => undefined,
        capabilities: {
            canvas: faceSupportsSEICanvas("seaCard"),
            vault: false,
            ...menuCapabilities,
        },
    })

    const open = (next: WorkspaceRoute, from: string) => {
        setRoute(next)
        append(`open ${next} (${from})`)
    }

    return (
        <>
            <div className="wk-stage-card wk-menu-stage">
                <div className="wk-card-slot">
                    <SeaCardPlayer
                        track={track}
                        art={NO_LUCK_ART}
                        tag="SEA"
                        actions={actions}
                        menuProfile={menuProfile}
                        activePluginIds={pluginNames}
                        entitlements={{ studioScout }}
                        menuCapabilities={menuCapabilities}
                        commands={commands}
                        onOpenWorkspace={(next) => open(next, "radial menu")}
                        {...SEA_THEME}
                    />
                </div>
                <Note>
                    Tap the card's action button to open the radial menu. Every settings leaf opens
                    inside the one controller below; commands run immediately.
                </Note>
            </div>
            <Panel
                title="Route table"
                hint="Every leaf the host's composition produces, and whether this face renders it. Nothing is shown that cannot do something real."
            >
                <div className="wk-table-wrap">
                    <table className="wk-table">
                        <thead>
                            <tr>
                                <th scope="col">Leaf</th>
                                <th scope="col">Opens</th>
                                <th scope="col">On this face</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.path}>
                                    <td>{row.path}</td>
                                    <td>
                                        <code>{row.opens}</code>
                                        {row.route && (
                                            <>
                                                {" "}
                                                <StatusBadge
                                                    status={ROUTE_STATUS[row.route].status}
                                                />
                                            </>
                                        )}
                                    </td>
                                    <td>
                                        <span
                                            className={`wk-dot wk-dot--${row.shown ? "ok" : "warn"}`}
                                            aria-hidden="true"
                                        />
                                        {row.reason}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
            <Panel
                title="Controller destinations"
                hint="Every route the controller can render, opened directly. Status is what the destination actually shows today."
            >
                <ul className="wk-inline-list">
                    {ALL_ROUTES.map((candidate) => (
                        <li key={candidate} className="wk-inline-list__row">
                            <span className="wk-inline-list__main">
                                <span className="wk-inline-list__title">
                                    <code className="wk-code">{candidate}</code>
                                </span>
                                <span className="wk-inline-list__sub">
                                    {ROUTE_STATUS[candidate].note}
                                </span>
                            </span>
                            <span className="wk-inline-list__actions">
                                <StatusBadge status={ROUTE_STATUS[candidate].status} />
                                <Button onClick={() => open(candidate, "destination list")}>
                                    Open
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            </Panel>
            <SessionController route={route} onClose={() => setRoute(null)} theme={SEA_THEME} />
        </>
    )
}

export function MenusControllerWorkspace() {
    const [composition, setComposition] = useState<Composition>("canonical")
    const [categories, setCategories] = useState<PlayerMenuCategoryId[]>([
        "playback",
        "queue",
        "share",
    ])
    const [placement, setPlacement] = useState<PlayerMenuPlacement>("append")
    const [studioScout, setStudioScout] = useState(false)
    const [wireBookmark, setWireBookmark] = useState(true)
    const [pluginKeys, setPluginKeys] = useState<PluginKey[]>(["lyrics", "waveform"])
    const { lines, append, clear } = useEventLog()

    const plugins = useMemo(
        () => pluginKeys.map((key) => PLUGIN_FACTORIES[key].create()),
        [pluginKeys]
    )
    const vaultActions = useMemo(
        () => buildVaultTrackArcActions({ entitlements: { studioScout } }),
        [studioScout]
    )

    const actions = composition === "host" ? vaultActions : undefined
    const menuProfile: PlayerMenuProfile | undefined =
        composition === "categories"
            ? { categories }
            : composition === "extra"
              ? { extraActions: [STUDIO_ARM], placement }
              : undefined

    const toggleCategory = (id: PlayerMenuCategoryId) =>
        setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
    const moveCategory = (id: PlayerMenuCategoryId, delta: number) =>
        setCategories((prev) => {
            const index = prev.indexOf(id)
            const target = index + delta
            if (index < 0 || target < 0 || target >= prev.length) return prev
            const next = [...prev]
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })

    return (
        <AudioSessionProvider initialQueue={noLuckTracks} plugins={plugins}>
            <SplitLayout
                stage={
                    <>
                        <MenuStage
                            track={noLuckTracks[1]}
                            actions={actions}
                            menuProfile={menuProfile}
                            studioScout={studioScout}
                            wireBookmark={wireBookmark}
                            hostVault={composition === "host"}
                            append={append}
                        />
                    </>
                }
                controls={
                    <>
                        <Panel
                            title="Menu composition"
                            hint="The host owns what is in the menu; SAP owns routing and pruning."
                        >
                            <Segmented
                                label="Composition"
                                value={composition}
                                options={[
                                    { value: "canonical", label: "Canonical" },
                                    { value: "categories", label: "Pick arms" },
                                    { value: "extra", label: "+ Host arm" },
                                    { value: "host", label: "Host-owned" },
                                ]}
                                onChange={setComposition}
                            />
                            {composition === "categories" && (
                                <ul className="wk-inline-list" aria-label="Canonical arms">
                                    {CANONICAL_ARMS.map((id) => {
                                        const on = categories.includes(id)
                                        const position = categories.indexOf(id)
                                        return (
                                            <li key={id} className="wk-inline-list__row">
                                                <Switch
                                                    label={`${on ? `${position + 1}. ` : ""}${ARM_LABELS[id]}`}
                                                    checked={on}
                                                    onChange={() => toggleCategory(id)}
                                                />
                                                <span className="wk-inline-list__actions">
                                                    <Button
                                                        label={`Move ${ARM_LABELS[id]} earlier`}
                                                        onClick={() => moveCategory(id, -1)}
                                                        disabled={!on || position === 0}
                                                    >
                                                        ↑
                                                    </Button>
                                                    <Button
                                                        label={`Move ${ARM_LABELS[id]} later`}
                                                        onClick={() => moveCategory(id, 1)}
                                                        disabled={
                                                            !on ||
                                                            position === categories.length - 1
                                                        }
                                                    >
                                                        ↓
                                                    </Button>
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                            {composition === "extra" && (
                                <>
                                    <Segmented
                                        label="Host arm placement"
                                        value={placement}
                                        options={[
                                            { value: "prepend", label: "Before" },
                                            { value: "append", label: "After" },
                                        ]}
                                        onChange={setPlacement}
                                    />
                                    <Switch
                                        label="Wire the host's Bookmark command"
                                        hint="Unwired commands are pruned, never shown dead"
                                        checked={wireBookmark}
                                        onChange={setWireBookmark}
                                    />
                                </>
                            )}
                            {composition === "host" && (
                                <Note>
                                    The Vault app's own tree (buildVaultTrackArcActions), rendered
                                    verbatim. The host also declares the vault capability for it.
                                </Note>
                            )}
                        </Panel>
                        <Panel title="Entitlements & plugins">
                            <Switch
                                label="Studio Scout entitlement"
                                hint="Off routes Agents › Scout to the free Demo Scout"
                                checked={studioScout}
                                onChange={setStudioScout}
                            />
                            {(Object.keys(PLUGIN_FACTORIES) as PluginKey[]).map((key) => (
                                <Switch
                                    key={key}
                                    label={`${PLUGIN_FACTORIES[key].label} plugin active`}
                                    hint="Active plugins appear under Plugins"
                                    checked={pluginKeys.includes(key)}
                                    onChange={(on) =>
                                        setPluginKeys((prev) =>
                                            on ? [...prev, key] : prev.filter((k) => k !== key)
                                        )
                                    }
                                />
                            ))}
                        </Panel>
                        <Panel
                            title="Routing log"
                            actions={
                                <Button variant="ghost" onClick={clear}>
                                    Clear
                                </Button>
                            }
                        >
                            <EventLog lines={lines} empty="Open a menu leaf or a destination." />
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
