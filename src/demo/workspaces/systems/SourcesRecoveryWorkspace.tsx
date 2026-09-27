import { useMemo, useState } from "react"
import {
    AudioSessionProvider,
    FullCardPlayer,
    checkCodecSupport,
    useAudioSession,
    validateTrackSource,
} from "../../../audio-player"
import type {
    SourceValidationResult,
    Track,
    TrackErrorPolicy,
    TrackSourceResolver,
} from "../../../audio-player"
import { BROKEN, SAMPLE, SEA_THEME, narrationTracks, noLuckTracks } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Button,
    EventLog,
    Note,
    Panel,
    Readout,
    Segmented,
    SplitLayout,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { SessionEventFeed, SessionReadout } from "../shared/session"

/* How the engine survives bad sources. The queue below walks through each
   recovery path in order; the controls switch the session-wide policy and add
   an async resolver in front of every URL. */

const ALSO_MISSING = "https://example.com/also-missing.mp3"

const RECOVERY_QUEUE: Track[] = [
    {
        id: "recovery-fallback",
        title: "Fallback rescue",
        artist: "Primary is broken → fallback plays",
        audioFile: BROKEN,
        fallbackSources: [SAMPLE],
    },
    {
        id: "recovery-typed",
        title: "Typed source list",
        artist: "sources[]: broken first, then a working MP3",
        sources: [
            { url: BROKEN, type: "audio/mpeg" },
            { url: SAMPLE, type: "audio/mpeg" },
        ],
    },
    {
        id: "recovery-dead-end",
        title: "Dead end",
        artist: "Every source fails",
        audioFile: BROKEN,
        fallbackSources: [ALSO_MISSING],
    },
    {
        id: "recovery-after",
        title: "After the dead end",
        artist: "Reached only by the skip policy",
        audioFile: SAMPLE,
    },
]

const CHECK_URLS: readonly { label: string; url: string }[] = [
    { label: "Sample MP3 (framerusercontent)", url: SAMPLE },
    { label: "No Luck WAV (audio.seihouse.org)", url: noLuckTracks[0].audioFile ?? "" },
    { label: "SEN narration MP3 (lines.seihouse.org)", url: narrationTracks[0].audioFile ?? "" },
    { label: "Broken URL (example.com)", url: BROKEN },
]

const CODECS: readonly { label: string; type: string }[] = [
    { label: "MP3", type: "audio/mpeg" },
    { label: "WAV", type: "audio/wav" },
    { label: "AAC / M4A", type: "audio/mp4" },
    { label: "Ogg Vorbis", type: "audio/ogg" },
    { label: "Opus (WebM)", type: 'audio/webm; codecs="opus"' },
    { label: "FLAC", type: "audio/flac" },
]

function JumpTo() {
    const s = useAudioSession()
    return (
        <div className="wk-btn-row" role="group" aria-label="Jump to a recovery case">
            {s.queue.map((track, index) => (
                <Button
                    key={track.id ?? track.title}
                    pressed={index === s.currentIndex}
                    onClick={() => s.playTrack(index)}
                >
                    {index + 1}. {track.title}
                </Button>
            ))}
        </div>
    )
}

function describeCheck(result: SourceValidationResult): string {
    if (!result.accessible) return `Unreachable${result.error ? ` (${result.error})` : ""}`
    const parts = [
        "Reachable",
        result.corsEnabled ? "cross-site decoding allowed" : "no cross-site decoding",
    ]
    if (result.mimeType) parts.push(result.mimeType)
    if (result.codecSupported !== undefined) {
        parts.push(result.codecSupported ? "codec supported" : "codec NOT supported")
    }
    return parts.join(" · ")
}

function SourceCheck() {
    const [results, setResults] = useState<Record<string, string>>({})
    const check = async (url: string) => {
        setResults((prev) => ({ ...prev, [url]: "Checking…" }))
        const result = await validateTrackSource(url, { timeoutMs: 8000 })
        setResults((prev) => ({ ...prev, [url]: describeCheck(result) }))
    }
    return (
        <ul className="wk-inline-list">
            {CHECK_URLS.map(({ label, url }) => (
                <li key={url} className="wk-inline-list__row">
                    <span className="wk-inline-list__main">
                        <span className="wk-inline-list__title">{label}</span>
                        <span className="wk-inline-list__sub">
                            {results[url] ?? "Not checked yet"}
                        </span>
                    </span>
                    <span className="wk-inline-list__actions">
                        <Button onClick={() => void check(url)}>Check</Button>
                    </span>
                </li>
            ))}
        </ul>
    )
}

export function SourcesRecoveryWorkspace() {
    const [policyParam, setPolicy] = useWorkspaceParam("policy", "stop")
    const policy: TrackErrorPolicy = policyParam === "skip" ? "skip" : "stop"
    const [useResolver, setUseResolver] = useState(false)
    const { lines, append, clear } = useEventLog()

    // A stand-in for a signed-URL service: resolves each declared URL after a
    // short delay and tags it, honoring cancellation like a real resolver must.
    const resolver = useMemo<TrackSourceResolver | undefined>(() => {
        if (!useResolver) return undefined
        return (source, signal) =>
            new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const joiner = source.url.includes("?") ? "&" : "?"
                    append(`resolver: signed ${source.url.split("/").pop()}`, "ok")
                    resolve(`${source.url}${joiner}workshop-signed=1`)
                }, 700)
                signal.addEventListener("abort", () => {
                    clearTimeout(timer)
                    append("resolver: request cancelled (track changed)", "warn")
                    reject(new DOMException("Aborted", "AbortError"))
                })
            })
    }, [useResolver, append])

    const codecRows = useMemo(
        () =>
            CODECS.map(
                ({ label, type }) =>
                    [label, checkCodecSupport(type) ? "Supported" : "Not supported"] as const
            ),
        []
    )

    return (
        <AudioSessionProvider
            key={`${policy}:${useResolver}`}
            initialQueue={RECOVERY_QUEUE}
            trackErrorPolicy={policy}
            sourceResolver={resolver}
            onFallbackSource={(event) =>
                append(
                    `onFallbackSource: ${event.failedSource.split("/").pop()} → ${event.nextSource.split("/").pop()}`,
                    "warn"
                )
            }
        >
            <SessionEventFeed append={append as (text: string, tone?: LogLine["tone"]) => void} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <FullCardPlayer {...SEA_THEME} />
                        </div>
                        <Panel
                            title="Recovery cases"
                            hint="Press play, then jump between cases. With the stop policy the dead end halts; with skip it moves on to track 4."
                        >
                            <JumpTo />
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
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
                        <Panel
                            title="Recovery policy"
                            hint="Session options; changing them starts a fresh session."
                        >
                            <Segmented
                                label="When every source fails"
                                value={policy}
                                options={[
                                    { value: "stop", label: "Stop" },
                                    { value: "skip", label: "Skip to next" },
                                ]}
                                onChange={setPolicy}
                            />
                            <Switch
                                label="Async source resolver"
                                hint="Simulates a signed-URL service (700 ms per source)"
                                checked={useResolver}
                                onChange={setUseResolver}
                            />
                        </Panel>
                        <Panel
                            title="Source check"
                            hint="validateTrackSource(): can the browser reach it, and may it decode it across sites (needed for waveforms and analysis)?"
                        >
                            <SourceCheck />
                        </Panel>
                        <Panel title="Codecs in this browser" hint="checkCodecSupport()">
                            <Readout rows={codecRows} />
                        </Panel>
                        <Note>
                            The last two checks explain the rest of the Workshop: No Luck plays
                            everywhere, but its host does not allow cross-site decoding, so its
                            waveforms and analysis fall back.
                        </Note>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
