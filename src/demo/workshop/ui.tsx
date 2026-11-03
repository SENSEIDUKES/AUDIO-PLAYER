import {
    createContext,
    useCallback,
    useContext,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import type { ReactNode } from "react"
import { STATUS_LABELS } from "./catalog"
import type { EntryStatus } from "./catalog"

/* Small, dependency-free building blocks shared by every workspace, so each
   workspace reads as "one live view + its controls" with the same vocabulary. */

export function StatusBadge({ status }: { status: EntryStatus }) {
    return (
        <span className={`wk-status wk-status--${status}`}>
            <span className="wk-status__dot" aria-hidden="true" />
            {STATUS_LABELS[status]}
        </span>
    )
}

/** The standard workspace body: the live view first, its controls beside it. */
export function SplitLayout({
    stage,
    controls,
    stageLabel = "Live view",
}: {
    stage: ReactNode
    controls: ReactNode
    stageLabel?: string
}) {
    return (
        <div className="wk-split">
            <section className="wk-stage" aria-label={stageLabel}>
                {stage}
            </section>
            <aside className="wk-controls" aria-label="Controls">
                {controls}
            </aside>
        </div>
    )
}

/** A titled group of controls or readouts. */
export function Panel({
    title,
    hint,
    children,
    actions,
}: {
    title: string
    hint?: ReactNode
    children: ReactNode
    actions?: ReactNode
}) {
    const headingId = useId()
    return (
        <section className="wk-panel" aria-labelledby={headingId}>
            <header className="wk-panel__head">
                <h2 className="wk-panel__title" id={headingId}>
                    {title}
                </h2>
                {actions && <div className="wk-panel__actions">{actions}</div>}
            </header>
            {hint && <p className="wk-panel__hint">{hint}</p>}
            <div className="wk-panel__body">{children}</div>
        </section>
    )
}

export interface SegmentedOption<T extends string> {
    value: T
    label: string
    disabled?: boolean
}

/** A one-of-many choice rendered as pressable buttons. */
export function Segmented<T extends string>({
    label,
    options,
    value,
    onChange,
}: {
    label: string
    options: readonly SegmentedOption<T>[]
    value: T
    onChange: (value: T) => void
}) {
    return (
        <div className="wk-field">
            <span className="wk-field__label">{label}</span>
            <div className="wk-segmented" role="group" aria-label={label}>
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`wk-segmented__btn${
                            option.value === value ? " wk-segmented__btn--on" : ""
                        }`}
                        aria-pressed={option.value === value}
                        disabled={option.disabled}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

/** An on/off switch with a visible label. */
export function Switch({
    label,
    checked,
    onChange,
    hint,
    disabled,
}: {
    label: string
    checked: boolean
    onChange: (next: boolean) => void
    hint?: string
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className="wk-switch"
            disabled={disabled}
            onClick={() => onChange(!checked)}
        >
            <span className="wk-switch__text">
                <span className="wk-switch__label">{label}</span>
                {hint && <span className="wk-switch__hint">{hint}</span>}
            </span>
            <span className={`wk-switch__track${checked ? " wk-switch__track--on" : ""}`}>
                <span className="wk-switch__knob" />
            </span>
        </button>
    )
}

export function SelectField<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T
    options: readonly SegmentedOption<T>[]
    onChange: (value: T) => void
}) {
    const id = useId()
    return (
        <div className="wk-field">
            <label className="wk-field__label" htmlFor={id}>
                {label}
            </label>
            <select
                id={id}
                className="wk-select"
                value={value}
                onChange={(event) => onChange(event.target.value as T)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

export function RangeField({
    label,
    value,
    min,
    max,
    step = 1,
    unit = "",
    format,
    onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    step?: number
    unit?: string
    format?: (value: number) => string
    onChange: (value: number) => void
}) {
    const id = useId()
    return (
        <div className="wk-field">
            <div className="wk-field__row">
                <label className="wk-field__label" htmlFor={id}>
                    {label}
                </label>
                <output className="wk-field__value" htmlFor={id}>
                    {format ? format(value) : `${value}${unit}`}
                </output>
            </div>
            <input
                id={id}
                className="wk-range"
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    )
}

export function TextField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
}) {
    const id = useId()
    return (
        <div className="wk-field">
            <label className="wk-field__label" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                className="wk-input"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    )
}

export function Button({
    children,
    onClick,
    variant = "default",
    disabled,
    pressed,
    label,
}: {
    children: ReactNode
    onClick: () => void
    variant?: "default" | "primary" | "danger" | "ghost"
    disabled?: boolean
    pressed?: boolean
    label?: string
}) {
    return (
        <button
            type="button"
            className={`wk-btn wk-btn--${variant}`}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={pressed}
            aria-label={label}
        >
            {children}
        </button>
    )
}

export function ButtonRow({ children }: { children: ReactNode }) {
    return <div className="wk-btn-row">{children}</div>
}

/** Key/value readout. Values render as-is; pass strings for predictable layout. */
export function Readout({
    rows,
    label,
}: {
    rows: readonly (readonly [string, ReactNode])[]
    label?: string
}) {
    return (
        <dl className="wk-readout" aria-label={label}>
            {rows.map(([key, value]) => (
                <div className="wk-readout__row" key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    )
}

/** Honest callout for a placeholder or a limitation the workspace can't hide. */
export function Note({
    children,
    tone = "info",
}: {
    children: ReactNode
    tone?: "info" | "placeholder" | "warn"
}) {
    return <p className={`wk-note wk-note--${tone}`}>{children}</p>
}

export interface LogLine {
    id: number
    time: string
    text: string
    tone?: "info" | "ok" | "warn" | "error"
}

/** A bounded, newest-first event log with a stable append function. */
export function useEventLog(limit = 40) {
    const [lines, setLines] = useState<LogLine[]>([])
    const append = useCallback(
        (text: string, tone: LogLine["tone"] = "info") => {
            const now = new Date()
            const time = now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })
            setLines((prev) =>
                [{ id: now.getTime() + Math.random(), time, text, tone }, ...prev].slice(0, limit)
            )
        },
        [limit]
    )
    const clear = useCallback(() => setLines([]), [])
    return { lines, append, clear }
}

export function EventLog({
    lines,
    empty = "Nothing yet. Interact with the live view.",
    label = "Event log",
}: {
    lines: readonly LogLine[]
    empty?: string
    label?: string
}) {
    if (lines.length === 0) return <p className="wk-log wk-log--empty">{empty}</p>
    return (
        <ol className="wk-log" aria-label={label} aria-live="polite">
            {lines.map((line) => (
                <li key={line.id} className={`wk-log__line wk-log__line--${line.tone ?? "info"}`}>
                    <time className="wk-log__time">{line.time}</time>
                    <span className="wk-log__text">{line.text}</span>
                </li>
            ))}
        </ol>
    )
}

/** Fixed-width stage frame for testing a face at a specific container width. */
export function WidthFrame({ width, children }: { width: number | "auto"; children: ReactNode }) {
    if (width === "auto") return <div className="wk-width-frame">{children}</div>
    return (
        <div className="wk-width-frame wk-width-frame--fixed" style={{ width, maxWidth: "100%" }}>
            <span className="wk-width-frame__label">{width}px</span>
            {children}
        </div>
    )
}

/* ------------------------- Mobile app shell -------------------------
   On phones (see `.wk-shell` in workshop.css) a workspace that opts in becomes
   a viewport-locked app screen: the page never scrolls, one section shows at a
   time, and a floating pill dock switches sections in place. On wider screens
   the dock is hidden and every section renders in the normal layout. Sections
   stay mounted when hidden, so audio and state survive a tab switch. */

export interface ShellTab {
    id: string
    label: string
}

/** The workspace chrome's part in a shell: it holds the tab so its own header can be the About tab. */
export interface ShellHost {
    tab: string | null
    select: (id: string) => void
    attach: () => () => void
}

export const ShellHostContext = createContext<ShellHost | null>(null)
export const SHELL_ABOUT_TAB = "about"

const ActiveShellTab = createContext<string | null>(null)

/** Opt a workspace into the mobile app shell. Wrap each section's content in a `ShellPanel`. */
export function MobileShell({
    tabs,
    children,
}: {
    tabs: readonly ShellTab[]
    children: ReactNode
}) {
    const host = useContext(ShellHostContext)
    const [localTab, setLocalTab] = useState<string | null>(null)
    const root = useRef<HTMLDivElement>(null)
    const active = (host ? host.tab : localTab) ?? tabs[0]?.id ?? ""
    const attach = host?.attach
    useLayoutEffect(() => attach?.(), [attach])
    const all = host ? [...tabs, { id: SHELL_ABOUT_TAB, label: "About" }] : tabs
    const select = (id: string) => {
        if (host) host.select(id)
        else setLocalTab(id)
        root.current?.closest(".wk-workspace")?.scrollTo?.({ top: 0 })
    }
    return (
        <ActiveShellTab.Provider value={active}>
            <div className="wk-shell" data-tab={active} ref={root}>
                {children}
                <nav className="wk-shell__dock" aria-label="Sections">
                    {all.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`wk-shell__tab${tab.id === active ? " wk-shell__tab--on" : ""}`}
                            aria-pressed={tab.id === active}
                            onClick={() => select(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
        </ActiveShellTab.Provider>
    )
}

/**
 * Content for one shell section; shown only while its tab is active on phones.
 * `fill` makes the section a full-bleed stage that fills the space between the
 * top bar and the dock instead of a column of rows.
 */
export function ShellPanel({
    tab,
    fill,
    children,
}: {
    tab: string
    fill?: boolean
    children: ReactNode
}) {
    const active = useContext(ActiveShellTab)
    return (
        <div
            className={`wk-shell-panel${active === tab ? " wk-shell-panel--on" : ""}${
                fill ? " wk-shell-panel--fill" : ""
            }`}
            data-shell-panel={tab}
        >
            {children}
        </div>
    )
}

export const STAGE_WIDTH_OPTIONS: readonly SegmentedOption<string>[] = [
    { value: "auto", label: "Auto" },
    { value: "320", label: "320" },
    { value: "375", label: "375" },
    { value: "480", label: "480" },
    { value: "720", label: "720" },
]

export function parseStageWidth(value: string): number | "auto" {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : "auto"
}
