import { useEffect, useMemo, useState } from "react"
import {
    AudioSessionProvider,
    NarrativeFace,
    StickyBottomPlayer,
    createCueManifestPlugin,
    formatTime,
    useAudioSession,
    useAudioTime,
    useNarrativeCueController,
    validateCueManifest,
} from "../../../audio-player"
import type { CueManifest, Track } from "../../../audio-player"
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

/* The same story plus a sprite cue and the stand-in pack it plays from.
   Known package issue: under React's development double-mount (the local dev
   server) the plugin sound layer is disposed and never recreated, so loading a
   sprite pack throws and the cue runtime never starts. Built sites are not
   affected. See usePluginSoundLayer.ts. */
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

/** Listens where the cue runtime broadcasts (window, for session plugins). */
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

    useEffect(() => {
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
        window.addEventListener("sap-narrative-cue", onNarrative)
        eventNames.forEach((name) => window.addEventListener(name, onCustom))
        return () => {
            window.removeEventListener("sap-narrative-cue", onNarrative)
            eventNames.forEach((name) => window.removeEventListener(name, onCustom))
        }
    }, [eventNames, append])
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

export function CuesWorkspace() {
    const [manifest, setManifest] = useState<CueManifest>(STORY_MANIFEST)
    const [draft, setDraft] = useState(() => JSON.stringify(STORY_MANIFEST, null, 2))
    const [generation, setGeneration] = useState(0)
    const [draftError, setDraftError] = useState<string | null>(null)
    const { lines, append, clear } = useEventLog(60)
    const { narrativeOptions, dispatchCueEvent } = useNarrativeCueController()
    const plugins = useMemo(() => [createCueManifestPlugin()], [])
    const track = useMemo(() => cueTrack(manifest), [manifest])

    const applyManifest = (valid: CueManifest) => {
        setDraftError(null)
        setManifest(valid)
        setGeneration((g) => g + 1)
        append(`Applied manifest “${valid.id ?? "custom"}” with ${valid.cues.length} cues`, "ok")
    }

    const apply = () => {
        let parsed: unknown
        try {
            parsed = JSON.parse(draft)
        } catch (error) {
            setDraftError(`Not valid JSON: ${(error as Error).message}`)
            return
        }
        const valid = validateCueManifest(parsed)
        if (!valid) {
            setDraftError("The manifest did not validate (details are in the browser console).")
            return
        }
        applyManifest(valid)
    }

    const loadPreset = (preset: CueManifest) => {
        setDraft(JSON.stringify(preset, null, 2))
        applyManifest(preset)
    }

    const storyCues = manifest.cues.filter((cue) => cue.trigger.kind !== "time")

    return (
        <AudioSessionProvider key={generation} initialQueue={[track]} plugins={plugins}>
            <SessionEventFeed append={append} />
            <CueListener manifest={manifest} append={append} />
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">Transport</p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                            <CueTimeline manifest={manifest} />
                            <Note>Markers are time cues; tap one to jump just before it.</Note>
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">NarrativeFace driven by cues</p>
                            <NarrativeFace
                                {...narrativeOptions}
                                sceneMood={
                                    narrativeOptions.ambientProfile?.replace("-loop", "") ?? "—"
                                }
                                ambienceManifest={STAND_IN_SPRITE_PACK}
                                {...SEA_THEME}
                            />
                            <Note>
                                Ambience crossfades and duck changes arrive through
                                useNarrativeCueController, exactly as a reader app would wire them.
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
                            {draftError && <Note tone="warn">{draftError}</Note>}
                            <ButtonRow>
                                <Button variant="primary" onClick={apply}>
                                    Validate &amp; apply
                                </Button>
                                <Button
                                    onClick={() => {
                                        setDraft(JSON.stringify(manifest, null, 2))
                                        setDraftError(null)
                                    }}
                                >
                                    Revert draft
                                </Button>
                            </ButtonRow>
                        </Panel>
                        <Panel title="Presets">
                            <ButtonRow>
                                {PRESETS.map((preset) => (
                                    <Button
                                        key={preset.id}
                                        pressed={manifest.id === preset.manifest.id}
                                        onClick={() => loadPreset(preset.manifest)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </ButtonRow>
                            <Note tone="placeholder">
                                The sprite preset plays a stand-in clip cut from the sample track;
                                no real cue sound packs exist yet. Known package bug: on the local
                                dev server a manifest with a sprite pack stops every cue from
                                running (the plugin sound layer does not survive React's development
                                double-mount). The built site is not affected.
                            </Note>
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
