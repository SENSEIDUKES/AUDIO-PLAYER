import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
    AudioSessionProvider,
    PluginRegistryProvider,
    usePluginRegistry,
    PluginManagerPanel,
} from "../audio-player"
import type { AudioPlayerTheme } from "../audio-player"
import { noLuckTracks, NO_LUCK_ART, SEA_ARTS } from "./data"
import {
    WORKSHOP_FACES,
    defaultWorkshopSettings,
} from "./workshopFaces"
import type {
    WorkshopControlGroup,
    WorkshopFaceDefinition,
    WorkshopFaceId,
    WorkshopSettings,
} from "./workshopFaces"
import { loadPresets, savePreset, deletePreset } from "./workshopPresets"
import type { WorkshopPreset } from "./workshopPresets"

/* rgba/hex normalizer: <input type=color> only accepts 7-char hex, but the
   audio player uses hex AND rgba() strings. Fall back to white for anything
   the picker can't render so the user still sees a swatch. */
function normalizeColor(value: string | undefined, fallback = "#000000"): string {
    if (!value) return fallback
    const v = value.trim()
    if (/^#[0-9a-f]{6}$/i.test(v)) return v
    // expand shorthand hex — the picker only accepts #rrggbb
    if (/^#[0-9a-f]{3}$/i.test(v)) {
        return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    }
    // extract rgb/rgba into hex
    const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) {
        const r = Number(m[1]).toString(16).padStart(2, "0")
        const g = Number(m[2]).toString(16).padStart(2, "0")
        const b = Number(m[3]).toString(16).padStart(2, "0")
        return `#${r}${g}${b}`
    }
    return fallback
}

const FONT_WEIGHTS = [
    { value: 300, label: "Light" },
    { value: 400, label: "Regular" },
    { value: 500, label: "Medium" },
    { value: 600, label: "Semibold" },
    { value: 700, label: "Bold" },
    { value: 800, label: "Extrabold" },
]

const THEME_PRESETS: { label: string; theme: Required<AudioPlayerTheme> }[] = [
    {
        label: "OG Glass",
        theme: {
            accentColor: "#FFFFFF",
            textColor: "#FFFFFF",
            progressColor: "#000000",
            trackColor: "#CCCCCC",
            playIconColor: "#000000",
            backgroundColor: "rgba(255, 255, 255, 0)",
        },
    },
    {
        label: "SEI Purple",
        theme: {
            accentColor: "#7C5CFF",
            textColor: "#FFFFFF",
            progressColor: "#7C5CFF",
            trackColor: "rgba(124,92,255,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(20,20,28,0.6)",
        },
    },
    {
        label: "Neon Green",
        theme: {
            accentColor: "#22D3A6",
            textColor: "#FFFFFF",
            progressColor: "#22D3A6",
            trackColor: "rgba(34,211,166,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(16,28,22,0.6)",
        },
    },
    {
        label: "Error Red",
        theme: {
            accentColor: "#ff5a55",
            textColor: "#FFFFFF",
            progressColor: "#ff5a55",
            trackColor: "rgba(255,90,85,0.25)",
            playIconColor: "#000000",
            backgroundColor: "rgba(40,16,16,0.6)",
        },
    },
]

/* Top-level so React keeps the same component identity across renders.
   Defining it inside the panel would unmount/remount the inputs on every
   keystroke, which is what caused the "only one character" bug. */
function ControlGroup({
    id,
    title,
    openGroups,
    onToggle,
    children,
}: {
    id: string
    title: string
    openGroups: Record<string, boolean>
    onToggle: (id: string) => void
    children: ReactNode
}) {
    return (
        <div className={`framer-panel__group${openGroups[id] ? " framer-panel__group--open" : ""}`}>
            <div
                className="framer-panel__group-head"
                onClick={() => onToggle(id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onToggle(id)
                    }
                }}
            >
                <span>{title}</span>
                <span className="framer-panel__chevron">▶</span>
            </div>
            <div className="framer-panel__group-body">{children}</div>
        </div>
    )
}

function Toggle({
    id,
    label,
    value,
    onToggle,
}: {
    id: string
    label: string
    value: boolean
    onToggle: () => void
}) {
    return (
        <div className="framer-panel__row">
            <label className="framer-panel__label" htmlFor={id}>{label}</label>
            <button
                id={id}
                type="button"
                className={`framer-panel__toggle${value ? " framer-panel__toggle--on" : ""}`}
                onClick={onToggle}
                aria-pressed={value}
                aria-label={`Toggle ${label}`}
            />
        </div>
    )
}

/* ----------------------------- Control panel ----------------------------- */
/* Evolved from the OG Framer control panel: same chrome, but each face
   declares which control groups apply (face.controls), so the panel adapts
   as new faces are added. */
function WorkshopControlPanel({
    face,
    settings,
    onChange,
    onReset,
}: {
    face: WorkshopFaceDefinition
    settings: WorkshopSettings
    onChange: (next: WorkshopSettings) => void
    onReset: () => void
}) {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        theme: true, background: true, typography: false, behavior: true, display: true, art: true, presets: true,
    })
    const [copied, setCopied] = useState(false)

    const toggleGroup = (key: string) =>
        setOpenGroups((g) => ({ ...g, [key]: !g[key] }))

    const set = <K extends keyof WorkshopSettings>(key: K, value: WorkshopSettings[K]) =>
        onChange({ ...settings, [key]: value })

    const setTheme = (patch: Partial<Required<AudioPlayerTheme>>) =>
        onChange({ ...settings, theme: { ...settings.theme, ...patch } })

    const setFont = (which: "titleFont" | "artistFont", patch: Partial<CSSProperties>) =>
        onChange({ ...settings, [which]: { ...settings[which], ...patch } })

    const has = (group: WorkshopControlGroup) => face.controls.includes(group)

    // Tracklist and waveform are AudioPlayer-only surfaces; session skins only
    // expose a volume toggle from the display group.
    const isMainPlayer = face.id === "audio-player"

    const buildJsx = (): string => {
        const t = settings.theme
        const lines = [
            "<AudioPlayer",
            "    tracks={tracks}",
            `    accentColor={"${t.accentColor}"}`,
            `    playIconColor={"${t.playIconColor}"}`,
            `    textColor={"${t.textColor}"}`,
            `    progressColor={"${t.progressColor}"}`,
            `    trackColor={"${t.trackColor}"}`,
            `    backgroundColor={"${t.backgroundColor}"}`,
            `    backgroundImage={{ src: "${settings.backgroundImageSrc}" }}`,
            `    blurSize={${settings.blurSize}}`,
            `    darkenAmount={${settings.darkenAmount}}`,
            `    titleFont={{ fontSize: "${settings.titleFont.fontSize ?? ""}", fontWeight: ${settings.titleFont.fontWeight ?? 500}, letterSpacing: "${settings.titleFont.letterSpacing ?? ""}", lineHeight: "${settings.titleFont.lineHeight ?? ""}" }}`,
            `    artistFont={{ fontSize: "${settings.artistFont.fontSize ?? ""}", fontWeight: ${settings.artistFont.fontWeight ?? 500}, letterSpacing: "${settings.artistFont.letterSpacing ?? ""}", lineHeight: "${settings.artistFont.lineHeight ?? ""}" }}`,
            `    autoPlay={${settings.autoPlay}}`,
            `    shuffle={${settings.shuffle}}`,
            `    repeatMode={"${settings.repeatMode}"}`,
            `    showTracklist={${settings.showTracklist}}`,
            `    showVolume={${settings.showVolume}}`,
            `    showWaveform={${settings.showWaveform}}`,
            "/>",
        ]
        return lines.join("\n")
    }

    const handleCopy = async () => {
        const text = buildJsx()
        try {
            if (navigator.clipboard) await navigator.clipboard.writeText(text)
        } catch { /* ignore */ }
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <aside className="framer-panel" aria-label="Workshop face controls">
            <div className="framer-panel__head">
                <p className="framer-panel__title">{face.label} · Properties</p>
                <div className="framer-panel__actions">
                    <button type="button" className="framer-panel__btn framer-panel__btn--accent" onClick={onReset}>
                        Reset
                    </button>
                </div>
            </div>
            <div className="framer-panel__body">
                {has("theme") && (
                    <ControlGroup id="theme" openGroups={openGroups} onToggle={toggleGroup} title="Theme colors">
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-accent">Button Color</label>
                            <input id="ws-accent" className="framer-panel__color" type="color" value={normalizeColor(settings.theme.accentColor)} onChange={(e) => setTheme({ accentColor: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-icon">Play Icon Color</label>
                            <input id="ws-icon" className="framer-panel__color" type="color" value={normalizeColor(settings.theme.playIconColor)} onChange={(e) => setTheme({ playIconColor: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-text">Text Color</label>
                            <input id="ws-text" className="framer-panel__color" type="color" value={normalizeColor(settings.theme.textColor, "#ffffff")} onChange={(e) => setTheme({ textColor: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-progress">Progress Color</label>
                            <input id="ws-progress" className="framer-panel__color" type="color" value={normalizeColor(settings.theme.progressColor)} onChange={(e) => setTheme({ progressColor: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-track">Track Color</label>
                            <input id="ws-track" className="framer-panel__color" type="color" value={normalizeColor(settings.theme.trackColor)} onChange={(e) => setTheme({ trackColor: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-bgcolor">Background Color</label>
                            <input id="ws-bgcolor" className="framer-panel__color" type="color" value={normalizeColor(settings.theme.backgroundColor, "#ffffff")} onChange={(e) => setTheme({ backgroundColor: e.target.value })} />
                        </div>
                        <div className="framer-panel__preset-row">
                            {THEME_PRESETS.map((p) => (
                                <button key={p.label} type="button" className="framer-panel__preset" onClick={() => setTheme(p.theme)}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </ControlGroup>
                )}

                {has("background") && (
                    <ControlGroup id="background" openGroups={openGroups} onToggle={toggleGroup} title="Background">
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-bg">Image URL</label>
                            <input id="ws-bg" className="framer-panel__input" value={settings.backgroundImageSrc} onChange={(e) => set("backgroundImageSrc", e.target.value)} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-blur">Blur Size</label>
                            <input id="ws-blur" className="framer-panel__range" type="range" min={0} max={50} step={1} value={settings.blurSize} onChange={(e) => set("blurSize", Number(e.target.value))} />
                        </div>
                        <div className="framer-panel__value">{settings.blurSize}px</div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-darken">Darken Image</label>
                            <input id="ws-darken" className="framer-panel__range" type="range" min={0} max={100} step={1} value={settings.darkenAmount} onChange={(e) => set("darkenAmount", Number(e.target.value))} />
                        </div>
                        <div className="framer-panel__value">{settings.darkenAmount}%</div>
                    </ControlGroup>
                )}

                {has("typography") && (
                    <ControlGroup id="typography" openGroups={openGroups} onToggle={toggleGroup} title="Typography">
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-titlesz">Title Size</label>
                            <input id="ws-titlesz" className="framer-panel__input" value={settings.titleFont.fontSize ?? ""} onChange={(e) => setFont("titleFont", { fontSize: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-titlew">Title Weight</label>
                            <select id="ws-titlew" className="framer-panel__select" value={String(settings.titleFont.fontWeight ?? 500)} onChange={(e) => setFont("titleFont", { fontWeight: Number(e.target.value) })}>
                                {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                            </select>
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-titlels">Title Tracking</label>
                            <input id="ws-titlels" className="framer-panel__input" value={settings.titleFont.letterSpacing ?? ""} onChange={(e) => setFont("titleFont", { letterSpacing: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-titlelh">Title Leading</label>
                            <input id="ws-titlelh" className="framer-panel__input" value={settings.titleFont.lineHeight ?? ""} onChange={(e) => setFont("titleFont", { lineHeight: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-artistsz">Artist Size</label>
                            <input id="ws-artistsz" className="framer-panel__input" value={settings.artistFont.fontSize ?? ""} onChange={(e) => setFont("artistFont", { fontSize: e.target.value })} />
                        </div>
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-artistw">Artist Weight</label>
                            <select id="ws-artistw" className="framer-panel__select" value={String(settings.artistFont.fontWeight ?? 500)} onChange={(e) => setFont("artistFont", { fontWeight: Number(e.target.value) })}>
                                {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                            </select>
                        </div>
                    </ControlGroup>
                )}

                {has("behavior") && (
                    <ControlGroup id="behavior" openGroups={openGroups} onToggle={toggleGroup} title="Behavior">
                        <Toggle id="ws-autoplay" label="Auto Play" value={settings.autoPlay} onToggle={() => set("autoPlay", !settings.autoPlay)} />
                        <Toggle id="ws-shuffle" label="Shuffle" value={settings.shuffle} onToggle={() => set("shuffle", !settings.shuffle)} />
                        <div className="framer-panel__row"><label className="framer-panel__label" htmlFor="ws-repeat">Repeat Mode</label>
                            <select id="ws-repeat" className="framer-panel__select" value={settings.repeatMode} onChange={(e) => set("repeatMode", e.target.value as WorkshopSettings["repeatMode"])}>
                                <option value="off">Off</option>
                                <option value="all">All</option>
                                <option value="one">One</option>
                            </select>
                        </div>
                    </ControlGroup>
                )}

                {has("display") && (
                    <ControlGroup id="display" openGroups={openGroups} onToggle={toggleGroup} title="Display">
                        <Toggle id="ws-volume" label="Show Volume" value={settings.showVolume} onToggle={() => set("showVolume", !settings.showVolume)} />
                        {isMainPlayer && (
                            <>
                                <Toggle id="ws-tracklist" label="Show Tracklist" value={settings.showTracklist} onToggle={() => set("showTracklist", !settings.showTracklist)} />
                                <Toggle id="ws-waveform" label="Show Waveform" value={settings.showWaveform} onToggle={() => set("showWaveform", !settings.showWaveform)} />
                            </>
                        )}
                    </ControlGroup>
                )}

                {has("art") && (
                    <ControlGroup id="art" openGroups={openGroups} onToggle={toggleGroup} title="Cover art">
                        <div className="framer-panel__row framer-panel__row--col"><label className="framer-panel__label" htmlFor="ws-art">Art (CSS image)</label>
                            <input id="ws-art" className="framer-panel__input" value={settings.art} onChange={(e) => set("art", e.target.value)} placeholder='url("…") or linear-gradient(…)' />
                        </div>
                        <div className="framer-panel__preset-row">
                            <button type="button" className="framer-panel__preset" onClick={() => set("art", NO_LUCK_ART)}>No Luck cover</button>
                            {SEA_ARTS.slice(0, 2).map((g, i) => (
                                <button key={g} type="button" className="framer-panel__preset" onClick={() => set("art", g)}>
                                    Gradient {i + 1}
                                </button>
                            ))}
                        </div>
                    </ControlGroup>
                )}
            </div>
            {isMainPlayer && (
                <div className="framer-panel__footer">
                    <button
                        type="button"
                        className={`framer-panel__copy${copied ? " framer-panel__copy--ok" : ""}`}
                        onClick={handleCopy}
                    >
                        {copied ? "Copied!" : "Copy props as JSX"}
                    </button>
                </div>
            )}
        </aside>
    )
}

/* ----------------------------- Preset bar ----------------------------- */
function PresetBar({
    presets,
    presetName,
    onNameChange,
    onSave,
    onLoad,
    onDelete,
}: {
    presets: WorkshopPreset[]
    presetName: string
    onNameChange: (name: string) => void
    onSave: () => void
    onLoad: (preset: WorkshopPreset) => void
    onDelete: (name: string) => void
}) {
    const faceLabel = (id: WorkshopFaceId) =>
        WORKSHOP_FACES.find((f) => f.id === id)?.label ?? id

    return (
        <div className="workshop-presets">
            <div className="workshop-presets__head">
                <h3 className="workshop-presets__title">Presets</h3>
                <p className="workshop-presets__hint">
                    Saved locally in this browser (localStorage) — face,
                    settings, and active plugins.
                </p>
            </div>
            <div className="workshop-presets__save">
                <input
                    className="framer-panel__input"
                    value={presetName}
                    placeholder="Preset name…"
                    onChange={(e) => onNameChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && presetName.trim()) onSave()
                    }}
                    aria-label="Preset name"
                />
                <button
                    type="button"
                    className="framer-panel__btn framer-panel__btn--accent"
                    onClick={onSave}
                    disabled={!presetName.trim()}
                >
                    Save preset
                </button>
            </div>
            {presets.length === 0 ? (
                <p className="workshop-presets__empty">
                    No presets yet. Style a face, name it, and save.
                </p>
            ) : (
                <ul className="workshop-presets__list">
                    {presets.map((p) => (
                        <li key={p.name} className="workshop-presets__row">
                            <div className="workshop-presets__meta">
                                <span className="workshop-presets__name">{p.name}</span>
                                <span className="workshop-presets__sub">
                                    {faceLabel(p.faceId)} · {p.enabledPlugins.length} plugin{p.enabledPlugins.length === 1 ? "" : "s"} · {new Date(p.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <div className="workshop-presets__actions">
                                <button type="button" className="framer-panel__preset" onClick={() => onLoad(p)}>
                                    Load
                                </button>
                                <button type="button" className="framer-panel__preset framer-panel__preset--err" onClick={() => onDelete(p.name)}>
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

/* ----------------------------- Workshop page ----------------------------- */
function WorkshopInner() {
    const [faceId, setFaceId] = useState<WorkshopFaceId>("audio-player")
    const [settings, setSettings] = useState<WorkshopSettings>(defaultWorkshopSettings)
    const [presets, setPresets] = useState<WorkshopPreset[]>(loadPresets)
    const [presetName, setPresetName] = useState("")

    const registry = usePluginRegistry()
    const plugins = registry.activeInstances

    const face = WORKSHOP_FACES.find((f) => f.id === faceId) ?? WORKSHOP_FACES[0]
    const preview = face.render({ settings, tracks: noLuckTracks, plugins })

    const handleSave = () => {
        const name = presetName.trim()
        if (!name) return
        setPresets(
            savePreset({
                name,
                faceId: face.id,
                settings,
                enabledPlugins: registry.installed
                    .filter((r) => r.active)
                    .map((r) => r.entry.id),
                timestamp: Date.now(),
            })
        )
    }

    const handleLoad = (p: WorkshopPreset) => {
        setFaceId(p.faceId)
        // Merge over fresh defaults so presets saved before a settings field
        // existed still load cleanly.
        const defaults = defaultWorkshopSettings()
        setSettings({
            ...defaults,
            ...p.settings,
            theme: { ...defaults.theme, ...p.settings.theme },
        })
        setPresetName(p.name)
        // Reconcile the plugin registry with the preset's saved plugin set.
        // Only touch entries whose state actually differs — activate/uninstall
        // bump the registry's revision counter, which re-instantiates active
        // plugins even when nothing changed.
        for (const entry of registry.available) {
            const record = registry.installed.find((r) => r.entry.id === entry.id)
            if (p.enabledPlugins.includes(entry.id)) {
                if (!record) {
                    registry.install(entry.id)
                    // A fresh install starts at entry.defaultActive.
                    if (!entry.defaultActive) registry.activate(entry.id)
                } else if (!record.active) {
                    registry.activate(entry.id)
                }
            } else if (record) {
                registry.uninstall(entry.id)
            }
        }
    }

    const handleDelete = (name: string) => setPresets(deletePreset(name))

    return (
        <div className="lab-shell">
            <header className="lab-header">
                <div>
                    <h1 className="lab-header__title">Workshop — customize a face</h1>
                    <p className="lab-header__sub">
                        Pick a player face, tune its properties in the panel,
                        toggle plugins, and save the result as a local preset.
                        Every preview is the real production component playing
                        the No Luck release.
                    </p>
                </div>
                <div className="lab-header__chip">Face workshop</div>
            </header>

            <div className="workshop">
                <div className="workshop__panel">
                    <div className="framer-panel__row workshop__face-picker">
                        <label className="framer-panel__label" htmlFor="ws-face">Player face</label>
                        <select
                            id="ws-face"
                            className="framer-panel__select"
                            value={face.id}
                            onChange={(e) => setFaceId(e.target.value as WorkshopFaceId)}
                        >
                            {WORKSHOP_FACES.map((f) => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                        </select>
                    </div>
                    <WorkshopControlPanel
                        face={face}
                        settings={settings}
                        onChange={setSettings}
                        onReset={() => setSettings(defaultWorkshopSettings())}
                    />
                    <PluginManagerPanel />
                </div>

                <div className="workshop__main">
                    <div className="workshop__preview">
                        <div className="workshop__preview-head">
                            <h3 className="workshop__preview-title">{face.label}</h3>
                            <p className="workshop__preview-desc">{face.description}</p>
                        </div>
                        {face.sessionBased ? (
                            /* key={face.id} remounts the provider per face so the
                               initial queue/flags apply; edits within a face do
                               NOT remount, so playback survives restyling.
                               Plugin toggles hot-swap via manager.replace. */
                            <AudioSessionProvider
                                key={face.id}
                                initialQueue={noLuckTracks}
                                shuffle={settings.shuffle}
                                repeatMode={settings.repeatMode}
                                plugins={plugins}
                            >
                                {preview}
                            </AudioSessionProvider>
                        ) : (
                            <div key={face.id}>{preview}</div>
                        )}
                    </div>

                    <PresetBar
                        presets={presets}
                        presetName={presetName}
                        onNameChange={setPresetName}
                        onSave={handleSave}
                        onLoad={handleLoad}
                        onDelete={handleDelete}
                    />
                </div>
            </div>
        </div>
    )
}

export function Workshop() {
    return (
        <PluginRegistryProvider>
            <WorkshopInner />
        </PluginRegistryProvider>
    )
}
