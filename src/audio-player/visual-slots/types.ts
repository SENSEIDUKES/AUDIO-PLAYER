import type { ComponentType } from "react"

/**
 * The three intake slots a visual component can target.
 *
 * - `seiCanvas`       — the big visual region (lyrics, canvas visuals, reports,
 *                       album-world panels). Mounted by {@link SEICanvasRenderer}
 *                       inside `SEICanvasHost` when canvas mode is open.
 * - `scrubberCanvas`  — timeline/scrubber visuals (waveform skins, lyric timing
 *                       ribbons, section/beat/comment markers). Mounted by
 *                       {@link ScrubberCanvasRenderer} inside `ScrubberCanvasHost`;
 *                       falls back to the existing waveform/progress when none.
 * - `controllerPanel` — settings/config panels inside the SAPController workspace
 *                       sheet. Rendered by {@link ControllerPanelRenderer}.
 */
export type VisualSlot = "seiCanvas" | "scrubberCanvas" | "controllerPanel"

/**
 * Live playback context handed to a visual component through props. Visual
 * components are standalone (Workshop-Light style) and must not reach into the
 * global audio session directly — the host renderer supplies whatever playback
 * data it has (from the session, or a portable player's own engine), so the same
 * component works in every player regardless of how playback is wired.
 */
export interface VisualPlaybackContext {
    /** Current playback position, in seconds. */
    currentTime: number
    /** Total track duration, in seconds. */
    duration: number
    /** The active track's raw lyrics blob, if any. */
    lyrics?: string | null
}

/** Props passed into an active visual component's main render. */
export interface VisualComponentProps<S = Record<string, unknown>> {
    /** The live, editable settings for this component (from defaultSettings). */
    settings: S
    /** Live playback context supplied by the host renderer (optional). */
    playback?: VisualPlaybackContext
}

/**
 * Props passed into a component's settings panel. The panel is a controlled
 * editor: it renders from `settings` and reports edits through `onChange`. No
 * DOM mutation — the host owns the state.
 */
export interface VisualSettingsPanelProps<S = Record<string, unknown>> {
    settings: S
    /** Merge a partial update into the component's settings. */
    onChange: (partial: Partial<S>) => void
    /** Optional preview context (e.g. the active track's lyrics). */
    lyrics?: string
}

/**
 * A registrable visual component. This is the entire contract a Workshop-Light
 * style component needs to fulfil to be mounted into a slot — no marketplace,
 * entitlement, or plugin-lifecycle coupling.
 */
export interface VisualComponentDefinition<S = Record<string, unknown>> {
    /** Stable unique id used to look the component up and key its settings. */
    id: string
    /** Human-readable name for menus/labels. */
    name: string
    /** Which intake slot this component renders into. */
    slot: VisualSlot
    /** The component mounted into the slot. Receives `{ settings }`. */
    Component: ComponentType<VisualComponentProps<S>>
    /** Optional settings editor rendered in the controller workspace sheet. */
    SettingsPanel?: ComponentType<VisualSettingsPanelProps<S>>
    /** Initial settings; also seeds the per-player settings store. */
    defaultSettings: S
}

/** Any visual component definition, regardless of its settings shape. */
export type AnyVisualComponentDefinition = VisualComponentDefinition<any>
