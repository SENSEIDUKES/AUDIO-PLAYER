import { useState } from "react"
import {
    AudioSessionProvider,
    FullCardPlayer,
    MiniSidebarPlayer,
    StickyBottomPlayer,
    VaultRowPlayer,
    deserializeSession,
    serializeSession,
    useAudioSession,
    useAudioTime,
} from "../../../audio-player"
import type { AudioSessionProviderProps, SerializedSession } from "../../../audio-player"
import { NO_LUCK_ART, SEA_THEME, TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    Readout,
    Segmented,
    SelectField,
    SplitLayout,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { SessionEventFeed, SessionReadout, useTicker } from "../shared/session"

/* The shared session: one <audio> element and one queue behind every face on
   this page. Play, seek, or skip in any face and the others follow, because
   they all read the same AudioSessionProvider. */

type PreloadStrategy = "none" | "next" | "aggressive"

interface RestorePoint {
    snapshot: SerializedSession
    token: number
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function EngineDetails() {
    const s = useAudioSession()
    return (
        <Readout
            rows={[
                [
                    "Can go back / forward",
                    `${s.canPrevious ? "yes" : "no"} / ${s.canNext ? "yes" : "no"}`,
                ],
                [
                    "Source",
                    s.sourceCount
                        ? `candidate ${s.currentSourceIndex + 1} of ${s.sourceCount}`
                        : "—",
                ],
                [
                    "Active URL",
                    s.currentSrc ? (s.currentSrc.split("/").pop() ?? s.currentSrc) : "—",
                ],
                ["Backend", s.getBackendInfo().active],
                ["Plugins on session", s.pluginNames.length ? s.pluginNames.join(", ") : "none"],
            ]}
        />
    )
}

function SaveRestore({
    onRestore,
    append,
}: {
    onRestore: (snapshot: SerializedSession) => void
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const s = useAudioSession()
    const { currentTime } = useAudioTime()
    const [saved, setSaved] = useState<string>("")

    const save = () => {
        // The session object's own clock is throttled for render performance;
        // the time context carries the live position.
        const snapshot = serializeSession({ ...s, currentTime })
        setSaved(JSON.stringify(snapshot, null, 2))
        append(
            `Saved session at track ${snapshot.currentIndex + 1}, ${Math.round(snapshot.currentTime)} s`,
            "ok"
        )
    }

    const restore = () => {
        try {
            const snapshot = deserializeSession(JSON.parse(saved))
            if (!snapshot) {
                append("Restore refused: the saved data did not validate", "error")
                return
            }
            onRestore(snapshot)
            append(
                `Restored: track ${snapshot.currentIndex + 1} at ${Math.round(snapshot.currentTime)} s`,
                "ok"
            )
        } catch {
            append("Restore refused: the saved text is not valid JSON", "error")
        }
    }

    return (
        <>
            <ButtonRow>
                <Button variant="primary" onClick={save}>
                    Save session
                </Button>
                <Button onClick={restore} disabled={!saved}>
                    Restore saved
                </Button>
            </ButtonRow>
            <textarea
                className="wk-textarea"
                aria-label="Saved session JSON (editable)"
                value={saved}
                placeholder="Save the session to see its JSON here. You can edit it before restoring."
                onChange={(event) => setSaved(event.target.value)}
            />
        </>
    )
}

function CachePanel({ append }: { append: (text: string, tone?: LogLine["tone"]) => void }) {
    const s = useAudioSession()
    useTicker(1000)
    const stats = s.getCacheStats()
    return (
        <>
            <Readout
                rows={[
                    ["Decoded buffers", String(stats.decodedBufferCount)],
                    ["Decoded memory", formatBytes(stats.decodedBufferBytes)],
                    ["Preload elements", String(stats.preloadElementCount)],
                ]}
            />
            <ButtonRow>
                <Button
                    onClick={() => {
                        s.pruneAudioCache()
                        append("Pruned decoded buffers not in the queue")
                    }}
                >
                    Prune cache
                </Button>
                {[2, 4, 8].map((limit) => (
                    <Button
                        key={limit}
                        onClick={() => {
                            s.setCacheLimit(limit)
                            append(`Cache limit set to ${limit} decoded buffers`)
                        }}
                    >
                        Limit {limit}
                    </Button>
                ))}
            </ButtonRow>
            <Note>Decoded buffers only fill on the Web Audio backend; HTML5 streams instead.</Note>
        </>
    )
}

export function PlaybackSessionWorkspace() {
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "no-luck")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "no-luck"
    const [preload, setPreload] = useState<PreloadStrategy>("next")
    const [restorePoint, setRestorePoint] = useState<RestorePoint | null>(null)
    const { lines, append, clear } = useEventLog()

    const providerProps: Omit<AudioSessionProviderProps, "children"> = restorePoint
        ? {
              initialQueue: restorePoint.snapshot.queue,
              initialIndex: restorePoint.snapshot.currentIndex,
              initialCurrentTime: restorePoint.snapshot.currentTime,
              shuffle: restorePoint.snapshot.shuffle,
              repeatMode: restorePoint.snapshot.repeatMode,
          }
        : { initialQueue: TRACK_SETS[trackSetId].tracks }

    const sessionKey = `${trackSetId}:${preload}:${restorePoint?.token ?? 0}`
    const queue = providerProps.initialQueue ?? []

    return (
        <AudioSessionProvider
            key={sessionKey}
            {...providerProps}
            preloadConfig={{ strategy: preload }}
        >
            <SessionEventFeed append={append} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">FullCardPlayer</p>
                            <FullCardPlayer {...SEA_THEME} />
                        </div>
                        <div className="wk-stage-grid">
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">MiniSidebarPlayer</p>
                                <MiniSidebarPlayer art={NO_LUCK_ART} {...SEA_THEME} />
                            </div>
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">VaultRowPlayer rows</p>
                                {queue.slice(0, 3).map((track, index) => (
                                    <VaultRowPlayer
                                        key={track.id ?? track.title}
                                        track={track}
                                        number={index + 1}
                                        {...SEA_THEME}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">StickyBottomPlayer (inline)</p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </div>
                        <Panel
                            title="Events"
                            hint="Everything the session reports through subscribe()."
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
                        <Panel title="Live state">
                            <SessionReadout />
                            <EngineDetails />
                        </Panel>
                        <Panel title="Session setup" hint="Changing these starts a fresh session.">
                            <SelectField
                                label="Tracks"
                                value={trackSetId}
                                options={TRACK_SET_OPTIONS}
                                onChange={(value) => {
                                    setRestorePoint(null)
                                    setTrackSet(value)
                                }}
                            />
                            <Segmented
                                label="Preload strategy"
                                value={preload}
                                options={[
                                    { value: "none", label: "None" },
                                    { value: "next", label: "Next" },
                                    { value: "aggressive", label: "Aggressive" },
                                ]}
                                onChange={setPreload}
                            />
                        </Panel>
                        <Panel
                            title="Save & restore"
                            hint="serializeSession() captures the queue, position, shuffle, and repeat; restoring starts a new session from it."
                        >
                            <SaveRestore
                                append={append}
                                onRestore={(snapshot) =>
                                    setRestorePoint((prev) => ({
                                        snapshot,
                                        token: (prev?.token ?? 0) + 1,
                                    }))
                                }
                            />
                        </Panel>
                        <Panel title="Buffer cache">
                            <CachePanel append={append} />
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
