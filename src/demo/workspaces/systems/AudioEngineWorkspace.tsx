import { useEffect, useRef, useState } from "react"
import {
    AudioSessionProvider,
    StickyBottomPlayer,
    createAudioBackend,
    useAudioSession,
} from "../../../audio-player"
import type { AudioBackend, AudioBackendKind } from "../../../audio-player"
import { SAMPLE, SEA_THEME, TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    RangeField,
    Readout,
    Segmented,
    SelectField,
    SplitLayout,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { SessionEventFeed, SessionReadout, useTicker } from "../shared/session"

/* The engine underneath every face (useAudioPlayer) on either backend. The
   session exposes the whole engine API, so this workspace drives it directly:
   speed, fades, volume, retry, unload, and the backend's own report. */

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 4] as const

function EngineControls({ append }: { append: (text: string, tone?: LogLine["tone"]) => void }) {
    const s = useAudioSession()
    useTicker(1000)
    const info = s.getBackendInfo()
    const decoded = s.getDecodedData()
    return (
        <>
            <Segmented
                label="Playback speed"
                value={String(s.playbackRate)}
                options={RATES.map((rate) => ({ value: String(rate), label: `${rate}×` }))}
                onChange={(value) => {
                    s.setPlaybackRate(Number(value))
                    append(`setPlaybackRate(${value})`)
                }}
            />
            <RangeField
                label="Volume"
                value={s.volume}
                min={0}
                max={1}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={s.setVolume}
            />
            {s.volumeUnsupported && (
                <Note tone="warn">
                    This browser ignores programmatic volume (e.g. iOS Safari). Mute still works.
                </Note>
            )}
            <ButtonRow>
                <Button onClick={s.toggleMute} pressed={s.isMuted}>
                    {s.isMuted ? "Unmute" : "Mute"}
                </Button>
                <Button
                    onClick={() => {
                        s.fade(0, 2000)
                        append("fade(0, 2000 ms)")
                    }}
                >
                    Fade out 2 s
                </Button>
                <Button
                    onClick={() => {
                        s.fade(1, 2000)
                        append("fade(1, 2000 ms)")
                    }}
                >
                    Fade in 2 s
                </Button>
                <Button
                    onClick={() => {
                        s.retry()
                        append("retry()")
                    }}
                >
                    Retry
                </Button>
                <Button
                    variant="danger"
                    onClick={() => {
                        s.unload()
                        append("unload() — source cleared", "warn")
                    }}
                >
                    Unload
                </Button>
            </ButtonRow>
            <Readout
                label="Backend"
                rows={[
                    ["Requested → active", `${info.requested} → ${info.active}`],
                    [
                        "Fell back",
                        info.didFallback ? `yes (${info.fallbackReason ?? "unknown"})` : "no",
                    ],
                    [
                        "Decoded audio",
                        decoded
                            ? `${decoded.duration.toFixed(1)} s · ${decoded.numberOfChannels} ch · ${decoded.sampleRate} Hz`
                            : "none (streams progressively)",
                    ],
                ]}
            />
            <pre className="wk-pre" aria-label="getBackendInfo() output">
                {JSON.stringify(info, null, 2)}
            </pre>
        </>
    )
}

/* Spatial audio lives on the Web Audio backend but no player exposes it yet, so
   this panel drives a raw backend from createAudioBackend(). It stops the
   session while it plays (and vice versa) and is destroyed on unmount. */
function SpatialPanel({ append }: { append: (text: string, tone?: LogLine["tone"]) => void }) {
    const s = useAudioSession()
    const backendRef = useRef<AudioBackend | null>(null)
    const [playing, setPlaying] = useState(false)
    const [stereo, setStereo] = useState(0)
    const [x, setX] = useState(0)
    const [z, setZ] = useState(-1)
    const [lite, setLite] = useState(false)
    const { subscribe, pause } = s

    useEffect(
        () => () => {
            backendRef.current?.destroy()
            backendRef.current = null
        },
        []
    )

    // One engine at a time: the session starting stops the raw backend.
    useEffect(
        () =>
            subscribe("play", () => {
                if (backendRef.current && !backendRef.current.isPaused()) {
                    backendRef.current.pause()
                    setPlaying(false)
                }
            }),
        [subscribe]
    )

    const getBackend = () => {
        if (!backendRef.current) {
            const backend = createAudioBackend("webaudio", { audioRef: { current: null } })
            backend.setSource(SAMPLE)
            backend.setLoop(true)
            backend.load()
            backendRef.current = backend
        }
        return backendRef.current
    }

    const start = () => {
        const backend = getBackend()
        if (!backend.supportsSpatial()) {
            append("Web Audio is unavailable here, so spatial panning cannot run", "error")
            return
        }
        pause()
        backend.setLiteMode(lite)
        backend.setStereo(stereo)
        backend.setPos(x, 0, z)
        backend
            .play()
            .then(() => {
                setPlaying(true)
                append("Raw Web Audio backend playing the sample on a loop", "ok")
            })
            .catch((error: unknown) => append(`Spatial play failed: ${String(error)}`, "error"))
    }

    const stop = () => {
        backendRef.current?.pause()
        setPlaying(false)
    }

    const apply = (next: { stereo?: number; x?: number; z?: number; lite?: boolean }) => {
        const backend = backendRef.current
        if (!backend) return
        if (next.lite !== undefined) backend.setLiteMode(next.lite)
        if (next.stereo !== undefined) backend.setStereo(next.stereo)
        if (next.x !== undefined || next.z !== undefined)
            backend.setPos(next.x ?? x, 0, next.z ?? z)
    }

    return (
        <>
            <ButtonRow>
                <Button variant="primary" onClick={start} disabled={playing}>
                    Play spatial sample
                </Button>
                <Button onClick={stop} disabled={!playing}>
                    Stop
                </Button>
            </ButtonRow>
            <RangeField
                label="Stereo pan"
                value={stereo}
                min={-1}
                max={1}
                step={0.05}
                format={(v) =>
                    v === 0
                        ? "center"
                        : v < 0
                          ? `L ${Math.round(-v * 100)}`
                          : `R ${Math.round(v * 100)}`
                }
                onChange={(v) => {
                    setStereo(v)
                    apply({ stereo: v })
                }}
            />
            <RangeField
                label="Position X (left ↔ right)"
                value={x}
                min={-10}
                max={10}
                step={0.5}
                onChange={(v) => {
                    setX(v)
                    apply({ x: v })
                }}
            />
            <RangeField
                label="Position Z (front ↔ back)"
                value={z}
                min={-10}
                max={10}
                step={0.5}
                onChange={(v) => {
                    setZ(v)
                    apply({ z: v })
                }}
            />
            <Switch
                label="Lite mode"
                hint="Equal-power panning instead of HRTF (cheaper on phones)"
                checked={lite}
                onChange={(v) => {
                    setLite(v)
                    apply({ lite: v })
                }}
            />
            <Note tone="placeholder">
                Spatial audio is implemented on the Web Audio backend only. No player face or
                session exposes it yet, so this panel talks to the backend directly.
            </Note>
        </>
    )
}

export function AudioEngineWorkspace() {
    const [backend, setBackend] = useWorkspaceParam("backend", "html5")
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "sample")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "sample"
    const backendKind: AudioBackendKind = backend === "webaudio" ? "webaudio" : "html5"
    const { lines, append, clear } = useEventLog()

    return (
        <AudioSessionProvider
            key={`${backendKind}:${trackSetId}`}
            initialQueue={TRACK_SETS[trackSetId].tracks}
            audioBackend={backendKind}
        >
            <SessionEventFeed append={append} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                Transport · {backendKind === "webaudio" ? "Web Audio" : "HTML5"}{" "}
                                backend
                            </p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </div>
                        <Note>
                            HTML5 streams progressively. Web Audio downloads and decodes the whole
                            file first for sample-accurate timing and reliable volume (including iOS
                            Safari), so it needs audio the browser may decode across sites. The
                            broken track exercises each backend's error path.
                        </Note>
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
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
                        <Panel
                            title="Backend"
                            hint="Fixed when an engine mounts; switching starts a fresh session."
                        >
                            <Segmented
                                label="Playback backend"
                                value={backendKind}
                                options={[
                                    { value: "html5", label: "HTML5 audio" },
                                    { value: "webaudio", label: "Web Audio" },
                                ]}
                                onChange={setBackend}
                            />
                            <SelectField
                                label="Tracks"
                                value={trackSetId}
                                options={TRACK_SET_OPTIONS}
                                onChange={setTrackSet}
                            />
                            <Note>{TRACK_SETS[trackSetId].note}</Note>
                        </Panel>
                        <Panel title="Engine">
                            <EngineControls append={append} />
                        </Panel>
                        <Panel title="Spatial (raw Web Audio backend)">
                            <SpatialPanel append={append} />
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
