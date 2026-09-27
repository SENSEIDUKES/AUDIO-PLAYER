import { useState } from "react"
import {
    ActivityLogPanel,
    ActivityLogProvider,
    AudioSessionProvider,
    FullCardPlayer,
    useActivityLog,
    useActivityLogRecording,
    useAudioSession,
} from "../../../audio-player"
import type { ActivityArea, ActivityStatus, WorkspaceRoute } from "../../../audio-player"
import { SEA_THEME, playlist } from "../../data"
import {
    Button,
    ButtonRow,
    Note,
    Panel,
    SelectField,
    SplitLayout,
    TextField,
} from "../../workshop/ui"
import { SessionController } from "../shared/session"

/* Diagnostics: the Activity Log records lifecycle events from anywhere in the
   player. The host mounts ActivityLogProvider and (optionally) the recording
   hook; the panel reads the same log here and inside the controller. */

const AREAS: readonly ActivityArea[] = [
    "player",
    "playback",
    "session",
    "plugin",
    "canvas",
    "agent",
    "system",
]
const STATUSES: readonly ActivityStatus[] = ["info", "success", "warn", "error"]

function Recorder() {
    const s = useAudioSession()
    useActivityLogRecording({
        engine: s,
        currentTrack: s.currentTrack,
        repeatMode: s.repeatMode,
        shuffle: s.shuffle,
    })
    return null
}

function CustomEventForm() {
    const log = useActivityLog()
    const [area, setArea] = useState<ActivityArea>("system")
    const [status, setStatus] = useState<ActivityStatus>("info")
    const [message, setMessage] = useState("Workshop note")
    return (
        <>
            <SelectField
                label="Area"
                value={area}
                options={AREAS.map((value) => ({ value, label: value }))}
                onChange={setArea}
            />
            <SelectField
                label="Status"
                value={status}
                options={STATUSES.map((value) => ({ value, label: value }))}
                onChange={setStatus}
            />
            <TextField label="Message" value={message} onChange={setMessage} />
            <Button
                variant="primary"
                onClick={() =>
                    log.record({
                        area,
                        status,
                        message: message || "(empty)",
                        details: { from: "workshop" },
                    })
                }
            >
                Record event
            </Button>
            <p className="wk-panel__hint">
                {log.count} of {log.maxEntries} entries kept.
            </p>
        </>
    )
}

function Triggers({ onOpen }: { onOpen: (route: WorkspaceRoute) => void }) {
    const s = useAudioSession()
    const brokenIndex = s.queue.findIndex((track) => track.title === "Signal Lost")
    return (
        <ButtonRow>
            <Button onClick={s.toggle}>{s.isPlaying ? "Pause" : "Play"}</Button>
            <Button onClick={s.next}>Next track</Button>
            <Button onClick={s.toggleShuffle}>Toggle shuffle</Button>
            <Button onClick={s.cycleRepeat}>Cycle repeat</Button>
            <Button
                variant="danger"
                disabled={brokenIndex < 0}
                onClick={() => s.playTrack(brokenIndex)}
            >
                Play the broken track
            </Button>
            <Button onClick={() => onOpen("diagnostics:activity-log")}>Open in controller</Button>
        </ButtonRow>
    )
}

export function ActivityLogWorkspace() {
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    return (
        <ActivityLogProvider config={{ maxEntries: 200 }}>
            <AudioSessionProvider initialQueue={playlist}>
                <Recorder />
                <SplitLayout
                    stage={
                        <>
                            <div className="wk-stage-card">
                                <FullCardPlayer {...SEA_THEME} />
                            </div>
                            <Panel
                                title="Make something happen"
                                hint="Each of these lands in the log automatically."
                            >
                                <Triggers onOpen={setRoute} />
                            </Panel>
                            <div className="wk-stage-card wk-activity">
                                <ActivityLogPanel />
                            </div>
                            <SessionController
                                route={route}
                                onClose={() => setRoute(null)}
                                theme={SEA_THEME}
                            />
                        </>
                    }
                    controls={
                        <>
                            <Panel title="Record your own">
                                <CustomEventForm />
                            </Panel>
                            <Note>
                                The log is bounded (oldest entries drop first) and never blocks
                                playback. Use the panel's filters, copy, and export controls.
                            </Note>
                        </>
                    }
                />
            </AudioSessionProvider>
        </ActivityLogProvider>
    )
}
