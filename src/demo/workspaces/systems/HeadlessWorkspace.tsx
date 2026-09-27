import { useState } from "react"
import {
    AudioSessionProvider,
    formatTime,
    useAudioSession,
    useAudioTime,
    useMediaSessionObserver,
    useSAPPropGetters,
} from "../../../audio-player"
import { NO_LUCK_COVER, noLuckTracks } from "../../data"
import {
    Button,
    EventLog,
    Note,
    Panel,
    Readout,
    SplitLayout,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { SessionReadout, useTicker } from "../shared/session"

/* Headless: no face at all. A host builds its own transport from prop getters
   over the same session (no second engine), and wires the OS media controls
   with one hook. */

function OwnTransport({
    intercept,
    append,
}: {
    intercept: boolean
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const s = useAudioSession()
    const { currentTime, duration } = useAudioTime()
    const {
        getPlayButtonProps,
        getMuteButtonProps,
        getPreviousButtonProps,
        getNextButtonProps,
        getSeekBackwardButtonProps,
        getSeekForwardButtonProps,
        getProgressBarProps,
    } = useSAPPropGetters(s)
    const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

    const playProps = getPlayButtonProps({
        className: "wk-btn wk-btn--primary",
        onClick: (event) => {
            append("Your onClick ran first")
            if (intercept) {
                event.preventDefault()
                append("…and cancelled SAP's own play/pause", "warn")
            }
        },
    })
    const describedProps = Object.fromEntries(
        Object.entries(playProps).filter(([, value]) => typeof value !== "function")
    )

    return (
        <>
            <div className="wk-btn-row" role="group" aria-label="Headless transport">
                <button {...getPreviousButtonProps({ className: "wk-btn" })}>Prev</button>
                <button {...getSeekBackwardButtonProps({ className: "wk-btn" })}>−10 s</button>
                <button {...playProps}>{s.isPlaying ? "Pause" : "Play"}</button>
                <button {...getSeekForwardButtonProps({ className: "wk-btn" })}>+10 s</button>
                <button {...getNextButtonProps({ className: "wk-btn" })}>Next</button>
                <button {...getMuteButtonProps({ className: "wk-btn" })}>
                    {s.isMuted ? "Unmute" : "Mute"}
                </button>
            </div>
            <div {...getProgressBarProps({ className: "wk-headless-progress" })}>
                <span className="wk-headless-progress__fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="wk-panel__hint">
                {formatTime(currentTime)} / {formatTime(duration)} —{" "}
                {s.currentTrack?.title ?? "(no track)"}. The bar is focusable: ←/→ seek.
            </p>
            <Panel
                title="What the play getter returns"
                hint="Accessible names and state come from the getter; you only add styling and your own handlers."
            >
                <pre className="wk-pre">{JSON.stringify(describedProps, null, 2)}</pre>
            </Panel>
        </>
    )
}

const NO_LUCK_ARTWORK: MediaImage[] = [{ src: NO_LUCK_COVER, sizes: "512x512", type: "image/jpeg" }]

function MediaSessionBridge() {
    const s = useAudioSession()
    const track = s.currentTrack
    useMediaSessionObserver(s, {
        title: track?.title ?? "SEIHouse",
        artist: track?.artist,
        album: "No Luck",
        artwork: NO_LUCK_ARTWORK,
        onNext: s.next,
        onPrevious: s.previous,
        sourceKey: track?.id ?? track?.title,
    })
    return null
}

function MediaSessionReadout({ enabled }: { enabled: boolean }) {
    useTicker(1000)
    const supported = typeof navigator !== "undefined" && "mediaSession" in navigator
    const metadata = supported ? navigator.mediaSession.metadata : null
    return (
        <Readout
            rows={[
                ["Browser support", supported ? "Yes" : "No"],
                ["Integration", enabled ? "On" : "Off"],
                ["Lock-screen title", metadata?.title || "—"],
                ["Lock-screen artist", metadata?.artist || "—"],
                ["Playback state", supported ? navigator.mediaSession.playbackState : "—"],
            ]}
        />
    )
}

export function HeadlessWorkspace() {
    const [intercept, setIntercept] = useState(false)
    const [mediaSession, setMediaSession] = useState(true)
    const { lines, append, clear } = useEventLog()
    return (
        <AudioSessionProvider initialQueue={noLuckTracks}>
            {mediaSession && <MediaSessionBridge />}
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">Your own transport</p>
                            <OwnTransport intercept={intercept} append={append} />
                        </div>
                        <Panel
                            title="Handler log"
                            actions={
                                <Button variant="ghost" onClick={clear}>
                                    Clear
                                </Button>
                            }
                        >
                            <EventLog
                                lines={lines}
                                empty="Press Play to see your handler run first."
                            />
                        </Panel>
                    </>
                }
                controls={
                    <>
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
                        <Panel title="Handler composition">
                            <Switch
                                label="Cancel SAP's play from my handler"
                                hint="Calls event.preventDefault() in your onClick"
                                checked={intercept}
                                onChange={setIntercept}
                            />
                        </Panel>
                        <Panel
                            title="Media Session (lock screen)"
                            hint="useMediaSessionObserver: title, artwork, and OS play / pause / next / previous / seek."
                        >
                            <Switch
                                label="Lock-screen integration"
                                checked={mediaSession}
                                onChange={setMediaSession}
                            />
                            <MediaSessionReadout enabled={mediaSession} />
                            <Note>
                                On a phone, lock the screen while playing to see the title and use
                                the OS controls.
                            </Note>
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
