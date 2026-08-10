import { useAudioTime } from "../session/AudioSessionContext"
import { formatTime } from "../utils/formatTime"

export interface AudioTimeTextProps {
    value: "currentTime" | "duration"
    /** Retains presentational use outside an AudioSessionProvider. */
    fallback?: number
    /** Optional placeholder for an unknown or zero duration. */
    placeholder?: string
}

/** A narrow time-context subscriber for visible playback clocks. */
export function AudioTimeText({
    value,
    fallback = 0,
    placeholder,
}: AudioTimeTextProps) {
    const time = useAudioTime({
        currentTime: value === "currentTime" ? fallback : 0,
        duration: value === "duration" ? fallback : 0,
        buffered: 0,
    })
    const seconds = time[value]
    if (placeholder !== undefined && (!Number.isFinite(seconds) || seconds <= 0)) {
        return <>{placeholder}</>
    }
    return <>{formatTime(seconds)}</>
}
