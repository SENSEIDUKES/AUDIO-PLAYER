import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import type { ReaderMixer } from "../narrative/ReaderMixer"
import { useOptionalReaderMixer, useReaderMixerState } from "../narrative/ReaderMixerContext"
import { DEFAULT_READER_MIXER_NOTE_LABELS, ReaderMixerNote } from "./ReaderMixerNote"
import type { ReaderMixerNoteLabels } from "./ReaderMixerNote"
import "./reader-note-face.css"

export interface ReaderNoteFaceLabels extends ReaderMixerNoteLabels {
    /** Accessible name of the hold-to-open volume slider and its group. */
    quickVolume: string
}

export const DEFAULT_READER_NOTE_FACE_LABELS: ReaderNoteFaceLabels = Object.freeze({
    ...DEFAULT_READER_MIXER_NOTE_LABELS,
    quickVolume: "Quick master volume",
})

export interface ReaderNoteFaceProps {
    /** The mixer to control. Defaults to the one from `ReaderMixerProvider`. */
    mixer?: ReaderMixer | null
    /** Note wording and the quick volume's name. Unset note labels use the note's defaults. */
    labels?: Partial<ReaderNoteFaceLabels>
    /** Defaults to 600 ms, the note's own long press. */
    longPressMs?: number
    className?: string
    style?: CSSProperties
}

/**
 * The narrator face SEN's reader ships: one music note, placed by the host.
 * A tap mutes or unmutes the story audio without turning Master off; a hold
 * (or ↑/↓) opens a vertical quick master volume above it. Only the host's
 * Settings owns the Master switch, so while Master is off the face is hidden.
 */
export function ReaderNoteFace({
    mixer: mixerProp,
    labels: overrides,
    longPressMs,
    className,
    style,
}: ReaderNoteFaceProps) {
    const context = useOptionalReaderMixer()
    const mixer = mixerProp ?? context
    const state = useReaderMixerState(mixer)
    const [open, setOpen] = useState(false)
    const root = useRef<HTMLDivElement>(null)
    const slider = useRef<HTMLInputElement>(null)
    const enabled = Boolean(state?.preferences.masterEnabled)
    const { quickVolume, ...noteLabels } = { ...DEFAULT_READER_NOTE_FACE_LABELS, ...overrides }

    useEffect(() => {
        if (!enabled) {
            setOpen(false)
            return
        }
        if (!open) return
        slider.current?.focus()
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener("pointerdown", outside, true)
        return () => document.removeEventListener("pointerdown", outside, true)
    }, [open, enabled])

    if (!mixer || !state || !enabled) return null
    const percent = Math.round((state.preferences.masterLevel ?? 1) * 100)
    return (
        <div
            ref={root}
            className={["sap-reader-note-face", className].filter(Boolean).join(" ")}
            style={style}
            data-open={open}
            onKeyDown={(event) => {
                if (event.key === "Escape" && open) {
                    event.stopPropagation()
                    setOpen(false)
                    root.current?.querySelector("button")?.focus()
                } else if (!open && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                    event.preventDefault()
                    setOpen(true)
                }
            }}
            onBlur={(event) => {
                // Keyboard users tabbing away close it, as a press outside does.
                if (open && !event.currentTarget.contains(event.relatedTarget as Node | null))
                    setOpen(false)
            }}
        >
            <ReaderMixerNote
                mixer={mixer}
                muteMode="soundtrack-mute"
                labels={noteLabels}
                longPressMs={longPressMs}
                className="sap-reader-note-face__note"
                onOpenSettings={() => setOpen(true)}
            />
            {open && (
                <div className="sap-reader-note-face__volume">
                    <input
                        ref={slider}
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        aria-label={quickVolume}
                        aria-orientation="vertical"
                        aria-valuetext={`${percent}%`}
                        value={percent}
                        style={{ "--sap-reader-note-level": `${percent}%` } as CSSProperties}
                        onChange={(event) => mixer.setMasterLevel(Number(event.target.value) / 100)}
                    />
                </div>
            )}
        </div>
    )
}
