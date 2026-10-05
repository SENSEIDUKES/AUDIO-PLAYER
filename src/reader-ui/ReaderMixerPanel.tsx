import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { SEIField, SEIRadio, SEIRadioGroup, SEISelect, SEISlider, SEISwitch } from "@seihouse/ui"
import {
    READER_MIXER_LAYERS,
    useOptionalReaderMixer,
    useReaderMixerState,
} from "@seihouse/audio-player"
import type {
    ReaderAtmosphereOption,
    ReaderMixer,
    ReaderMixerLayer,
    ReaderMixerLayerStatus,
} from "@seihouse/audio-player"
import "./reader-ui.css"

/** Every piece of text the mixer view shows, for wording and translation. */
export interface ReaderMixerLabels {
    title: string
    /** Legend of the preset picker. Preset names come from each preset's `label`. */
    presets: string
    master: string
    layers: Readonly<Record<ReaderMixerLayer, string>>
    /** Accessible name of a layer's slider. */
    volume: (layerLabel: string) => string
    formatPercent: (percent: number) => string
    atmospherePicker: string
    atmosphereOff: string
    /** Empty chapter message under the master switch. */
    noAudio: string
    sleepTimer: string
    cancelTimer: string
    sleepStopped: string
    /** Receives remaining wall-clock milliseconds. */
    formatRemainingTime: (remainingMs: number) => string
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
    presets: "Presets",
    master: "Master",
    layers: Object.freeze({
        soundscapes: "Soundscapes",
        atmosphere: "Atmosphere",
        cues: "Sound Cues",
        voice: "Voice",
    }),
    volume: (layerLabel: string) => `${layerLabel} volume`,
    formatPercent: (percent: number) => `${percent}%`,
    atmospherePicker: "Atmosphere sound",
    atmosphereOff: "Off",
    noAudio: "This chapter has no audio",
    sleepTimer: "Sleep timer",
    cancelTimer: "Cancel timer",
    sleepStopped: "Stopped by sleep timer",
    formatRemainingTime: (remainingMs: number) => `Stops in ${Math.ceil(remainingMs / 60000)} min`,
    deviceVolumeHint: "Volume is set by your device on this browser",
    status: Object.freeze({
        loading: "Loading…",
        blocked: "Tap anywhere to start audio",
        failed: "This sound couldn’t play",
        paused: "Paused",
        resting: "Music is resting until the next scene",
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
    /** Show the preset picker above the master switch. Defaults to true. */
    showPresets?: boolean
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
        <SEISwitch
            isSelected={checked}
            aria-labelledby={labelledBy}
            className="sap-reader-mixer__switch"
            onChange={onChange}
            onKeyDown={(event) => {
                // Native switches own Space. Preserve the previous button's
                // Enter shortcut without repeating a toggle while held.
                if (event.key !== "Enter") return
                event.preventDefault()
                if (!event.repeat) onChange(!checked)
            }}
        />
    )
}

type AtmosphereGroup = { name: string | null; options: ReaderAtmosphereOption[] }
const VOLUME_FORMAT = { style: "unit", unit: "percent", unitDisplay: "narrow" } as const

function MixerSlider({
    percent,
    label,
    formatPercent,
    onChange,
}: {
    percent: number
    label: string
    formatPercent: ReaderMixerLabels["formatPercent"]
    onChange: (value: number) => void
}) {
    const control = useRef<HTMLDivElement>(null)
    // SEISlider owns the native range and all interaction. Its number formatter
    // cannot express the host's arbitrary wording, so preserve that public hook
    // on the range's spoken value when the value or host wording changes.
    useEffect(() => {
        const input = control.current?.querySelector('input[type="range"]')
        const valueText = formatPercent(percent)
        // Timer/status updates must not repeatedly announce an unchanged value.
        if (input && input.getAttribute("aria-valuetext") !== valueText) {
            input.setAttribute("aria-valuetext", valueText)
        }
    }, [percent, formatPercent])
    return (
        <div ref={control} className="sap-reader-mixer__slider">
            <SEISlider
                minValue={0}
                maxValue={100}
                step={1}
                value={percent}
                formatOptions={VOLUME_FORMAT}
                aria-label={label}
                onChange={onChange}
            />
        </div>
    )
}

function groupAtmospheres(options: readonly ReaderAtmosphereOption[]): AtmosphereGroup[] {
    const groups: AtmosphereGroup[] = []
    for (const option of options) {
        // Host catalogs may come from untyped data; ignore a non-string group.
        const name = typeof option.group === "string" ? option.group.trim() || null : null
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

function AtmosphereChip({ value, label }: { value: string; label: string }) {
    return (
        <SEIRadio className="sap-reader-mixer__chip" value={value}>
            {label}
        </SEIRadio>
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
    showPresets = true,
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
    const [pickerOpen, setPickerOpen] = useState(false)
    const [focusedLayer, setFocusedLayer] = useState<ReaderMixerLayer | null>(null)
    const [draggingLayer, setDraggingLayer] = useState<ReaderMixerLayer | null>(null)
    useEffect(() => {
        if (!draggingLayer) return
        const release = () => setDraggingLayer(null)
        document.addEventListener("pointerup", release, true)
        document.addEventListener("pointercancel", release, true)
        return () => {
            document.removeEventListener("pointerup", release, true)
            document.removeEventListener("pointercancel", release, true)
        }
    }, [draggingLayer])

    if (!mixer || !state) return null

    const { preferences } = state
    const ids = {
        title: `${baseId}-title`,
        master: `${baseId}-master`,
        layer: (layer: ReaderMixerLayer) => `${baseId}-${layer}`,
        picker: `${baseId}-atmosphere`,
        presets: `${baseId}-presets`,
        group: (index: number) => `${baseId}-group-${index}`,
        pickerList: `${baseId}-atmosphere-list`,
    }

    const renderPicker = (): ReactNode => {
        if (!showAtmospherePicker) return null
        const selected = preferences.atmosphereId
        return (
            <div className="sap-reader-mixer__atmosphere">
                <button
                    type="button"
                    className="sap-reader-mixer__atmosphere-summary"
                    aria-expanded={pickerOpen}
                    aria-controls={ids.pickerList}
                    aria-label={`${labels.layers.atmosphere}: ${options?.find((option) => option.id === selected)?.label ?? labels.atmosphereOff}`}
                    onClick={() => setPickerOpen((open) => !open)}
                >
                    {options?.find((option) => option.id === selected)?.label ??
                        labels.atmosphereOff}
                    <span aria-hidden="true">{pickerOpen ? "⌄" : "›"}</span>
                </button>
                {pickerOpen && (
                    <fieldset className="sap-reader-mixer__picker" id={ids.pickerList}>
                        <legend
                            className="sap-reader-mixer__picker-legend"
                            id={`${ids.picker}-legend`}
                        >
                            {labels.atmospherePicker}
                        </legend>
                        <SEIRadioGroup
                            name={ids.picker}
                            aria-labelledby={`${ids.picker}-legend`}
                            value={JSON.stringify(selected)}
                            onChange={(value) =>
                                mixer.setAtmosphere(
                                    options?.find(
                                        (option) => JSON.stringify(option.id) === value
                                    ) ?? null
                                )
                            }
                            className="sap-reader-mixer__choices"
                        >
                            <div className="sap-reader-mixer__chips">
                                <AtmosphereChip value="null" label={labels.atmosphereOff} />
                                {groups[0]?.name === null &&
                                    groups[0].options.map((option) => (
                                        <AtmosphereChip
                                            key={option.id}
                                            value={JSON.stringify(option.id)}
                                            label={option.label}
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
                                        <span
                                            className="sap-reader-mixer__group-name"
                                            id={ids.group(index)}
                                        >
                                            {group.name}
                                        </span>
                                        <div className="sap-reader-mixer__chips">
                                            {group.options.map((option) => (
                                                <AtmosphereChip
                                                    key={option.id}
                                                    value={JSON.stringify(option.id)}
                                                    label={option.label}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </SEIRadioGroup>
                    </fieldset>
                )}
            </div>
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
            {showPresets && state.presets.length > 0 && (
                <fieldset className="sap-reader-mixer__picker sap-reader-mixer__presets">
                    <legend
                        className="sap-reader-mixer__picker-legend"
                        id={`${ids.presets}-legend`}
                    >
                        {labels.presets}
                    </legend>
                    <SEIRadioGroup
                        name={ids.presets}
                        aria-labelledby={`${ids.presets}-legend`}
                        orientation="horizontal"
                        value={state.activePresetId ?? ""}
                        onChange={(value) => mixer.applyPreset(value)}
                        className="sap-reader-mixer__choices"
                    >
                        {state.presets.map((preset) => (
                            <AtmosphereChip
                                key={preset.id}
                                value={preset.id}
                                label={preset.label}
                            />
                        ))}
                    </SEIRadioGroup>
                </fieldset>
            )}
            <div className="sap-reader-mixer__row sap-reader-mixer__row--master">
                <span className="sap-reader-mixer__name" id={ids.master}>
                    {labels.master}
                </span>
                <MixerSwitch
                    checked={preferences.masterEnabled && state.sleepTimer.status !== "fired"}
                    labelledBy={ids.master}
                    onChange={(enabled) => mixer.setMasterEnabled(enabled)}
                />
            </div>
            {!READER_MIXER_LAYERS.some((layer) => state.availability[layer]) && (
                <p className="sap-reader-mixer__empty">{labels.noAudio}</p>
            )}
            <ul className="sap-reader-mixer__layers">
                {READER_MIXER_LAYERS.filter(
                    (layer) =>
                        state.availability[layer] ||
                        focusedLayer === layer ||
                        draggingLayer === layer
                ).map((layer) => {
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
                            onPointerDownCapture={() => setDraggingLayer(layer)}
                            onFocusCapture={() => setFocusedLayer(layer)}
                            onBlurCapture={(event) => {
                                if (
                                    !event.currentTarget.contains(
                                        event.relatedTarget as Node | null
                                    )
                                )
                                    setFocusedLayer(null)
                            }}
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
                                <MixerSlider
                                    percent={percent}
                                    label={labels.volume(label)}
                                    formatPercent={labels.formatPercent}
                                    onChange={(value) => mixer.setLayerLevel(layer, value / 100)}
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
            <div className="sap-reader-mixer__sleep">
                <SEIField
                    label={labels.sleepTimer}
                    htmlFor={`${baseId}-sleep`}
                    helperText={
                        <span aria-live="polite">
                            {state.sleepTimer.status === "fired"
                                ? labels.sleepStopped
                                : state.sleepTimer.remainingMs !== null
                                  ? labels.formatRemainingTime(state.sleepTimer.remainingMs)
                                  : ""}
                        </span>
                    }
                >
                    <SEISelect
                        className="sap-reader-mixer__sleep-select"
                        id={`${baseId}-sleep`}
                        value={
                            (state.sleepTimer.status === "running"
                                ? state.sleepTimer.choiceId
                                : null) ??
                            state.sleepTimerChoices.find((choice) => choice.kind === "off")?.id ??
                            ""
                        }
                        onChange={(event) => mixer.setSleepTimer(event.target.value)}
                    >
                        {!state.sleepTimerChoices.some((choice) => choice.kind === "off") && (
                            <option value="" disabled>
                                {labels.cancelTimer}
                            </option>
                        )}
                        {state.sleepTimerChoices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                                {choice.label}
                            </option>
                        ))}
                    </SEISelect>
                </SEIField>
                {state.sleepTimer.status === "running" && (
                    <button
                        className="sap-reader-mixer__sleep-cancel"
                        type="button"
                        onClick={() => mixer.cancelSleepTimer()}
                    >
                        {labels.cancelTimer}
                    </button>
                )}
            </div>
        </section>
    )
}
