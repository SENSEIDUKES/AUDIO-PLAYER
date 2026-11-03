import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
    AudioSessionProvider,
    NarrativeFace,
    createCueManifestPlugin,
    createReaderMixerCuePlugin,
    ReaderMixerProvider,
    useReaderMixer,
    formatTime,
    useAudioSession,
    useAudioTime,
    useAudioSessionCueTarget,
    useNarrativeCueController,
    parseCueManifest,
    formatCueManifestIssue,
    describeCueManifestSupport,
} from "../../../audio-player"
import { ReaderMixerPanel } from "../../../reader-ui"
import type { CueManifest, CueManifestIssue, Track } from "../../../audio-player"
import { SAMPLE, SEA_THEME, STAND_IN_SPRITE_PACK } from "../../data"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    SplitLayout,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"
import { SessionEventFeed } from "../shared/session"
import { TestControls } from "../shared/TestControls"

/* Cue Manifest v1: time- and story-triggered actions attached to a track.
   The CueManifestPlugin runs them against the session; narrative actions are
   broadcast and the package's cue-controller hook feeds them into a live
   NarrativeFace, the same wiring a reader app uses. */

const STORY_MANIFEST: CueManifest = {
    version: "sap-cues/1",
    id: "workshop-archive",
    metadata: { title: "The Archive at Night", chapterId: "ch-01" },
    cues: [
        {
            id: "rain-in",
            trigger: { kind: "time", at: 2 },
            actions: [{ command: "ambience.crossfade", profile: "rain-loop", durationMs: 1500 }],
        },
        {
            id: "lamps",
            trigger: { kind: "time", at: 8 },
            actions: [
                {
                    command: "event.emit",
                    eventName: "workshop:beat",
                    detail: { beat: "The lamps flicker" },
                },
            ],
        },
        {
            id: "wind-in",
            trigger: { kind: "time", at: 20 },
            fireOnSeek: true,
            actions: [
                { command: "ambience.crossfade", profile: "wind-loop" },
                { command: "duck.set", amount: 0.8 },
            ],
        },
        {
            id: "tavern",
            trigger: { kind: "scene", value: "tavern" },
            actions: [
                { command: "ambience.crossfade", profile: "tavern-loop" },
                {
                    command: "event.emit",
                    eventName: "workshop:beat",
                    detail: { beat: "Scene: tavern" },
                },
            ],
        },
        {
            id: "tension",
            trigger: { kind: "tension", value: "high" },
            actions: [
                { command: "duck.set", amount: 0.3 },
                {
                    command: "event.emit",
                    eventName: "workshop:beat",
                    detail: { beat: "Tension rises" },
                },
            ],
        },
        {
            id: "stop-at-40",
            trigger: { kind: "time", at: 40 },
            actions: [{ command: "player.pause" }],
        },
    ],
}

/* The same story plus a stand-in sprite pack. */
const SPRITE_MANIFEST: CueManifest = {
    ...STORY_MANIFEST,
    id: "workshop-archive-sprites",
    assets: { spritePacks: { default: STAND_IN_SPRITE_PACK } },
    cues: [
        ...STORY_MANIFEST.cues,
        {
            id: "chime",
            trigger: { kind: "time", at: 14 },
            replayable: true,
            actions: [{ command: "sprite.play", pack: "default", clip: "chime", volume: 0.9 }],
        },
    ],
}

const PRESETS: readonly { id: string; label: string; manifest: CueManifest }[] = [
    { id: "story", label: "Story cues", manifest: STORY_MANIFEST },
    { id: "sprites", label: "+ Sprite pack (stand-in)", manifest: SPRITE_MANIFEST },
]

const cueTrack = (manifest: CueManifest): Track => ({
    id: `cue-track-${manifest.id ?? "custom"}`,
    title: manifest.metadata?.title ?? "Cue test",
    artist: "Cue Manifest v1 · sample audio",
    audioFile: SAMPLE,
    cueManifest: manifest,
})

function describeAction(command: string, detail: Record<string, unknown>): string {
    const extras = Object.entries(detail)
        .filter(([key]) => key !== "command")
        .map(
            ([key, value]) =>
                `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`
        )
    return `${command}${extras.length ? ` (${extras.join(", ")})` : ""}`
}

/** Listens where the cue runtime broadcasts: the session's private cue channel. */
function CueListener({
    manifest,
    append,
}: {
    manifest: CueManifest
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const eventNames = useMemo(() => {
        const names = new Set<string>()
        for (const cue of manifest.cues) {
            for (const action of cue.actions) {
                if (action.command === "event.emit") names.add(action.eventName)
            }
        }
        return [...names]
    }, [manifest])

    const sessionTarget = useAudioSessionCueTarget()

    useEffect(() => {
        const target = sessionTarget ?? window
        // Log only; the cue controller claims the actions it applies.
        const onNarrative = (event: Event) => {
            const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {}
            append(`narrative cue → ${describeAction(String(detail.command), detail)}`, "ok")
        }
        const onCustom = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail
            append(
                `event ${event.type} ${detail === undefined ? "" : JSON.stringify(detail)}`,
                "ok"
            )
        }
        target.addEventListener("sap-narrative-cue", onNarrative)
        eventNames.forEach((name) => target.addEventListener(name, onCustom))
        return () => {
            target.removeEventListener("sap-narrative-cue", onNarrative)
            eventNames.forEach((name) => target.removeEventListener(name, onCustom))
        }
    }, [eventNames, append, sessionTarget])
    return null
}

function CueTimeline({ manifest }: { manifest: CueManifest }) {
    const s = useAudioSession()
    const { currentTime, duration } = useAudioTime()
    const timeCues = manifest.cues.filter((cue) => cue.trigger.kind === "time")
    const span = duration || 48
    return (
        <div className="wk-cue-timeline">
            <div className="wk-cue-timeline__track">
                <div
                    className="wk-cue-timeline__needle"
                    style={{ left: `${Math.min(100, (currentTime / span) * 100)}%` }}
                    aria-hidden="true"
                />
                {timeCues.map((cue) => {
                    const at = cue.trigger.kind === "time" ? cue.trigger.at : 0
                    const passed = currentTime >= at
                    return (
                        <button
                            key={cue.id}
                            type="button"
                            className={`wk-cue-timeline__marker${passed ? " wk-cue-timeline__marker--passed" : ""}`}
                            style={{ left: `${Math.min(100, (at / span) * 100)}%` }}
                            onClick={() => s.seek(Math.max(0, at - 1.5))}
                            aria-label={`Seek to just before cue ${cue.id} at ${formatTime(at)}`}
                            title={`${cue.id} · ${formatTime(at)}`}
                        />
                    )
                })}
            </div>
            <div className="wk-cue-timeline__labels">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(span)}</span>
            </div>
        </div>
    )
}

/** The plugin lifetime matches the keyed session, including Strict Mode replay. */
function CueSession({
    track,
    append,
    integrated,
    children,
}: {
    track: Track
    append: (message: string, tone?: LogLine["tone"]) => void
    integrated: boolean
    children: ReactNode
}) {
    const mixer = useReaderMixer()
    const plugins = useMemo(() => {
        const options = {
            onStatus: (event: import("../../../audio-player").CueStatusEvent) =>
                append(
                    `Manifest ${event.manifestId ?? "custom"}: ${event.status}${event.pack ? ` (${event.pack})` : ""}${event.message ? ` — ${event.message}` : ""}`,
                    event.status === "failed" || event.status === "cleanup-failed" ? "warn" : "info"
                ),
            onOutcome: (event: import("../../../audio-player").CueOutcomeEvent) =>
                append(
                    `Cue ${event.cueId}: ${event.outcome}${event.reason ? ` (${event.reason})` : ""}`,
                    event.outcome === "skipped" || event.outcome === "failed" ? "warn" : "ok"
                ),
        }
        return [
            integrated
                ? createReaderMixerCuePlugin(mixer, options)
                : createCueManifestPlugin(options),
        ]
    }, [append, integrated, mixer])
    return (
        <AudioSessionProvider initialQueue={[track]} plugins={plugins}>
            {children}
        </AudioSessionProvider>
    )
}

/** Own the Workshop mixer outside replaceable narration/manifest sessions. */
export function CuesWorkspace() {
    return (
        <ReaderMixerProvider>
            <CuesContent />
        </ReaderMixerProvider>
    )
}

interface Validation {
    /** Plain-language outcome shown above the findings; null when there is nothing to say. */
    headline: string | null
    issues: CueManifestIssue[]
    /** Cues plus actions dropped from `pending`, from the parse result. */
    omitted: number
    /** Manifest with invalid parts omitted, offered only after the user has seen what is dropped. */
    pending: CueManifest | null
}

const NO_VALIDATION: Validation = { headline: null, issues: [], omitted: 0, pending: null }

/** Apply keyed manifests and show runtime installation, pack readiness and cue outcomes. */
function CuesContent() {
    const [manifest, setManifest] = useState<CueManifest>(STORY_MANIFEST)
    const [draft, setDraft] = useState(() => JSON.stringify(STORY_MANIFEST, null, 2))
    const [integrated, setIntegrated] = useState(true)
    const [generation, setGeneration] = useState(0)
    const [validation, setValidation] = useState<Validation>(NO_VALIDATION)
    const { lines, append, clear } = useEventLog(60)
    const track = useMemo(() => cueTrack(manifest), [manifest])

    const applyManifest = (valid: CueManifest, issues: CueManifestIssue[], omitted = 0) => {
        setValidation(
            issues.length
                ? {
                      headline: omitted
                          ? `Applied with ${omitted} omission(s).`
                          : "Applied. The manifest has warnings:",
                      issues,
                      omitted,
                      pending: null,
                  }
                : NO_VALIDATION
        )
        setManifest(valid)
        setGeneration((g) => g + 1)
        append(
            `Requested manifest “${valid.id ?? "custom"}” with ${valid.cues.length} cues${omitted ? ` (${omitted} omitted)` : ""}`,
            omitted ? "warn" : "info"
        )
    }

    const apply = () => {
        let parsed: unknown
        try {
            parsed = JSON.parse(draft)
        } catch (error) {
            setValidation({
                headline: `Not valid JSON: ${(error as Error).message}`,
                issues: [],
                omitted: 0,
                pending: null,
            })
            return
        }
        const result = parseCueManifest(parsed)
        if (result.status === "invalid") {
            setValidation({
                headline: "Not applied: nothing in this manifest is usable.",
                issues: result.issues,
                omitted: 0,
                pending: null,
            })
        } else if (result.status === "accepted-with-omissions") {
            setValidation({
                headline: `Not applied yet: ${result.omittedCueCount} cue(s) and ${result.omittedActionCount} action(s) would be dropped. Fix them, or apply only what is valid.`,
                issues: result.issues,
                omitted: result.omittedCueCount + result.omittedActionCount,
                pending: result.manifest,
            })
        } else {
            applyManifest(result.manifest, result.issues)
        }
    }

    const applyValidPart = () => {
        const pending = validation.pending
        if (!pending) return
        applyManifest(pending, validation.issues, validation.omitted)
    }

    // Findings and the pending manifest describe the draft they were parsed from.
    const editDraft = (value: string) => {
        setDraft(value)
        setValidation(NO_VALIDATION)
    }

    const loadPreset = (preset: CueManifest) => {
        setDraft(JSON.stringify(preset, null, 2))
        applyManifest(preset, [])
    }

    return (
        <CueSession
            key={`${generation}:${integrated}`}
            track={track}
            append={append}
            integrated={integrated}
        >
            <CueConsole
                manifest={manifest}
                draft={draft}
                setDraft={editDraft}
                validation={validation}
                integrated={integrated}
                setIntegrated={setIntegrated}
                onApply={apply}
                onApplyValidPart={applyValidPart}
                onRevert={() => {
                    setDraft(JSON.stringify(manifest, null, 2))
                    setValidation(NO_VALIDATION)
                }}
                onPreset={loadPreset}
                append={append}
                lines={lines}
                clear={clear}
            />
        </CueSession>
    )
}

interface CueConsoleProps {
    manifest: CueManifest
    draft: string
    setDraft: (value: string) => void
    validation: Validation
    integrated: boolean
    setIntegrated: (value: boolean) => void
    onApply: () => void
    onApplyValidPart: () => void
    onRevert: () => void
    onPreset: (manifest: CueManifest) => void
    append: (text: string, tone?: LogLine["tone"]) => void
    lines: LogLine[]
    clear: () => void
}

/** Lives inside the session so the cue controller shares the session's private cue channel. */
function CueConsole({
    manifest,
    draft,
    setDraft,
    validation,
    integrated,
    setIntegrated,
    onApply,
    onApplyValidPart,
    onRevert,
    onPreset,
    append,
    lines,
    clear,
}: CueConsoleProps) {
    const { narrativeOptions, dispatchCueEvent } = useNarrativeCueController()
    const storyCues = manifest.cues.filter((cue) => cue.trigger.kind !== "time")
    const support = useMemo(() => describeCueManifestSupport(manifest), [manifest])

    return (
        <>
            <SessionEventFeed append={append} />
            <CueListener manifest={manifest} append={append} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">Transport</p>
                            <TestControls />
                            <CueTimeline manifest={manifest} />
                            <Note>
                                Markers are time cues; tap one to jump just before it. Time cues
                                only fire while playing.
                            </Note>
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">NarrativeFace driven by cues</p>
                            <NarrativeFace
                                {...narrativeOptions}
                                sceneMood={
                                    narrativeOptions.sceneMood ??
                                    narrativeOptions.ambientProfile?.replace("-loop", "") ??
                                    "—"
                                }
                                ambienceManifest={STAND_IN_SPRITE_PACK}
                                {...SEA_THEME}
                            />
                            <Note>
                                Ambience crossfades, ducking, narration fades and layers arrive
                                through useNarrativeCueController, exactly as a reader app would
                                wire them.
                            </Note>
                        </div>
                        <Panel
                            title="Cue log"
                            actions={
                                <Button variant="ghost" onClick={clear}>
                                    Clear
                                </Button>
                            }
                        >
                            <EventLog lines={lines} empty="Press play, or trigger a story cue." />
                        </Panel>
                    </>
                }
                controls={
                    <>
                        <Panel
                            title="Story triggers"
                            hint="Cues that fire on a story moment instead of a time."
                        >
                            <ButtonRow>
                                {storyCues.map((cue) => (
                                    <Button
                                        key={cue.id}
                                        onClick={() => {
                                            if (cue.trigger.kind === "time") return
                                            dispatchCueEvent({
                                                kind: cue.trigger.kind,
                                                value: cue.trigger.value,
                                            })
                                            append(
                                                `dispatch ${cue.trigger.kind}=${cue.trigger.value}`
                                            )
                                        }}
                                    >
                                        {cue.trigger.kind === "time"
                                            ? cue.id
                                            : `${cue.trigger.kind}: ${cue.trigger.value}`}
                                    </Button>
                                ))}
                            </ButtonRow>
                            <Note>Every cue can also run by id, ignoring its trigger:</Note>
                            <ButtonRow>
                                {manifest.cues.map((cue) => (
                                    <Button
                                        key={cue.id}
                                        variant="ghost"
                                        onClick={() => {
                                            dispatchCueEvent({ id: cue.id })
                                            append(`dispatch id=${cue.id}`)
                                        }}
                                    >
                                        {cue.id}
                                    </Button>
                                ))}
                            </ButtonRow>
                        </Panel>
                        <Panel
                            title="Manifest"
                            hint="Edit, then validate and apply. Applying restarts the session with the new manifest."
                        >
                            <textarea
                                className="wk-textarea"
                                aria-label="Cue manifest JSON"
                                value={draft}
                                spellCheck={false}
                                onChange={(event) => setDraft(event.target.value)}
                            />
                            {validation.headline && <Note tone="warn">{validation.headline}</Note>}
                            {validation.issues.map((issue, index) => (
                                <Note
                                    key={index}
                                    tone={issue.severity === "error" ? "warn" : "info"}
                                >
                                    <strong>{issue.severity}</strong> ·{" "}
                                    {formatCueManifestIssue(issue)}
                                </Note>
                            ))}
                            <ButtonRow>
                                <Button variant="primary" onClick={onApply}>
                                    Validate &amp; apply
                                </Button>
                                {validation.pending && (
                                    <Button onClick={onApplyValidPart}>
                                        Apply only what is valid
                                    </Button>
                                )}
                                <Button onClick={onRevert}>Revert draft</Button>
                            </ButtonRow>
                        </Panel>
                        <Panel
                            title="Action support"
                            hint="Which of this manifest's actions need more than the cue runtime."
                        >
                            {support.needsAttention.length === 0 ? (
                                <Note>The cue runtime applies every action in this manifest.</Note>
                            ) : (
                                support.needsAttention.map((item) => (
                                    <Note
                                        key={item.command}
                                        tone={item.handledBy === "host" ? "warn" : "placeholder"}
                                    >
                                        <strong>{item.command}</strong> ·{" "}
                                        {item.handledBy === "host"
                                            ? "needs host integration"
                                            : "applied by useNarrativeCueController"}{" "}
                                        — {item.summary}
                                    </Note>
                                ))
                            )}
                        </Panel>
                        <Panel title="Reader audio controls">
                            <label className="wk-field wk-field--checkbox">
                                <input
                                    type="checkbox"
                                    checked={integrated}
                                    onChange={(event) => setIntegrated(event.target.checked)}
                                />
                                Route story sprites through Reader Mixer
                            </label>
                            {integrated && <ReaderMixerPanel />}
                        </Panel>
                        <Panel title="Presets">
                            <ButtonRow>
                                {PRESETS.map((preset) => (
                                    <Button
                                        key={preset.id}
                                        pressed={manifest.id === preset.manifest.id}
                                        onClick={() => onPreset(preset.manifest)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </ButtonRow>
                            <Note tone="placeholder">
                                The sprite preset plays a stand-in clip cut from the sample track;
                                no real cue sound packs exist yet. Packs preload when installed.
                                Triggers while a pack is loading are skipped immediately and
                                reported in the event log. Trigger again after the pack reports
                                ready.
                            </Note>
                        </Panel>
                    </>
                }
            />
        </>
    )
}
