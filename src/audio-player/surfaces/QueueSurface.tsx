import { useAudioSession } from "../session/AudioSessionContext"

export interface QueueSurfaceProps {
    /** Optional cap on how many upcoming tracks to list. */
    maxItems?: number
    className?: string
}

/**
 * A standalone "Up Next" list (Apple-Music style) for hosts composing their own
 * layout. Reads the shared session queue; tap a row to jump to that track.
 *
 * The bundled faces do not render this: their queue lives inside the "…"
 * controller at `library:queue`, alongside every other destination. This stays
 * exported for hosts that want an inline queue somewhere of their own choosing.
 */
export function QueueSurface({ maxItems, className }: QueueSurfaceProps) {
    const s = useAudioSession()
    const { queue, currentIndex, isPlaying } = s
    const upcoming = queue
        .map((track, index) => ({ track, index }))
        .filter(({ index }) => index >= currentIndex)
    const items = typeof maxItems === "number" ? upcoming.slice(0, maxItems) : upcoming

    return (
        <div
            className={`ap-queue-surface${className ? ` ${className}` : ""}`}
            role="group"
            aria-label="Up next"
        >
            <div className="ap-queue-surface__head">Up next</div>
            {items.length === 0 ? (
                <div className="ap-queue-surface__empty">Queue is empty</div>
            ) : (
                <ul className="ap-queue-surface__list">
                    {items.map(({ track, index }) => {
                        const isCurrent = index === currentIndex
                        return (
                            <li key={track.id ?? `${track.title}-${index}`}>
                                <button
                                    type="button"
                                    className={`ap-queue-surface__row ap-tap${
                                        isCurrent ? " ap-queue-surface__row--current" : ""
                                    }`}
                                    onClick={() => s.playTrack(index)}
                                    aria-current={isCurrent ? "true" : undefined}
                                    aria-label={`${isCurrent && isPlaying ? "Now playing:" : "Play"} ${track.title ?? "Unknown Track"} by ${track.artist ?? "Unknown Artist"}`}
                                >
                                    <span
                                        className="ap-queue-surface__title"
                                        title={track.title ?? "Unknown Track"}
                                    >
                                        {track.title ?? "Unknown Track"}
                                    </span>
                                    <span
                                        className="ap-queue-surface__artist"
                                        title={track.artist ?? "Unknown Artist"}
                                    >
                                        {track.artist ?? "Unknown Artist"}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export default QueueSurface
