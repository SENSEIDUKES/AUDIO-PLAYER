import type { Track } from "../../types"
import { CloseIcon } from "../../skins/icons"

/* The Up Next workspace — the in-controller home of the play queue.
   Queue lives here, inside the "…" controller, and nowhere else: the radial
   menu's Queue › Up Next and the controller's own Queue row both land on this
   route rather than opening a separate drawer.

   The shell stays decoupled from the engine: the host passes a plain snapshot
   (the same pattern PlaybackControlsWorkspace uses for playback state). */

export interface WorkspaceQueueState {
    /** The queue in play order. */
    tracks: readonly Track[]
    /** Index of the currently playing track. */
    currentIndex: number
    /** Whether the current track is playing (labels the active row). */
    isPlaying?: boolean
    /** Jump to a queue position. */
    onPlayTrack?: (index: number) => void
    /** Drop a track from the queue. Omitted when the host can't reorder. */
    onRemove?: (index: number) => void
}

export function LibraryQueueWorkspace({ queue }: { queue?: WorkspaceQueueState }) {
    // A host that routes here without wiring the queue gets an honest empty
    // panel rather than a dead list. This is a public entry point, so a
    // snapshot missing `tracks` entirely (an untyped plain-JS host) reads as
    // empty instead of throwing inside the controller sheet.
    if (!queue?.tracks?.length) {
        return (
            <div className="sap-ctl__workspace-empty">
                <p className="sap-ctl__workspace-lead">Up Next</p>
                <p className="sap-ctl__workspace-sub">The queue is empty.</p>
            </div>
        )
    }

    const { tracks, currentIndex, isPlaying = false, onPlayTrack, onRemove } = queue
    return (
        <section className="sap-ctl__section" aria-label="Up next">
            <ul className="sap-ctl__queue">
                {tracks.map((track, index) => {
                    const isCurrent = index === currentIndex
                    const title = track.title ?? "Unknown Track"
                    const artist = track.artist ?? "Unknown Artist"
                    return (
                        <li
                            // The queue may legitimately hold the same track
                            // twice (Queue › Play Later on a track already
                            // queued), so the position is part of the identity —
                            // an id alone would collide.
                            key={`${track.id ?? title}-${index}`}
                            className={`sap-ctl__queue-item${
                                isCurrent ? " sap-ctl__queue-item--current" : ""
                            }`}
                        >
                            <button
                                type="button"
                                className="sap-ctl__row ap-tap"
                                onClick={() => onPlayTrack?.(index)}
                                disabled={!onPlayTrack}
                                aria-current={isCurrent ? "true" : undefined}
                                aria-label={`${
                                    isCurrent && isPlaying ? "Now playing:" : "Play"
                                } ${title} by ${artist}`}
                            >
                                <span className="sap-ctl__label">
                                    <span className="sap-ctl__queue-index" aria-hidden="true">
                                        {index + 1}
                                    </span>
                                    <span className="sap-ctl__queue-meta">
                                        <span className="sap-ctl__queue-title">{title}</span>
                                        <span className="sap-ctl__queue-artist">{artist}</span>
                                    </span>
                                </span>
                            </button>
                            {onRemove && (
                                <button
                                    type="button"
                                    className="sap-ctl__queue-remove ap-tap"
                                    onClick={() => onRemove(index)}
                                    aria-label={`Remove ${title} from the queue`}
                                >
                                    <CloseIcon />
                                </button>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

export default LibraryQueueWorkspace
