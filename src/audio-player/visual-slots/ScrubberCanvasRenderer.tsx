import type { ReactNode } from "react"
import { getVisualComponent } from "./visualRegistry"
import { useVisualSlots } from "./VisualSlotsContext"

export interface ScrubberCanvasRendererProps {
    currentTime: number
    duration: number
    onSeek: (time: number) => void
    /**
     * The existing scrubber content (e.g. the WaveformAdapter/progress group).
     * Rendered as the default fallback when no `scrubberCanvas` component is
     * active, so waveform/progress behavior is byte-identical to before.
     */
    children: ReactNode
}

/**
 * Intake point for `scrubberCanvas` visuals. If a component is active for the
 * slot it is mounted with live timeline props + its settings; otherwise the
 * provided `children` (the existing waveform/progress) render unchanged. No
 * scrubberCanvas component ships in V1, so the default path is the fallback.
 */
export function ScrubberCanvasRenderer({
    currentTime,
    duration,
    onSeek,
    children,
}: ScrubberCanvasRendererProps) {
    const slots = useVisualSlots()
    const activeId = slots.getActive("scrubberCanvas")
    const def = getVisualComponent(activeId)

    if (!def) return <>{children}</>

    const { Component } = def
    // Scrubber visuals receive the same settings contract plus timeline context
    // via props; the component decides what to do with them.
    return (
        <Component
            settings={{
                ...slots.getSettings(def.id),
                currentTime,
                duration,
                onSeek,
            }}
        />
    )
}

export default ScrubberCanvasRenderer
