import { useEffect, useId, useMemo, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { SEIRadio, SEIRadioGroup } from "@seihouse/ui"
import {
    READER_MIXER_LAYERS,
    SEIAtmosphereIcon,
    SEIAudioIcon,
    SEICueIcon,
    SEISoundscapeIcon,
    useOptionalReaderMixer,
    useReaderMixerState,
} from "@seihouse/audio-player"
import type {
    ReaderAtmosphereOption,
    SEIIconProps,
    ReaderMixer,
    ReaderMixerLayer,
    ReaderMixerLayerStatus,
} from "@seihouse/audio-player"
import { ChoiceStepper, MixerSlider, MixerSwitch, groupChoices } from "./controls.js"
import type { StepperOption } from "./controls.js"
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
    /** Accessible names of the sound choices beside Soundscapes, Sound Cues and Voice. */
    channelSounds: Readonly<Record<ReaderChannelSoundLayer, string>>
    /** Shown in a sound choice before anything is chosen. */
    noSound: string
    /** Accessible names of a choice row's ◀ and ▶ buttons; receive the row's name. */
    previous: (rowLabel: string) => string
    next: (rowLabel: string) => string
    /** Row messages for statuses worth telling the reader about. */
    status: Readonly<Partial<Record<ReaderMixerLayerStatus, string>>>
}

/** Override any label; `layers`, `channelSounds` and `status` merge key by key. */
export type ReaderMixerLabelOverrides = Partial<
    Omit<ReaderMixerLabels, "layers" | "status" | "channelSounds">
> & {
    layers?: Partial<Record<ReaderMixerLayer, string>>
    channelSounds?: Partial<Record<ReaderChannelSoundLayer, string>>
    status?: Partial<Record<ReaderMixerLayerStatus, string>>
}

/** The channels whose sound the host chooses (Atmosphere's comes from the mixer's catalog). */
export type ReaderChannelSoundLayer = Exclude<ReaderMixerLayer, "atmosphere">

/** One sound a channel can play, offered by the host. */
export interface ReaderChannelSoundChoice {
    id: string
    label: string
    /** Groups the choice in the device's picker, such as a score's category. */
    group?: string
}

/**
 * A host-owned sound choice for one channel: the panel shows it as a
 * `name ◀ value ▶` row under that channel and reports picks to `onChange`.
 * What a pick means is the host's (a scene score, a cue set, a narrator).
 */
export interface ReaderChannelSounds {
    choices: readonly ReaderChannelSoundChoice[]
    /** The current choice's id, or null before one is made. */
    value: string | null
    onChange: (id: string) => void
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
    channelSounds: Object.freeze({
        soundscapes: "Score",
        cues: "Cue sound",
        voice: "Narrator",
    }),
    noSound: "Choose…",
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
    /**
     * The layers the panel shows, kept in mixer order. Defaults to all of them;
     * `ReaderSettingsAudio` leaves Voice to the Narration page.
     */
    layers?: readonly ReaderMixerLayer[]
    /**
     * Sound choices for Soundscapes, Sound Cues and Voice, each shown on the
     * right of its channel's row. Atmosphere's comes from the mixer's catalog.
     */
    sounds?: Partial<Record<ReaderChannelSoundLayer, ReaderChannelSounds>>
    className?: string
    /** Theme overrides, typically `--sap-reader-mixer-*` custom properties. */
    style?: CSSProperties
}

/** SEIHouse's official icons before each channel's name; Voice has none yet. */
const CHANNEL_ICONS: Partial<
    Record<"master" | ReaderMixerLayer, (props: SEIIconProps) => ReactNode>
> = {
    master: SEIAudioIcon,
    soundscapes: SEISoundscapeIcon,
    atmosphere: SEIAtmosphereIcon,
    cues: SEICueIcon,
}

function ChannelIcon({ channel }: { channel: "master" | ReaderMixerLayer }) {
    const Icon = CHANNEL_ICONS[channel]
    return Icon ? <Icon className="sap-reader-mixer__icon" size="1em" /> : null
}

/** Merge host wording while retaining unspecified layer labels and statuses. */
function mergeLabels(overrides: ReaderMixerLabelOverrides | undefined): ReaderMixerLabels {
    if (!overrides) return DEFAULT_READER_MIXER_LABELS
    return {
        ...DEFAULT_READER_MIXER_LABELS,
        ...overrides,
        layers: { ...DEFAULT_READER_MIXER_LABELS.layers, ...overrides.layers },
        channelSounds: {
            ...DEFAULT_READER_MIXER_LABELS.channelSounds,
            ...overrides.channelSounds,
        },
        status: { ...DEFAULT_READER_MIXER_LABELS.status, ...overrides.status },
    }
}

type AtmosphereGroup = { name: string | null; options: ReaderAtmosphereOption[] }

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
    sounds,
    layers: shownLayers = READER_MIXER_LAYERS,
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
        sound: (layer: ReaderMixerLayer) => `${baseId}-${layer}-sound-row`,
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

    const hasAtmospherePicker = showAtmospherePicker && (options?.length ?? 0) > 0
    /** Every row keeps its right half; one with nothing to choose shows a quiet dash. */
    const emptySlot = (
        <div className="sap-reader-mixer__sound sap-reader-mixer__sound--empty" aria-hidden="true">
            <span className="sap-reader-mixer__stepper">—</span>
        </div>
    )

    /** A layer's sound choice, on the right of its row. */
    const renderSound = (layer: ReaderMixerLayer): ReactNode => {
        if (layer === "atmosphere") return renderPicker() ?? emptySlot
        const sound = sounds?.[layer]
        if (!sound) return emptySlot
        const rowLabel = labels.channelSounds[layer]
        const soundGroups = groupChoices(
            sound.choices,
            (choice) => choice.group,
            (choice): StepperOption => ({ value: choice.id, label: choice.label })
        )
        return (
            <div
                className="sap-reader-mixer__sound sap-reader-mixer__choice-row"
                id={ids.sound(layer)}
            >
                <label className="sap-reader-mixer__name" htmlFor={`${ids.sound(layer)}-select`}>
                    {rowLabel}
                </label>
                <ChoiceStepper
                    id={`${ids.sound(layer)}-select`}
                    rowLabel={rowLabel}
                    value={sound.value ?? ""}
                    placeholder={labels.noSound}
                    options={soundGroups.flatMap((group) => group.options)}
                    groups={soundGroups}
                    labels={labels}
                    onChange={sound.onChange}
                />
            </div>
        )
    }

    const renderPicker = (): ReactNode => {
        if (!hasAtmospherePicker) return null
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
            <div
                className="sap-reader-mixer__atmosphere sap-reader-mixer__sound sap-reader-mixer__choice-row"
                id={ids.sound("atmosphere")}
            >
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
                        <ChannelIcon channel="master" />
                        <span className="sap-reader-mixer__label">{labels.master}</span>
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
                {/* The sleep timer sits beside Master, as each layer's sound sits beside it. */}
                {state.sleepTimerChoices.length === 0 && emptySlot}
                {state.sleepTimerChoices.length > 0 && (
                    <div className="sap-reader-mixer__sound sap-reader-mixer__timer sap-reader-mixer__choice-row">
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
                                state.sleepTimerChoices.find((choice) => choice.kind === "off")
                                    ?.id ??
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
                )}
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
            {!READER_MIXER_LAYERS.some(
                (layer) => shownLayers.includes(layer) && state.availability[layer]
            ) && <p className="sap-reader-mixer__empty">{labels.noAudio}</p>}
            <ul className="sap-reader-mixer__layers">
                {READER_MIXER_LAYERS.filter(
                    (layer) =>
                        shownLayers.includes(layer) &&
                        (state.availability[layer] ||
                            focusedLayer === layer ||
                            draggingLayer === layer)
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
                                    <ChannelIcon channel={layer} />
                                    <span className="sap-reader-mixer__label">{label}</span>
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
                            {renderSound(layer)}
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
