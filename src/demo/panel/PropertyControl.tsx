import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import type {
    MediaSource,
    PropertyDescriptor,
    RepeatMode,
} from "../../audio-player"
import { MediaPicker } from "./MediaPicker"
import { getRecentColors, pushRecentColor, subscribeRecentColors } from "../recentColors"

/* rgba/hex normalizer: <input type=color> only accepts 7-char hex, but the
   audio player uses hex AND rgba() strings. Fall back so the user still sees a
   swatch for values the picker can't render. */
export function normalizeColor(
    value: string | undefined,
    fallback = "#000000"
): string {
    if (!value) return fallback
    const v = value.trim()
    if (/^#[0-9a-f]{6}$/i.test(v)) return v
    if (/^#[0-9a-f]{3}$/i.test(v)) {
        return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    }
    const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) {
        const r = Number(m[1]).toString(16).padStart(2, "0")
        const g = Number(m[2]).toString(16).padStart(2, "0")
        const b = Number(m[3]).toString(16).padStart(2, "0")
        return `#${r}${g}${b}`
    }
    return fallback
}

export const FONT_WEIGHTS = [
    { value: 300, label: "Light" },
    { value: 400, label: "Regular" },
    { value: 500, label: "Medium" },
    { value: 600, label: "Semibold" },
    { value: 700, label: "Bold" },
    { value: 800, label: "Extrabold" },
]

export function Toggle({
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
            <label className="framer-panel__label" htmlFor={id}>
                {label}
            </label>
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

/** One editable property, rendered from its descriptor + current value. */
export function PropertyControl({
    descriptor,
    value,
    onSet,
}: {
    descriptor: PropertyDescriptor
    value: unknown
    onSet: (propPath: string, value: unknown) => void
}) {
    const { control, label, id, propPath } = descriptor
    const fieldId = `ws-${id}`
    // Hooks must run unconditionally before the switch below (Rules of
    // Hooks) — only the "color" case reads this state, but it has to be
    // declared at the top level regardless of which control kind renders.
    const [recentColors, setRecentColors] = useState<string[]>(getRecentColors)
    useEffect(() => subscribeRecentColors(setRecentColors), [])

    switch (control.kind) {
        case "color": {
            const fallback = id === "textColor" || id === "backgroundColor" ? "#ffffff" : "#000000"
            const applyColor = (hex: string) => {
                onSet(propPath, hex)
                setRecentColors(pushRecentColor(hex))
            }
            return (
                <div className="framer-panel__row framer-panel__row--col">
                    <div className="framer-panel__row">
                        <label className="framer-panel__label" htmlFor={fieldId}>
                            {label}
                        </label>
                        <input
                            id={fieldId}
                            className="framer-panel__color"
                            type="color"
                            value={normalizeColor(value as string, fallback)}
                            onChange={(e) => applyColor(e.target.value)}
                        />
                    </div>
                    {recentColors.length > 0 && (
                        <div className="framer-panel__preset-row" aria-label="Recently used colors">
                            {recentColors.map((hex) => (
                                <button
                                    key={hex}
                                    type="button"
                                    className="framer-panel__swatch"
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                    aria-label={`Use color ${hex}`}
                                    onClick={() => applyColor(hex)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )
        }

        case "text":
            return (
                <div className="framer-panel__row framer-panel__row--col">
                    <label className="framer-panel__label" htmlFor={fieldId}>
                        {label}
                    </label>
                    <input
                        id={fieldId}
                        className="framer-panel__input"
                        value={(value as string) ?? ""}
                        placeholder={control.placeholder}
                        onChange={(e) => onSet(propPath, e.target.value)}
                    />
                </div>
            )

        case "toggle":
            return (
                <Toggle
                    id={fieldId}
                    label={label}
                    value={Boolean(value)}
                    onToggle={() => onSet(propPath, !value)}
                />
            )

        case "range": {
            const n = Number(value ?? control.min)
            return (
                <>
                    <div className="framer-panel__row">
                        <label className="framer-panel__label" htmlFor={fieldId}>
                            {label}
                        </label>
                        <input
                            id={fieldId}
                            className="framer-panel__range"
                            type="range"
                            min={control.min}
                            max={control.max}
                            step={control.step ?? 1}
                            value={n}
                            onChange={(e) => onSet(propPath, Number(e.target.value))}
                        />
                    </div>
                    <div className="framer-panel__value">
                        {n}
                        {control.unit ?? ""}
                    </div>
                </>
            )
        }

        case "select":
            return (
                <div className="framer-panel__row">
                    <label className="framer-panel__label" htmlFor={fieldId}>
                        {label}
                    </label>
                    <select
                        id={fieldId}
                        className="framer-panel__select"
                        value={String(value ?? "")}
                        onChange={(e) =>
                            onSet(propPath, e.target.value as RepeatMode)
                        }
                    >
                        {control.options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            )

        case "font": {
            const font = (value as CSSProperties) ?? {}
            const setFont = (patch: Partial<CSSProperties>) =>
                onSet(propPath, { ...font, ...patch })
            return (
                <div className="framer-panel__subgroup">
                    <div className="framer-panel__subhead">{label}</div>
                    <div className="framer-panel__row">
                        <label className="framer-panel__label" htmlFor={`${fieldId}-sz`}>
                            Size
                        </label>
                        <input
                            id={`${fieldId}-sz`}
                            className="framer-panel__input"
                            value={font.fontSize ?? ""}
                            onChange={(e) => setFont({ fontSize: e.target.value })}
                        />
                    </div>
                    <div className="framer-panel__row">
                        <label className="framer-panel__label" htmlFor={`${fieldId}-w`}>
                            Weight
                        </label>
                        <select
                            id={`${fieldId}-w`}
                            className="framer-panel__select"
                            value={String(font.fontWeight ?? 500)}
                            onChange={(e) =>
                                setFont({ fontWeight: Number(e.target.value) })
                            }
                        >
                            {FONT_WEIGHTS.map((w) => (
                                <option key={w.value} value={w.value}>
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="framer-panel__row">
                        <label className="framer-panel__label" htmlFor={`${fieldId}-ls`}>
                            Tracking
                        </label>
                        <input
                            id={`${fieldId}-ls`}
                            className="framer-panel__input"
                            value={font.letterSpacing ?? ""}
                            onChange={(e) =>
                                setFont({ letterSpacing: e.target.value })
                            }
                        />
                    </div>
                    <div className="framer-panel__row">
                        <label className="framer-panel__label" htmlFor={`${fieldId}-lh`}>
                            Leading
                        </label>
                        <input
                            id={`${fieldId}-lh`}
                            className="framer-panel__input"
                            value={font.lineHeight ?? ""}
                            onChange={(e) => setFont({ lineHeight: e.target.value })}
                        />
                    </div>
                </div>
            )
        }

        case "media":
            return (
                <MediaPicker
                    label={label}
                    description={descriptor.description}
                    value={value as MediaSource | null}
                    onChange={(media) => onSet(propPath, media)}
                />
            )

        default:
            return null
    }
}
