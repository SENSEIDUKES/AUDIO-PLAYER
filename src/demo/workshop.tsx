import { useState } from "react"
import {
    AudioSessionProvider,
    PluginRegistryProvider,
    usePluginRegistry,
    PluginManagerPanel,
} from "../audio-player"
import { noLuckTracks } from "./data"
import { WORKSHOP_FACES, defaultWorkshopSettings } from "./workshopFaces"
import type { WorkshopFaceId, WorkshopSettings } from "./workshopFaces"
import { loadPresets, savePreset, deletePreset } from "./workshopPresets"
import type { WorkshopPreset } from "./workshopPresets"
import { SchemaPanel } from "./panel/SchemaPanel"

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
                    <SchemaPanel
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
