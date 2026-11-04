import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { SEISelect, SEISlider, SEISwitch } from "@seihouse/ui"
import { SEIArrowIcon } from "@seihouse/audio-player"

/* The controls every reader settings page shares, so the Audio and Narration
   pages speak one design language. Internal: not exported from the entry. */

/** Apply a setting to the approved switch, retaining its Enter shortcut. */
export function MixerSwitch({
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

const VOLUME_FORMAT = { style: "unit", unit: "percent", unitDisplay: "narrow" } as const

/** Keep percentage volume and host spoken wording on the approved native range. */
export function MixerSlider({
    percent,
    label,
    formatPercent,
    onChange,
}: {
    percent: number
    label: string
    formatPercent: (percent: number) => string
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

export interface StepperOption {
    value: string
    label: string
}

export interface StepperGroup {
    name: string | null
    options: readonly StepperOption[]
}

/** Group choices for a native picker: ungrouped first, then each named group in first-seen order. */
export function groupChoices<T>(
    items: readonly T[],
    group: (item: T) => unknown,
    toOption: (item: T) => StepperOption
): StepperGroup[] {
    const groups: { name: string | null; options: StepperOption[] }[] = []
    for (const item of items) {
        // Host data may be untyped; a non-string group counts as none.
        const raw = group(item)
        const name = typeof raw === "string" ? raw.trim() || null : null
        let entry = groups.find((candidate) => candidate.name === name)
        if (!entry) {
            entry = { name, options: [] }
            if (name === null) groups.unshift(entry)
            else groups.push(entry)
        }
        entry.options.push(toOption(item))
    }
    return groups
}

/**
 * A choice's control: ◀ and ▶ step through the choices in place, and the
 * native select between them opens the device's own picker for a direct jump.
 * It never expands, so the menu keeps its height.
 */
export function ChoiceStepper({
    id,
    rowLabel,
    value,
    options,
    groups,
    labels,
    describedBy,
    placeholder = "",
    adornment,
    ariaLabel,
    onChange,
}: {
    id: string
    rowLabel: string
    value: string
    /** Every choice in stepping order. */
    options: readonly StepperOption[]
    /** Optional grouping for the native picker; defaults to `options` ungrouped. */
    groups?: readonly StepperGroup[]
    labels: { previous: (rowLabel: string) => string; next: (rowLabel: string) => string }
    describedBy?: string
    /** Text shown while the value matches none of the options. */
    placeholder?: string
    /** A small mark shown before the value, such as a tier's icon. */
    adornment?: ReactNode
    /** An accessible name that overrides the visible label, when it says more. */
    ariaLabel?: string
    onChange: (value: string) => void
}) {
    const index = options.findIndex((option) => option.value === value)
    const step = (delta: number) => {
        const next = options[index + delta]
        if (next) onChange(next.value)
    }
    return (
        <div className="sap-reader-mixer__stepper" data-adorned={adornment ? "true" : undefined}>
            <button
                type="button"
                className="sap-reader-mixer__step"
                aria-label={labels.previous(rowLabel)}
                disabled={index <= 0}
                onClick={() => step(-1)}
            >
                <SEIArrowIcon direction="left" size="1em" />
            </button>
            <div className="sap-reader-mixer__stepper-value">
                {adornment && (
                    <span className="sap-reader-mixer__adornment" aria-hidden="true">
                        {adornment}
                    </span>
                )}
                <SEISelect
                    className="sap-reader-mixer__stepper-select"
                    wrapperClassName="sap-reader-mixer__stepper-field"
                    id={id}
                    aria-describedby={describedBy}
                    aria-label={ariaLabel}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                >
                    {index < 0 && (
                        <option value={value} disabled hidden>
                            {placeholder}
                        </option>
                    )}
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
            </div>
            <button
                type="button"
                className="sap-reader-mixer__step"
                aria-label={labels.next(rowLabel)}
                disabled={index < 0 || index >= options.length - 1}
                onClick={() => step(1)}
            >
                <SEIArrowIcon direction="right" size="1em" />
            </button>
        </div>
    )
}
