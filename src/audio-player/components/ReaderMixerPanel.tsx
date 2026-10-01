import { useId, useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import { READER_MIXER_LAYERS } from "../narrative/ReaderMixer"
import type {
    ReaderAtmosphereOption,
    ReaderMixer,
    ReaderMixerLayer,
    ReaderMixerLayerStatus,
} from "../narrative/ReaderMixer"
import { useOptionalReaderMixer, useReaderMixerState } from "../narrative/ReaderMixerContext"
import "./reader-mixer.css"

/** Every piece of text the mixer view shows, for wording and translation. */
export interface ReaderMixerLabels {
    title: string
    master: string
    layers: Readonly<Record<ReaderMixerLayer, string>>
    /** Accessible name of a layer's slider. */
    volume: (layerLabel: string) => string
    formatPercent: (percent: number) => string
    atmospherePicker: string
    atmosphereOff: string
    /** Shown where the browser ignores volume and sliders act as on/off. */
    deviceVolumeHint: string
    /** Row messages for statuses worth telling the reader about. */
    status: Readonly<Partial<Record<ReaderMixerLayerStatus, string>>>
}

/** Override any label; `layers` and `status` merge key by key. */
export type ReaderMixerLabelOverrides = Partial<Omit<ReaderMixerLabels, "layers" | "status">> & {
    layers?: Partial<Record<ReaderMixerLayer, string>>
    status?: Partial<Record<ReaderMixerLayerStatus, string>>
}

export const DEFAULT_READER_MIXER_LABELS: ReaderMixerLabels = Object.freeze({
    title: "Audio",
    master: "Master",
    layers: Object.freeze({
        soundscapes: "Soundscapes",
        atmosphere: "Atmosphere",
        cues: "Sound Cues",
    }),
    volume: (layerLabel: string) => `${layerLabel} volume`,
    formatPercent: (percent: number) => `${percent}%`,
    atmospherePicker: "Atmosphere sound",
    atmosphereOff: "Off",
    deviceVolumeHint: "Volume is set by your device on this browser",
    status: Object.freeze({
        loading: "Loading…",
        blocked: "Tap anywhere to start audio",
        failed: "This sound couldn’t play",
        paused: "Paused while the page is hidden",
    }),
})

export interface ReaderMixerPanelProps {
    /** The mixer to control. Defaults to the one from `ReaderMixerProvider`. */
    mixer?: ReaderMixer
    /** Atmosphere choices. Defaults to the mixer's catalog. */
    atmospheres?: readonly ReaderAtmosphereOption[]
    labels?: ReaderMixerLabelOverrides
    /** Show the title above the master switch. Defaults to true. */
    showTitle?: boolean
    /** Element for the title, to fit the host's heading outline. Defaults to `h3`. */
    titleAs?: "h2" | "h3" | "h4" | "p"
    /** Show the atmosphere picker under the Atmosphere row. Defaults to true. */
    showAtmospherePicker?: boolean
    className?: string
    /** Theme overrides, typically `--sap-reader-mixer-*` custom properties. */
    style?: CSSProperties
}

function mergeLabels(overrides: ReaderMixerLabelOverrides | undefined): ReaderMixerLabels {
    if (!overrides) return DEFAULT_READER_MIXER_LABELS
    return {
        ...DEFAULT_READER_MIXER_LABELS,
        ...overrides,
        layers: { ...DEFAULT_READER_MIXER_LABELS.layers, ...overrides.layers },
        status: { ...DEFAULT_READER_MIXER_LABELS.status, ...overrides.status },
    }
}

function MixerSwitch({
    checked,
    labelledBy,
    onChange,
}: {
    checked: boolean
    labelledBy: string
    onChange: (checked: boolean) => void
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={labelledBy}
            className="sap-reader-mixer__switch"
            onClick={() => onChange(!checked)}
        >
            <span className="sap-reader-mixer__switch-thumb" aria-hidden="true" />
        </button>
    )
}

type AtmosphereGroup = { name: string | null; options: ReaderAtmosphereOption[] }

function groupAtmospheres(options: readonly ReaderAtmosphereOption[]): AtmosphereGroup[] {
    const groups: AtmosphereGroup[] = []
    for (const option of options) {
        const name = option.group?.trim() || null
        let group = groups.find((candidate) => candidate.name === name)
        if (!group) {
            group = { name, options: [] }
            // Ungrouped options sit directly under Off.
            if (name === null) groups.unshift(group)
            else groups.push(group)
        }
        group.options.push(option)
    }
    return groups
}

function AtmosphereChip({
    name,
    checked,
    label,
    onSelect,
}: {
    name: string
    checked: boolean
    label: string
    onSelect: () => void
}) {
    return (
        <label className="sap-reader-mixer__chip">
            <input
                type="radio"
                name={name}
                className="sap-reader-mixer__chip-input"
                checked={checked}
                onChange={onSelect}
            />
            <span className="sap-reader-mixer__chip-face">{label}</span>
        </label>
    )
}

/**
 * Inline controls for a {@link ReaderMixer}: a master switch, then one row
 * per layer (Soundscapes, Atmosphere, Sound Cues) with a switch, a volume
 * slider and its percentage, and an atmosphere picker under Atmosphere.
 *
 * It renders in normal flow (never fixed or floating) so a host can place it
 * in a settings menu. Theme it with `--sap-reader-mixer-*` custom properties.
 */
export function ReaderMixerPanel({
    mixer: mixerProp,
    atmospheres,
    labels: labelOverrides,
    showTitle = true,
    titleAs: Title = "h3",
    showAtmospherePicker = true,
    className,
    style,
}: ReaderMixerPanelProps) {
    const contextMixer = useOptionalReaderMixer()
    const mixer = mixerProp ?? contextMixer
    const state = useReaderMixerState(mixer)
    const labels = useMemo(() => mergeLabels(labelOverrides), [labelOverrides])
    const baseId = useId()
    const options = atmospheres ?? state?.atmosphereOptions
    const groups = useMemo(() => groupAtmospheres(options ?? []), [options])

    if (!mixer || !state) return null

    const { preferences } = state
    const ids = {
        title: `${baseId}-title`,
        master: `${baseId}-master`,
        layer: (layer: ReaderMixerLayer) => `${baseId}-${layer}`,
        picker: `${baseId}-atmosphere`,
        group: (index: number) => `${baseId}-group-${index}`,
    }

    const renderPicker = (): ReactNode => {
        if (!showAtmospherePicker) return null
        const selected = preferences.atmosphereId
        return (
            <fieldset className="sap-reader-mixer__picker">
                <legend className="sap-reader-mixer__picker-legend">
                    {labels.atmospherePicker}
                </legend>
                <div className="sap-reader-mixer__chips">
                    <AtmosphereChip
                        name={ids.picker}
                        checked={selected === null}
                        label={labels.atmosphereOff}
                        onSelect={() => mixer.setAtmosphere(null)}
                    />
                    {groups[0]?.name === null &&
                        groups[0].options.map((option) => (
                            <AtmosphereChip
                                key={option.id}
                                name={ids.picker}
                                checked={selected === option.id}
                                label={option.label}
                                onSelect={() => mixer.setAtmosphere(option)}
                            />
                        ))}
                </div>
                {groups.map((group, index) =>
                    group.name === null ? null : (
                        <div
                            key={group.name}
                            className="sap-reader-mixer__group"
                            role="group"
                            aria-labelledby={ids.group(index)}
                        >
                            <span className="sap-reader-mixer__group-name" id={ids.group(index)}>
                                {group.name}
                            </span>
                            <div className="sap-reader-mixer__chips">
                                {group.options.map((option) => (
                                    <AtmosphereChip
                                        key={option.id}
                                        name={ids.picker}
                                        checked={selected === option.id}
                                        label={option.label}
                                        onSelect={() => mixer.setAtmosphere(option)}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                )}
            </fieldset>
        )
    }

    return (
        <section
            className={["sap-reader-mixer", className].filter(Boolean).join(" ")}
            style={style}
            aria-labelledby={showTitle ? ids.title : ids.master}
            data-master={preferences.masterEnabled ? "on" : "off"}
            data-volume-control={state.volumeControl}
        >
            {showTitle && (
                <Title className="sap-reader-mixer__title" id={ids.title}>
                    {labels.title}
                </Title>
            )}
            <div className="sap-reader-mixer__row sap-reader-mixer__row--master">
                <span className="sap-reader-mixer__name" id={ids.master}>
                    {labels.master}
                </span>
                <MixerSwitch
                    checked={preferences.masterEnabled}
                    labelledBy={ids.master}
                    onChange={(enabled) => mixer.setMasterEnabled(enabled)}
                />
            </div>
            <ul className="sap-reader-mixer__layers">
                {READER_MIXER_LAYERS.map((layer) => {
                    const preference = preferences.layers[layer]
                    const layerState = state.layers[layer]
                    const percent = Math.round(preference.level * 100)
                    const label = labels.layers[layer]
                    const message =
                        layerState.status === "idle" || layerState.status === "playing"
                            ? ""
                            : (labels.status[layerState.status] ?? "")
                    return (
                        <li
                            key={layer}
                            className="sap-reader-mixer__layer"
                            data-layer={layer}
                            data-enabled={preference.enabled ? "true" : "false"}
                            data-status={layerState.status}
                        >
                            <div className="sap-reader-mixer__row">
                                <span className="sap-reader-mixer__name" id={ids.layer(layer)}>
                                    {label}
                                </span>
                                <MixerSwitch
                                    checked={preference.enabled}
                                    labelledBy={ids.layer(layer)}
                                    onChange={(enabled) => mixer.setLayerEnabled(layer, enabled)}
                                />
                            </div>
                            <div className="sap-reader-mixer__level">
                                <input
                                    type="range"
                                    className="sap-reader-mixer__slider"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={percent}
                                    aria-label={labels.volume(label)}
                                    aria-valuetext={labels.formatPercent(percent)}
                                    style={
                                        {
                                            "--sap-reader-mixer-fill": `${percent}%`,
                                        } as CSSProperties
                                    }
                                    onChange={(event) =>
                                        mixer.setLayerLevel(layer, Number(event.target.value) / 100)
                                    }
                                />
                                <span className="sap-reader-mixer__percent" aria-hidden="true">
                                    {labels.formatPercent(percent)}
                                </span>
                            </div>
                            <p className="sap-reader-mixer__status" aria-live="polite">
                                {message}
                            </p>
                            {layer === "atmosphere" && renderPicker()}
                        </li>
                    )
                })}
            </ul>
            {state.volumeControl === "on-off" && (
                <p className="sap-reader-mixer__hint">{labels.deviceVolumeHint}</p>
            )}
        </section>
    )
}
