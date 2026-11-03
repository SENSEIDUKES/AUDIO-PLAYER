import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { SEIRadio, SEIRadioGroup, SEISelect, SEISlider, SEISwitch } from "@seihouse/ui"
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
    /** Accessible names of a choice row's ◀ and ▶ buttons; receive the row's name. */
    previous: (rowLabel: string) => string
    next: (rowLabel: string) => string
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
    previous: (rowLabel: string) => `Previous ${rowLabel}`,
    next: (rowLabel: string) => `Next ${rowLabel}`,
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

/** Merge host wording while retaining unspecified layer labels and statuses. */
function mergeLabels(overrides: ReaderMixerLabelOverrides | undefined): ReaderMixerLabels {
    if (!overrides) return DEFAULT_READER_MIXER_LABELS
    return {
        ...DEFAULT_READER_MIXER_LABELS,
        ...overrides,
        layers: { ...DEFAULT_READER_MIXER_LABELS.layers, ...overrides.layers },
        status: { ...DEFAULT_READER_MIXER_LABELS.status, ...overrides.status },
    }
}

/** Apply mixer selection to the approved switch, retaining its Enter shortcut. */
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
            size="compact"
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

/** Keep percentage volume and host spoken wording on the approved native range. */
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

interface StepperOption {
    value: string
    label: string
}

/**
 * A choice row's control: ◀ and ▶ step through the choices in place, and the
 * native select between them opens the device's own picker for a direct jump.
 * The row never expands, so the menu keeps its height.
 */
function ChoiceStepper({
    id,
    rowLabel,
    value,
    options,
    groups,
    labels,
    describedBy,
    onChange,
}: {
    id: string
    rowLabel: string
    value: string
    /** Every choice in stepping order. */
    options: readonly StepperOption[]
    /** Optional grouping for the native picker; defaults to `options` ungrouped. */
    groups?: readonly { name: string | null; options: readonly StepperOption[] }[]
    labels: ReaderMixerLabels
    describedBy?: string
    onChange: (value: string) => void
}) {
    const index = options.findIndex((option) => option.value === value)
    const step = (delta: number) => {
        const next = options[index + delta]
        if (next) onChange(next.value)
    }
    return (
        <div className="sap-reader-mixer__stepper">
            <button
                type="button"
                className="sap-reader-mixer__step"
                aria-label={labels.previous(rowLabel)}
                disabled={index <= 0}
                onClick={() => step(-1)}
            >
                <span aria-hidden="true">◀</span>
            </button>
            <SEISelect
                className="sap-reader-mixer__stepper-select"
                wrapperClassName="sap-reader-mixer__stepper-field"
                id={id}
                aria-describedby={describedBy}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {index < 0 && <option value={value} disabled hidden />}
                {(groups ?? [{ name: null, options }]).map((group) =>
                    group.name === null ? (
                        group.options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))
                    ) : (
                        <optgroup key={group.name} label={group.name}>
                            {group.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </optgroup>
                    )
                )}
            </SEISelect>
            <button
                type="button"
                className="sap-reader-mixer__step"
                aria-label={labels.next(rowLabel)}
                disabled={index < 0 || index >= options.length - 1}
                onClick={() => step(1)}
            >
                <span aria-hidden="true">▶</span>
            </button>
        </div>
    )
}

/** Group host choices in catalog order, placing ungrouped choices before named groups. */
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

/** Render a preset or encoded atmosphere choice through the approved radio. */
function AtmosphereChip({ value, label }: { value: string; label: string }) {
    return (
        <SEIRadio className="sap-reader-mixer__chip" value={value}>
            {label}
        </SEIRadio>
    )
}

/**
 * Inline controls for a {@link ReaderMixer}, laid out mobile first: Master and
 * each layer (Soundscapes, Atmosphere, Sound Cues and connected Voice) is one
 * compact channel line (switch, name, volume slider, percentage), with the
 * atmosphere choice as a key/value line under Atmosphere and the sleep timer
 * as a key/value line at the end. Very narrow containers drop each slider to
 * its own line.
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
        picker: `${baseId}-atmosphere-sound`,
        presets: `${baseId}-presets`,
        sleep: `${baseId}-sleep`,
        sleepStatus: `${baseId}-sleep-status`,
    }
    const sleepMessage =
        state.sleepTimer.status === "fired"
            ? labels.sleepStopped
            : state.sleepTimer.remainingMs !== null
              ? labels.formatRemainingTime(state.sleepTimer.remainingMs)
              : ""

    const renderPicker = (): ReactNode => {
        if (!showAtmospherePicker) return null
        // Off first, then the host's choices in catalog order (ungrouped first).
        const off: StepperOption = { value: "null", label: labels.atmosphereOff }
        const toOption = (option: ReaderAtmosphereOption): StepperOption => ({
            value: JSON.stringify(option.id),
            label: option.label,
        })
        const pickerGroups = [
            {
                name: null,
                options: [
                    off,
                    ...(groups[0]?.name === null ? groups[0].options.map(toOption) : []),
                ],
            },
            ...groups
                .filter((group) => group.name !== null)
                .map((group) => ({ name: group.name, options: group.options.map(toOption) })),
        ]
        return (
            <div className="sap-reader-mixer__atmosphere sap-reader-mixer__choice-row">
                <label className="sap-reader-mixer__name" htmlFor={ids.picker}>
                    {labels.atmospherePicker}
                </label>
                <ChoiceStepper
                    id={ids.picker}
                    rowLabel={labels.atmospherePicker}
                    value={JSON.stringify(preferences.atmosphereId)}
                    options={pickerGroups.flatMap((group) => group.options)}
                    groups={pickerGroups}
                    labels={labels}
                    onChange={(value) =>
                        mixer.setAtmosphere(
                            options?.find((option) => JSON.stringify(option.id) === value) ?? null
                        )
                    }
                />
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
            <div className="sap-reader-mixer__channel sap-reader-mixer__channel--master">
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
                <div className="sap-reader-mixer__level">
                    <MixerSlider
                        percent={Math.round((preferences.masterLevel ?? 1) * 100)}
                        label={labels.volume(labels.master)}
                        formatPercent={labels.formatPercent}
                        onChange={(value) => mixer.setMasterLevel(value / 100)}
                    />
                    <span className="sap-reader-mixer__percent" aria-hidden="true">
                        {labels.formatPercent(Math.round((preferences.masterLevel ?? 1) * 100))}
                    </span>
                </div>
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
                            className="sap-reader-mixer__layer sap-reader-mixer__channel"
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
                <div className="sap-reader-mixer__sleep-row sap-reader-mixer__choice-row">
                    <label className="sap-reader-mixer__name" htmlFor={ids.sleep}>
                        {labels.sleepTimer}
                    </label>
                    <ChoiceStepper
                        id={ids.sleep}
                        rowLabel={labels.sleepTimer}
                        value={
                            (state.sleepTimer.status === "running"
                                ? state.sleepTimer.choiceId
                                : null) ??
                            state.sleepTimerChoices.find((choice) => choice.kind === "off")?.id ??
                            ""
                        }
                        options={state.sleepTimerChoices.map((choice) => ({
                            value: choice.id,
                            label: choice.label,
                        }))}
                        labels={labels}
                        describedBy={ids.sleepStatus}
                        onChange={(value) => mixer.setSleepTimer(value)}
                    />
                </div>
                <div
                    className="sap-reader-mixer__sleep-status"
                    data-empty={!sleepMessage && state.sleepTimer.status !== "running"}
                >
                    <span id={ids.sleepStatus} aria-live="polite">
                        {sleepMessage}
                    </span>
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
            </div>
        </section>
    )
}
