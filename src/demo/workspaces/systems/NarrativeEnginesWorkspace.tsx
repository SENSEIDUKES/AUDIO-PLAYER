import { useCallback, useEffect, useRef, useState } from "react"
import { createOneShotEngine, createSceneMixEngine } from "../../../audio-player"
import type {
    OneShotEngine,
    SceneMixEngine,
    SceneMixStatusSnapshot,
    Track,
} from "../../../audio-player"
import { SAMPLE, narrationTracks, noLuckTracks } from "../../data"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    RangeField,
    Readout,
    Segmented,
    SplitLayout,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"

/* The two headless narrative engines. Neither renders anything or uses the
   shared session: SceneMix owns two detached decks for scene scores, and the
   one-shot engine pools detached elements for cues and FX. Both are created on
   first use and disposed when this workspace closes, so nothing keeps playing. */

const SCENES: readonly Track[] = [
    {
        id: "scene-calm",
        title: "Calm · Angel Numbers",
        artist: "No Luck",
        audioFile: noLuckTracks[0].audioFile,
    },
    {
        id: "scene-tension",
        title: "Tension · Forces",
        artist: "No Luck",
        audioFile: noLuckTracks[1].audioFile,
    },
    {
        id: "scene-battle",
        title: "Battle · Heartbreak Hotel",
        artist: "No Luck",
        audioFile: noLuckTracks[2].audioFile,
    },
    { id: "scene-sample", title: "Sample bed (decodable)", artist: "Sample", audioFile: SAMPLE },
]

const pct = (value: number) => `${Math.round(value * 100)}%`

function useSceneMix(
    append: (text: string, tone?: LogLine["tone"]) => void,
    analysis: "automatic" | "off"
) {
    const engineRef = useRef<SceneMixEngine | null>(null)
    const unsubscribeRef = useRef<(() => void) | null>(null)
    const [status, setStatus] = useState<SceneMixStatusSnapshot | null>(null)

    const release = useCallback(() => {
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
        engineRef.current?.dispose()
        engineRef.current = null
    }, [])

    // A new analysis policy means a new engine; the old one is disposed.
    useEffect(() => {
        release()
        setStatus(null)
    }, [analysis, release])
    useEffect(() => release, [release])

    const getEngine = useCallback(() => {
        if (!engineRef.current) {
            const engine = createSceneMixEngine({
                analysisPolicy: analysis,
                onFallbackSource: (event) =>
                    append(`scene fallback → candidate ${event.sourceIndex + 1}`, "warn"),
            })
            unsubscribeRef.current = engine.subscribeStatus((snapshot) => {
                setStatus(snapshot)
                append(
                    `scene status: ${snapshot.state}${snapshot.failure ? ` (${snapshot.failure.message})` : ""}`,
                    snapshot.state === "failed"
                        ? "error"
                        : snapshot.state === "playing"
                          ? "ok"
                          : "info"
                )
            })
            engineRef.current = engine
        }
        return engineRef.current
    }, [analysis, append])

    return { getEngine, engineRef, status }
}

function useOneShots(maxConcurrent: number) {
    const engineRef = useRef<OneShotEngine | null>(null)
    useEffect(() => {
        return () => {
            engineRef.current?.dispose()
            engineRef.current = null
        }
    }, [maxConcurrent])
    const getEngine = useCallback(() => {
        if (!engineRef.current) engineRef.current = createOneShotEngine({ maxConcurrent })
        return engineRef.current
    }, [maxConcurrent])
    return { getEngine, engineRef }
}

export function NarrativeEnginesWorkspace() {
    const { lines, append, clear } = useEventLog(60)
    const [analysis, setAnalysis] = useState<"automatic" | "off">("automatic")
    const [fadeMs, setFadeMs] = useState(2000)
    const [level, setLevel] = useState(0.8)
    const [muted, setMuted] = useState(false)
    const scene = useSceneMix(append, analysis)

    const [maxConcurrent, setMaxConcurrent] = useState(4)
    const [shotLevel, setShotLevel] = useState(1)
    const [counts, setCounts] = useState({ fired: 0, refused: 0 })
    const shots = useOneShots(maxConcurrent)

    const crossfade = (track: Track) => {
        const engine = scene.getEngine()
        engine.setLevel(level)
        engine.setMuted(muted)
        engine.crossfadeTo(track, { fadeMs })
        append(`crossfadeTo(“${track.title}”, ${fadeMs} ms)`)
    }

    const fire = (track: Track) => {
        const engine = shots.getEngine()
        engine.setLevel(shotLevel)
        const element = engine.playOneShot(track.audioFile ?? "")
        if (element) {
            setCounts((c) => ({ ...c, fired: c.fired + 1 }))
            append(`one-shot “${track.title}”`, "ok")
        } else {
            setCounts((c) => ({ ...c, refused: c.refused + 1 }))
            append(`one-shot refused: ${maxConcurrent} already playing`, "warn")
        }
    }

    const status = scene.status

    return (
        <SplitLayout
            stage={
                <>
                    <Panel
                        title="Scene Mix · scene scores"
                        hint="Switch the score mid-track, like a reader moving between scenes. The new deck fades in while the old one fades out."
                    >
                        <ul className="wk-inline-list">
                            {SCENES.map((track) => {
                                const audible =
                                    status?.audibleTrackKey?.includes(track.id ?? "") ?? false
                                return (
                                    <li
                                        key={track.id}
                                        className={`wk-inline-list__row${audible ? " wk-inline-list__row--active" : ""}`}
                                    >
                                        <span className="wk-inline-list__main">
                                            <span className="wk-inline-list__title">
                                                {track.title}
                                            </span>
                                            <span className="wk-inline-list__sub">
                                                {audible ? "Audible now" : track.artist}
                                            </span>
                                        </span>
                                        <span className="wk-inline-list__actions">
                                            <Button onClick={() => crossfade(track)}>
                                                Crossfade
                                            </Button>
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                        <ButtonRow>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    scene.engineRef.current?.stop(fadeMs)
                                    append(`stop(${fadeMs} ms)`)
                                }}
                            >
                                Stop scene score
                            </Button>
                        </ButtonRow>
                        <Readout
                            label="Scene Mix status"
                            rows={[
                                ["State", status?.state ?? "idle (created on first use)"],
                                ["Requested", status?.requestedTrackKey ?? "—"],
                                ["Audible", status?.audibleTrackKey ?? "—"],
                                [
                                    "Failure",
                                    status?.failure
                                        ? `${status.failure.reason}: ${status.failure.message}`
                                        : "none",
                                ],
                            ]}
                        />
                    </Panel>
                    <Panel
                        title="One-shots · cue lines and FX"
                        hint="Each pad plays from a pooled element. Overlaps are allowed up to the concurrency cap."
                    >
                        <div className="wk-pads">
                            {[
                                ...narrationTracks,
                                {
                                    id: "shot-sample",
                                    title: "Sample (long)",
                                    artist: "Sample",
                                    audioFile: SAMPLE,
                                },
                            ].map((track) => (
                                <button
                                    key={track.id}
                                    type="button"
                                    className="wk-pad"
                                    onClick={() => fire(track)}
                                >
                                    <span className="wk-pad__title">{track.title}</span>
                                    <span className="wk-pad__sub">{track.artist}</span>
                                </button>
                            ))}
                        </div>
                        <Readout
                            rows={[
                                ["Fired", String(counts.fired)],
                                ["Refused by the cap", String(counts.refused)],
                            ]}
                        />
                    </Panel>
                    <Panel
                        title="Events"
                        actions={
                            <Button variant="ghost" onClick={clear}>
                                Clear
                            </Button>
                        }
                    >
                        <EventLog lines={lines} empty="Crossfade a scene or fire a one-shot." />
                    </Panel>
                </>
            }
            controls={
                <>
                    <Panel title="Scene Mix">
                        <RangeField
                            label="Crossfade length"
                            value={fadeMs}
                            min={200}
                            max={8000}
                            step={100}
                            unit=" ms"
                            onChange={setFadeMs}
                        />
                        <RangeField
                            label="Score level"
                            value={level}
                            min={0}
                            max={1}
                            step={0.05}
                            format={pct}
                            onChange={(value) => {
                                setLevel(value)
                                scene.engineRef.current?.setLevel(value)
                            }}
                        />
                        <Switch
                            label="Mute score"
                            checked={muted}
                            onChange={(value) => {
                                setMuted(value)
                                scene.engineRef.current?.setMuted(value)
                            }}
                        />
                        <Segmented
                            label="Silence-trim analysis"
                            value={analysis}
                            options={[
                                { value: "automatic", label: "Automatic" },
                                { value: "off", label: "Off" },
                            ]}
                            onChange={setAnalysis}
                        />
                        <Note>
                            Analysis only succeeds for audio the browser may decode across sites
                            (the sample bed). No Luck scenes still play; they just start untrimmed.
                        </Note>
                    </Panel>
                    <Panel title="One-shots">
                        <RangeField
                            label="One-shot level"
                            value={shotLevel}
                            min={0}
                            max={1}
                            step={0.05}
                            format={pct}
                            onChange={(value) => {
                                setShotLevel(value)
                                shots.engineRef.current?.setLevel(value)
                            }}
                        />
                        <RangeField
                            label="Max playing at once"
                            value={maxConcurrent}
                            min={1}
                            max={8}
                            onChange={setMaxConcurrent}
                        />
                    </Panel>
                    <Note>
                        Both engines live only while this workspace is open. Leaving disposes them,
                        which stops every deck and one-shot.
                    </Note>
                </>
            }
        />
    )
}
