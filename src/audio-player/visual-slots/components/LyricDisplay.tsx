import { useEffect, useMemo, useRef } from "react"
import type {
    VisualComponentDefinition,
    VisualComponentProps,
    VisualSettingsPanelProps,
} from "../types"

/**
 * First real SEI Canvas visual: a lyric display, ported in the Workshop-Light
 * direction (a standalone visual + a matching settings panel). It reads the live
 * track lyrics and playback position from the audio session and renders styled
 * lyric lines; all styling comes from {@link LyricSettings} via React props (no
 * direct DOM manipulation). CSS is scoped under `.sap-visual-lyric`.
 */
export interface LyricSettings {
    fontFamily: string
    fontWeight: number
    fontSize: number
    lineHeight: number
    highlightColor: string
    animationMode: "none" | "fade" | "slide"
}

export const LYRIC_DISPLAY_ID = "lyric-display"

export const lyricDefaultSettings: LyricSettings = {
    fontFamily:
        "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: 600,
    fontSize: 18,
    lineHeight: 1.6,
    highlightColor: "#7cc4ff",
    animationMode: "fade",
}

const FONT_FAMILY_OPTIONS: { label: string; value: string }[] = [
    { label: "System Sans", value: lyricDefaultSettings.fontFamily },
    { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
    { label: "Mono", value: "'SF Mono', 'Roboto Mono', Menlo, monospace" },
    { label: "Rounded", value: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
]

const ANIMATION_OPTIONS: { label: string; value: LyricSettings["animationMode"] }[] = [
    { label: "None", value: "none" },
    { label: "Fade", value: "fade" },
    { label: "Slide", value: "slide" },
]

/** Split a raw lyrics blob into non-empty display lines. */
function toLines(lyrics: string | undefined | null): string[] {
    if (!lyrics) return []
    return lyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
}

/**
 * The mounted SEI Canvas visual. Playback context (lyrics, position, duration)
 * arrives via props from the host renderer rather than the global audio session,
 * so the component works in every player — including the portable one that has no
 * `AudioSessionProvider`. With no timed-lyric metadata available, the "active"
 * line is estimated from playback progress so the highlight still moves with the
 * track — a real, settings-driven visual rather than a placeholder.
 */
export function LyricDisplay({
    settings,
    playback,
}: VisualComponentProps<LyricSettings>) {
    const currentTime = playback?.currentTime ?? 0
    const duration = playback?.duration ?? 0
    const lines = useMemo(() => toLines(playback?.lyrics), [playback?.lyrics])
    const containerRef = useRef<HTMLDivElement>(null)

    const ratio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
    const activeIndex =
        lines.length > 0 ? Math.min(lines.length - 1, Math.floor(ratio * lines.length)) : -1

    // Keep the highlighted line in view as playback advances. The query is scoped
    // to this component's own container, and no-ops safely when the empty state is
    // rendered (the ref isn't attached, so there's nothing to find).
    useEffect(() => {
        const active = containerRef.current?.querySelector('[data-active="true"]')
        active?.scrollIntoView({
            behavior: settings.animationMode === "none" ? "auto" : "smooth",
            block: "center",
            inline: "nearest",
        })
    }, [activeIndex, settings.animationMode])

    if (lines.length === 0) {
        return (
            <div className="sap-visual-lyric sap-visual-lyric--empty">
                <p className="sap-visual-lyric__empty-title">No lyrics</p>
                <p className="sap-visual-lyric__empty-hint">
                    This track has no lyrics to display.
                </p>
            </div>
        )
    }

    return (
        <div
            className="sap-visual-lyric"
            ref={containerRef}
            data-animation={settings.animationMode}
            style={{
                fontFamily: settings.fontFamily,
                fontWeight: settings.fontWeight,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
            }}
        >
            {lines.map((line, i) => {
                const isActive = i === activeIndex
                return (
                    <p
                        key={`${i}-${line}`}
                        className="sap-visual-lyric__line"
                        data-active={isActive ? "true" : "false"}
                        style={isActive ? { color: settings.highlightColor } : undefined}
                    >
                        {line}
                    </p>
                )
            })}
        </div>
    )
}

/** A labeled field row used by the settings panel. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="sap-visual-field">
            <span className="sap-visual-field__label">{label}</span>
            {children}
        </label>
    )
}

/**
 * Controlled settings editor for the lyric display. Rendered through the lyrics
 * workspace route via {@link ControllerPanelRenderer}; edits flow back through
 * `onChange` and update the live SEI Canvas visual.
 */
export function LyricSettingsPanel({
    settings,
    onChange,
}: VisualSettingsPanelProps<LyricSettings>) {
    return (
        <div className="sap-visual-settings">
            <Field label="Font family">
                <select
                    className="sap-visual-input"
                    value={settings.fontFamily}
                    onChange={(e) => onChange({ fontFamily: e.target.value })}
                >
                    {FONT_FAMILY_OPTIONS.map((opt) => (
                        <option key={opt.label} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label={`Font weight (${settings.fontWeight})`}>
                <input
                    className="sap-visual-input"
                    type="range"
                    min={100}
                    max={900}
                    step={100}
                    value={settings.fontWeight}
                    onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
                />
            </Field>

            <Field label={`Font size (${settings.fontSize}px)`}>
                <input
                    className="sap-visual-input"
                    type="range"
                    min={12}
                    max={48}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                />
            </Field>

            <Field label={`Line height (${settings.lineHeight.toFixed(1)})`}>
                <input
                    className="sap-visual-input"
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={settings.lineHeight}
                    onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
                />
            </Field>

            <Field label="Highlight color">
                <input
                    className="sap-visual-input sap-visual-input--color"
                    type="color"
                    value={settings.highlightColor}
                    onChange={(e) => onChange({ highlightColor: e.target.value })}
                />
            </Field>

            <Field label="Animation mode">
                <select
                    className="sap-visual-input"
                    value={settings.animationMode}
                    onChange={(e) =>
                        onChange({
                            animationMode: e.target
                                .value as LyricSettings["animationMode"],
                        })
                    }
                >
                    {ANIMATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </Field>
        </div>
    )
}

/** The registrable definition wiring the display + panel into the seiCanvas slot. */
export const lyricDisplayDefinition: VisualComponentDefinition<LyricSettings> = {
    id: LYRIC_DISPLAY_ID,
    name: "Lyric Display",
    slot: "seiCanvas",
    Component: LyricDisplay,
    SettingsPanel: LyricSettingsPanel,
    defaultSettings: lyricDefaultSettings,
}
