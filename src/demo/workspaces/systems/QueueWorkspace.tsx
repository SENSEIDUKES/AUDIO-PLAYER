import { useState } from "react"
import {
    AudioSessionProvider,
    QueueDrawer,
    QueueSurface,
    StickyBottomPlayer,
    useAudioSession,
} from "../../../audio-player"
import type { Track, WorkspaceRoute } from "../../../audio-player"
import { SEA_THEME, narrationTracks, noLuckTracks, proPlaylist } from "../../data"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    SplitLayout,
    StatusBadge,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { ROUTE_STATUS } from "../shared/routes"
import { SessionController, SessionEventFeed, SessionReadout } from "../shared/session"

/* The shared queue and every surface that reads it: the inline Up Next list,
   the drag-and-drop Queue Drawer, and the controller's Up Next workspace. */

const CATALOG: readonly Track[] = [...narrationTracks.slice(0, 2), ...proPlaylist.slice(0, 2)]

function QueueList({ append }: { append: (text: string, tone?: LogLine["tone"]) => void }) {
    const s = useAudioSession()
    if (s.queue.length === 0) return <p className="wk-log wk-log--empty">The queue is empty.</p>
    return (
        <ol className="wk-inline-list" aria-label="Queue">
            {s.queue.map((track, index) => {
                const current = index === s.currentIndex
                return (
                    <li
                        key={`${track.id ?? track.title}-${index}`}
                        className={`wk-inline-list__row${current ? " wk-inline-list__row--active" : ""}`}
                    >
                        <span className="wk-inline-list__main">
                            <span className="wk-inline-list__title">
                                {index + 1}. {track.title}
                            </span>
                            <span className="wk-inline-list__sub">
                                {current ? (s.isPlaying ? "Now playing" : "Current") : track.artist}
                            </span>
                        </span>
                        <span className="wk-inline-list__actions">
                            <Button
                                label={`Play ${track.title}`}
                                onClick={() => s.playTrack(index)}
                            >
                                ▶
                            </Button>
                            <Button
                                label={`Move ${track.title} up`}
                                disabled={index === 0}
                                onClick={() => {
                                    s.moveQueueItem(index, index - 1)
                                    append(`moveQueueItem(${index}, ${index - 1})`)
                                }}
                            >
                                ↑
                            </Button>
                            <Button
                                label={`Move ${track.title} down`}
                                disabled={index === s.queue.length - 1}
                                onClick={() => {
                                    s.moveQueueItem(index, index + 1)
                                    append(`moveQueueItem(${index}, ${index + 1})`)
                                }}
                            >
                                ↓
                            </Button>
                            <Button
                                label={`Remove ${track.title}`}
                                variant="danger"
                                disabled={current}
                                onClick={() => {
                                    s.removeFromQueue(index)
                                    append(`removeFromQueue(${index})`, "warn")
                                }}
                            >
                                ✕
                            </Button>
                        </span>
                    </li>
                )
            })}
        </ol>
    )
}

function Catalog({ append }: { append: (text: string, tone?: LogLine["tone"]) => void }) {
    const s = useAudioSession()
    return (
        <ul className="wk-inline-list" aria-label="Catalog">
            {CATALOG.map((track) => (
                <li key={track.id ?? track.title} className="wk-inline-list__row">
                    <span className="wk-inline-list__main">
                        <span className="wk-inline-list__title">{track.title}</span>
                        <span className="wk-inline-list__sub">{track.artist}</span>
                    </span>
                    <span className="wk-inline-list__actions">
                        <Button
                            onClick={() => {
                                s.playNow(track)
                                append(`playNow(“${track.title}”)`, "ok")
                            }}
                        >
                            Now
                        </Button>
                        <Button
                            onClick={() => {
                                s.playNext(track)
                                append(`playNext(“${track.title}”)`, "ok")
                            }}
                        >
                            Next
                        </Button>
                        <Button
                            onClick={() => {
                                s.enqueue(track)
                                append(`enqueue(“${track.title}”)`, "ok")
                            }}
                        >
                            Later
                        </Button>
                    </span>
                </li>
            ))}
        </ul>
    )
}

function QueueControls({
    append,
    onOpenRoute,
}: {
    append: (text: string, tone?: LogLine["tone"]) => void
    onOpenRoute: (route: WorkspaceRoute) => void
}) {
    const s = useAudioSession()
    const [drawerOpen, setDrawerOpen] = useState(false)
    return (
        <>
            <ButtonRow>
                <Button onClick={s.previous} disabled={!s.canPrevious}>
                    Previous
                </Button>
                <Button onClick={s.next} disabled={!s.canNext}>
                    Next
                </Button>
                <Button onClick={s.toggleShuffle} pressed={s.shuffle}>
                    Shuffle {s.shuffle ? "on" : "off"}
                </Button>
                <Button onClick={s.cycleRepeat}>Repeat: {s.repeatMode}</Button>
            </ButtonRow>
            <ButtonRow>
                <Button variant="primary" onClick={() => setDrawerOpen(true)}>
                    Open Queue Drawer
                </Button>
                <Button
                    variant="danger"
                    onClick={() => {
                        s.clearQueue()
                        append("clearQueue()", "warn")
                    }}
                >
                    Clear queue
                </Button>
            </ButtonRow>
            <ul className="wk-inline-list" aria-label="Queue destinations in the controller">
                {(["library:queue", "library:playlists", "agent:queue-director"] as const).map(
                    (route) => (
                        <li key={route} className="wk-inline-list__row">
                            <span className="wk-inline-list__main">
                                <span className="wk-inline-list__title">{route}</span>
                                <span className="wk-inline-list__sub">
                                    {ROUTE_STATUS[route].note}
                                </span>
                            </span>
                            <span className="wk-inline-list__actions">
                                <StatusBadge status={ROUTE_STATUS[route].status} />
                                <Button onClick={() => onOpenRoute(route)}>Open</Button>
                            </span>
                        </li>
                    )
                )}
            </ul>
            <QueueDrawer
                queue={s.queue}
                currentIndex={s.currentIndex}
                isPlaying={s.isPlaying}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onPlayTrack={s.playTrack}
                onReorder={(from, to) => {
                    s.moveQueueItem(from, to)
                    append(`drawer reorder ${from} → ${to}`)
                }}
                onRemove={(index) => {
                    s.removeFromQueue(index)
                    append(`drawer remove ${index}`, "warn")
                }}
            />
        </>
    )
}

export function QueueWorkspace() {
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    const { lines, append, clear } = useEventLog()
    return (
        <AudioSessionProvider initialQueue={noLuckTracks.slice(0, 4)}>
            <SessionEventFeed append={append} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">Transport</p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </div>
                        <div className="wk-stage-grid">
                            <Panel
                                title="Queue"
                                hint="Reorder or remove. The current track cannot be removed."
                            >
                                <QueueList append={append} />
                            </Panel>
                            <Panel
                                title="Inline Up Next"
                                hint="QueueSurface, for hosts that place their own Up Next."
                            >
                                <div className="wk-queue-surface">
                                    <QueueSurface maxItems={6} />
                                </div>
                            </Panel>
                        </div>
                        <Panel
                            title="Events"
                            actions={
                                <Button variant="ghost" onClick={clear}>
                                    Clear
                                </Button>
                            }
                        >
                            <EventLog lines={lines} />
                        </Panel>
                    </>
                }
                controls={
                    <>
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
                        <Panel
                            title="Add from the catalog"
                            hint="Play now, next (after the current track), or later (end of queue)."
                        >
                            <Catalog append={append} />
                        </Panel>
                        <Panel title="Queue controls">
                            <QueueControls append={append} onOpenRoute={setRoute} />
                        </Panel>
                        <Note tone="placeholder">
                            Queue › Director (AI Queue Director) and Vault › Playlist are real menu
                            leaves, but their screens only say “coming soon” today.
                        </Note>
                        <SessionController
                            route={route}
                            onClose={() => setRoute(null)}
                            theme={SEA_THEME}
                        />
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
