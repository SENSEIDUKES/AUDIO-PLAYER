import { useId, useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import { useOptionalReaderMixer, useReaderMixerState } from "@seihouse/audio-player"
import type { ReaderMixer } from "@seihouse/audio-player"
import { ChoiceStepper, MixerSlider, MixerSwitch, groupChoices } from "./controls.js"
import type { StepperOption } from "./controls.js"
import type { ReaderChannelSoundChoice } from "./ReaderMixerPanel.js"
import "./reader-ui.css"

/** A voice tier the reader can choose: what reading aloud costs and sounds like. */
export interface ReaderVoiceTier {
    id: string
    label: string
    /** The tier's mark, shown before its name (SEN's Fate Pressure flames). */
    icon?: ReactNode
}

/** One speaker in the chapter who can be given a voice. */
export interface ReaderVoiceSlot {
    id: string
    /** Who speaks: the narrator, the main character, a named codex character. */
    name: string
    /** The voice assigned to them, or null before one is. */
    voiceId: string | null
}

/** Every piece of text the Narration page shows, for wording and translation. */
export interface ReaderNarrationLabels {
    title: string
    voice: string
    /** Accessible name of the voice volume slider. */
    volume: (label: string) => string
    formatPercent: (percent: number) => string
    tier: string
    /** Name of the group holding the voice slots. */
    slots: string
    /** Accessible name of a slot's voice choice. */
    voiceFor: (name: string) => string
    /** Shown in a slot before a voice is assigned. */
    noVoice: string
    previous: (rowLabel: string) => string
    next: (rowLabel: string) => string
}

export const DEFAULT_READER_NARRATION_LABELS: ReaderNarrationLabels = Object.freeze({
    title: "Narration",
    voice: "Voice",
    volume: (label: string) => `${label} volume`,
    formatPercent: (percent: number) => `${percent}%`,
    tier: "Tier",
    slots: "Voices",
    voiceFor: (name: string) => `Voice for ${name}`,
    noVoice: "Choose…",
    previous: (rowLabel: string) => `Previous ${rowLabel}`,
    next: (rowLabel: string) => `Next ${rowLabel}`,
})

export interface ReaderSettingsNarrationProps {
    /** The mixer whose Voice layer the top row controls. Defaults to `ReaderMixerProvider`'s. */
    mixer?: ReaderMixer | null
    /** The tiers on offer, cheapest first. */
    tiers?: readonly ReaderVoiceTier[]
    /** The reader's tier. */
    tier?: string | null
    onTierChange?: (tierId: string) => void
    /** The voices the chosen tier offers; `group` names their source in the picker. */
    voices?: readonly ReaderChannelSoundChoice[]
    /** The chapter's speakers, in the order their slots show. */
    slots?: readonly ReaderVoiceSlot[]
    onAssign?: (slotId: string, voiceId: string) => void
    /** How many slots the page always shows; unused ones show a dash. Defaults to 8. */
    slotCount?: number
    labels?: Partial<ReaderNarrationLabels>
    /** One line above the controls. Pass `null` to leave it out. */
    help?: ReactNode
    /** Host-owned pieces below the slots. */
    children?: ReactNode
    className?: string
    style?: CSSProperties
}

/**
 * The Narration page of the reader's Settings, in the Audio page's design
 * language. The top row is **Voice | Tier**: the Voice layer's switch and
 * volume on the left, the reader's tier on the right. Below it, a fixed grid
 * of voice slots: each speaker in the chapter (the narrator, the main
 * character, any named codex character) gets a slot whose ◀ voice ▶ picks
 * from the chosen tier's voices. The host supplies the tiers, the voices and
 * the speakers, and decides what an assignment does; the page never grows.
 */
export function ReaderSettingsNarration({
    mixer: mixerProp,
    tiers = [],
    tier = null,
    onTierChange,
    voices = [],
    slots = [],
    onAssign,
    slotCount = 8,
    labels: overrides,
    help,
    children,
    className,
    style,
}: ReaderSettingsNarrationProps) {
    const context = useOptionalReaderMixer()
    const mixer = mixerProp ?? context
    const state = useReaderMixerState(mixer)
    const labels = useMemo(
        () => ({ ...DEFAULT_READER_NARRATION_LABELS, ...overrides }),
        [overrides]
    )
    const baseId = useId()
    const ids = {
        voice: `${baseId}-voice`,
        tier: `${baseId}-tier`,
        slots: `${baseId}-slots`,
        slot: (index: number) => `${baseId}-slot-${index}`,
    }
    const voiceGroups = useMemo(
        () =>
            groupChoices(
                voices,
                (voice) => voice.group,
                (voice): StepperOption => ({ value: voice.id, label: voice.label })
            ),
        [voices]
    )
    // After every hook: like the Audio page, there is nothing to show without a mixer.
    if (!mixer || !state) return null

    const voiceOptions = voiceGroups.flatMap((group) => group.options)
    const current = tiers.find((entry) => entry.id === tier)
    const preference = state.preferences.layers.voice
    const percent = Math.round(preference.level * 100)
    const visible = slots.slice(0, slotCount)
    const empties = Math.max(0, slotCount - visible.length)

    return (
        <section
            aria-label={labels.title}
            className={[
                "sap-reader-settings",
                "sap-reader-settings-audio",
                "sap-reader-settings-narration",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
        >
            {help != null && <p className="sap-reader-settings__help">{help}</p>}
            <div className="sap-reader-mixer sap-reader-narration">
                {/* Voice | Tier: the same split row as each Audio channel. */}
                <div
                    className="sap-reader-mixer__channel sap-reader-narration__voice"
                    data-enabled={preference.enabled ? "true" : "false"}
                >
                    <div className="sap-reader-mixer__row">
                        <span className="sap-reader-mixer__name" id={ids.voice}>
                            {labels.voice}
                        </span>
                        <MixerSwitch
                            checked={preference.enabled}
                            labelledBy={ids.voice}
                            onChange={(enabled) => mixer.setLayerEnabled("voice", enabled)}
                        />
                    </div>
                    <div className="sap-reader-mixer__level">
                        <MixerSlider
                            percent={percent}
                            label={labels.volume(labels.voice)}
                            formatPercent={labels.formatPercent}
                            onChange={(value) => mixer.setLayerLevel("voice", value / 100)}
                        />
                        <span className="sap-reader-mixer__percent" aria-hidden="true">
                            {labels.formatPercent(percent)}
                        </span>
                    </div>
                    {tiers.length > 0 ? (
                        <div className="sap-reader-mixer__sound sap-reader-mixer__choice-row">
                            <label className="sap-reader-mixer__name" htmlFor={ids.tier}>
                                {labels.tier}
                            </label>
                            <ChoiceStepper
                                id={ids.tier}
                                rowLabel={labels.tier}
                                value={tier ?? ""}
                                options={tiers.map((entry) => ({
                                    value: entry.id,
                                    label: entry.label,
                                }))}
                                labels={labels}
                                adornment={current?.icon}
                                onChange={(id) => onTierChange?.(id)}
                            />
                        </div>
                    ) : (
                        <div
                            className="sap-reader-mixer__sound sap-reader-mixer__sound--empty"
                            aria-hidden="true"
                        >
                            <span className="sap-reader-mixer__stepper">—</span>
                        </div>
                    )}
                </div>
                {/* A fixed grid of slots, one per speaker, so the page keeps its height. */}
                <div
                    className="sap-reader-narration__slots"
                    role="group"
                    aria-label={labels.slots}
                    id={ids.slots}
                >
                    {visible.map((slot, index) => (
                        <div
                            key={slot.id}
                            className="sap-reader-narration__slot sap-reader-mixer__choice-row"
                            data-assigned={slot.voiceId ? "true" : "false"}
                        >
                            <label className="sap-reader-narration__who" htmlFor={ids.slot(index)}>
                                {slot.name}
                            </label>
                            <ChoiceStepper
                                id={ids.slot(index)}
                                rowLabel={labels.voiceFor(slot.name)}
                                ariaLabel={labels.voiceFor(slot.name)}
                                value={slot.voiceId ?? ""}
                                placeholder={labels.noVoice}
                                options={voiceOptions}
                                groups={voiceGroups}
                                labels={labels}
                                onChange={(voiceId) => onAssign?.(slot.id, voiceId)}
                            />
                        </div>
                    ))}
                    {Array.from({ length: empties }, (_, index) => (
                        <div
                            key={`empty-${index}`}
                            className="sap-reader-narration__slot sap-reader-narration__slot--empty"
                            aria-hidden="true"
                        >
                            <span className="sap-reader-narration__who">—</span>
                        </div>
                    ))}
                </div>
            </div>
            {children}
        </section>
    )
}
