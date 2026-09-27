import { useMemo, useState } from "react"
import {
    AUTOMIX_FADE_MS,
    AudioSessionProvider,
    FullCardPlayer,
    createAutomixPlugin,
    ensureProTrackAnalysis,
    ensureTrackAnalysis,
    getTrackAnalysis,
    getTrackTrims,
    planTransition,
    useAudioSession,
    useAudioTime,
} from "../../../audio-player"
import type { AudioPlayerPlugin, Track, TrackAnalysis } from "../../../audio-player"
import { SEA_THEME, TRACK_SETS, isTrackSetId } from "../../data"
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

/* Automix: crossfades between queue tracks. Lite is the session's own switch
   (silence-trimmed equal-power fades); Pro is the plugin, which adds essentia
   beat/BPM analysis and falls back to Lite per pair when it cannot trust it. */

type Mode = "off" | "lite" | "pro"

const NO_PLUGINS: readonly AudioPlayerPlugin[] = []
const fmt = (n: number | undefined, digits = 2) => (n === undefined ? "–" : n.toFixed(digits))
const ms = (n: number | undefined) => (n === undefined ? "–" : `${(n / 1000).toFixed(1)} s`)

function AnalysisTable({ tracks }: { tracks: Track[] }) {
    useTicker(1000)
    return (
        <div className="wk-table-wrap">
            <table className="wk-table">
                <thead>
                    <tr>
                        <th scope="col">Track</th>
                        <th scope="col">BPM</th>
                        <th scope="col">Confidence</th>
                        <th scope="col">Energy</th>
                        <th scope="col">Beats</th>
                        <th scope="col">In / out</th>
                        <th scope="col">Trims</th>
                    </tr>
                </thead>
                <tbody>
                    {tracks.map((track) => {
                        const pro = getTrackAnalysis(track)
                        const trims = getTrackTrims(track)
                        return (
                            <tr key={track.id ?? track.title}>
                                <td>{track.title}</td>
                                <td>{pro ? fmt(pro.bpm, 1) : "pending"}</td>
                                <td>{fmt(pro?.confidence)}</td>
                                <td>{fmt(pro?.energy)}</td>
                                <td>{pro?.beats?.length ?? "–"}</td>
                                <td>
                                    {ms(pro?.transitionInMs)} / {ms(pro?.transitionOutMs)}
                                </td>
                                <td>
                                    {trims || pro
                                        ? `${ms(trims?.trimStartMs ?? pro?.trimStartMs)} · ${ms(trims?.trimEndMs ?? pro?.trimEndMs)}`
                                        : "pending"}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function PlannedTransition() {
    const s = useAudioSession()
    const { duration } = useAudioTime()
    useTicker(1000)
    const current = s.currentTrack
    const nextIndex = s.queue.length ? (s.currentIndex + 1) % s.queue.length : -1
    const next = nextIndex >= 0 ? s.queue[nextIndex] : null
    const a: TrackAnalysis | null =
        getTrackAnalysis(current) ?? (getTrackTrims(current) as TrackAnalysis | null)
    const b: TrackAnalysis | null =
        getTrackAnalysis(next) ?? (getTrackTrims(next) as TrackAnalysis | null)
    const plan = duration > 0 ? planTransition(a, b, duration * 1000, AUTOMIX_FADE_MS) : null
    return (
        <Readout
            rows={[
                ["Pair", current && next ? `${current.title} → ${next.title}` : "—"],
                [
                    "Mode",
                    plan
                        ? plan.usedPro
                            ? "Pro (beat-aware)"
                            : "Lite (silence trims)"
                        : "waiting for duration",
                ],
                ["Crossfade", plan ? ms(plan.fadeMs) : "—"],
                ["Fade starts in A at", plan ? ms(plan.fadeStartMsInA) : "—"],
                ["B enters from", plan ? ms(plan.deckStartMsInB) : "—"],
            ]}
        />
    )
}

function TransitionControls({
    append,
    tracks,
}: {
    append: (text: string, tone?: LogLine["tone"]) => void
    tracks: Track[]
}) {
    const s = useAudioSession()
    const { duration } = useAudioTime()
    return (
        <ButtonRow>
            <Button
                variant="primary"
                disabled={!duration}
                onClick={() => {
                    s.seek(Math.max(0, duration - 14))
                    if (!s.isPlaying) s.play()
                    append("Jumped to 14 s before the end — listen for the transition")
                }}
            >
                Jump near the end
            </Button>
            <Button
                onClick={() => {
                    append("Analyzing every track (silence trims + beat analysis)…")
                    for (const track of tracks) {
                        void ensureTrackAnalysis(track)
                        void ensureProTrackAnalysis(track).then((result) =>
                            append(
                                result
                                    ? `Analyzed “${track.title}”: ${fmt(result.bpm, 1)} BPM, confidence ${fmt(result.confidence)}`
                                    : `No analysis for “${track.title}” (source not decodable here)`,
                                result ? "ok" : "warn"
                            )
                        )
                    }
                }}
            >
                Analyze all now
            </Button>
        </ButtonRow>
    )
}

export function AutomixWorkspace() {
    const [modeParam, setMode] = useWorkspaceParam("mode", "pro")
    const mode: Mode = modeParam === "off" || modeParam === "lite" ? modeParam : "pro"
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "automix")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "automix"
    const tracks = TRACK_SETS[trackSetId].tracks
    const [transitioning, setTransitioning] = useState(false)
    const { lines, append, clear } = useEventLog()

    const plugins = useMemo(
        () =>
            mode === "pro"
                ? [
                      createAutomixPlugin({
                          // Registry naming so the face lists it under Plugins › Audio.
                          name: "registry-automix",
                          onTransitionChange: (active) => {
                              setTransitioning(active)
                              append(
                                  active ? "Crossfade started" : "Crossfade finished",
                                  active ? "warn" : "ok"
                              )
                          },
                      }),
                  ]
                : NO_PLUGINS,
        [mode, append]
    )

    return (
        <AudioSessionProvider
            key={`${mode}:${trackSetId}`}
            initialQueue={tracks}
            automix={mode === "lite"}
            repeatMode="all"
            plugins={plugins}
        >
            <SessionEventFeed append={append} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                {mode === "pro"
                                    ? "Automix Pro plugin"
                                    : mode === "lite"
                                      ? "Automix Lite"
                                      : "Automix off"}
                                {transitioning ? " · crossfading…" : ""}
                            </p>
                            <FullCardPlayer {...SEA_THEME} />
                        </div>
                        <Panel
                            title="Per-track analysis"
                            hint="Read from the analysis cache every second. Pro fills BPM and beats; Lite needs only the trims."
                        >
                            <AnalysisTable tracks={tracks} />
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
                        <Panel title="Automix mode" hint="Switching starts a fresh session.">
                            <Segmented
                                label="Mode"
                                value={mode}
                                options={[
                                    { value: "off", label: "Off" },
                                    { value: "lite", label: "Lite" },
                                    { value: "pro", label: "Pro plugin" },
                                ]}
                                onChange={setMode}
                            />
                            <SelectField
                                label="Tracks"
                                value={trackSetId}
                                options={[
                                    { value: "automix", label: TRACK_SETS.automix.label },
                                    { value: "no-luck", label: TRACK_SETS["no-luck"].label },
                                    { value: "narration", label: TRACK_SETS.narration.label },
                                ]}
                                onChange={setTrackSet}
                            />
                            {trackSetId !== "automix" && (
                                <Note tone="placeholder">
                                    This host does not allow cross-site decoding, so analysis cannot
                                    run and transitions fall back to plain timing.
                                </Note>
                            )}
                            <TransitionControls append={append} tracks={tracks} />
                        </Panel>
                        <Panel
                            title="Planned transition"
                            hint="planTransition() for the current pair, the same math the plugin runs."
                        >
                            <PlannedTransition />
                        </Panel>
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
                        <Note tone="placeholder">
                            With the Pro plugin active, the face's Plugins › Audio › Automix leaf
                            opens the controller's Automix settings screen, which still says “coming
                            soon”. Automix is configured in code today.
                        </Note>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
