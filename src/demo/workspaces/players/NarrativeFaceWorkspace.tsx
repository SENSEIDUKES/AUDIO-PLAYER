import { useEffect, useRef, useState } from "react"
import { AudioSessionProvider, NarrativeFace } from "../../../audio-player"
import {
    SEA_THEME,
    STAND_IN_SPRITE_PACK,
    TRACK_SETS,
    TRACK_SET_OPTIONS,
    isTrackSetId,
} from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    RangeField,
    Segmented,
    SelectField,
    SplitLayout,
    Switch,
    useEventLog,
} from "../../workshop/ui"
import { SessionEventFeed, SessionReadout } from "../shared/session"

/* NarrativeFace: the faceless reader surface. Narration is the shared session's
   current track; ambience and FX run on the face's sprite layer. There are no
   real ambience packs yet, so the stand-in pack loops slices of the sample
   track — enough to hear ducking and scene crossfades working. */

type Scene = "rain" | "wind" | "tavern" | "quiet"

const SCENES: Record<Scene, { label: string; profile?: string }> = {
    rain: { label: "Rain", profile: "rain-loop" },
    wind: { label: "Wind", profile: "wind-loop" },
    tavern: { label: "Tavern", profile: "tavern-loop" },
    quiet: { label: "Quiet" },
}

const pct = (value: number) => `${Math.round(value * 100)}%`

export function NarrativeFaceWorkspace() {
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "narration")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "narration"
    const [ambience, setAmbience] = useState(true)
    const [scene, setScene] = useState<Scene>("rain")
    const [fxClip, setFxClip] = useState<string | undefined>(undefined)
    const [intensity, setIntensity] = useState(0.8)
    const [ambienceVolume, setAmbienceVolume] = useState(0.6)
    const [narrationVolume, setNarrationVolume] = useState(1)
    const [duckAmount, setDuckAmount] = useState(0.6)
    const [crossfadeMs, setCrossfadeMs] = useState(1200)
    const [embedded, setEmbedded] = useState(false)
    const [showExpand, setShowExpand] = useState(true)
    const { lines, append, clear } = useEventLog()
    const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(
        () => () => {
            if (fxTimer.current) clearTimeout(fxTimer.current)
        },
        []
    )

    // The face re-triggers FX when `fxClip` changes, so pulse it on and off.
    const playChime = () => {
        if (fxTimer.current) clearTimeout(fxTimer.current)
        setFxClip("chime")
        append("FX: chime (stand-in clip)")
        fxTimer.current = setTimeout(() => setFxClip(undefined), 1600)
    }

    const sceneInfo = SCENES[scene]

    return (
        <AudioSessionProvider key={trackSetId} initialQueue={TRACK_SETS[trackSetId].tracks}>
            <SessionEventFeed append={append} />
            <SplitLayout
                stage={
                    <>
                        <article className="wk-stage-card wk-reader" aria-label="Reader preview">
                            <p className="wk-stage-card__title">Chapter 1 · The Archive at Night</p>
                            <p className="wk-reader__text">
                                Rain found the archive windows long before the lamps were lit. The
                                narration carries the chapter; the room's ambience sits under it and
                                steps back whenever a voice speaks.
                            </p>
                            <p className="wk-reader__text">
                                Change the scene to hear the ambience crossfade, or play a chime for
                                a one-shot effect on the same layer.
                            </p>
                            <NarrativeFace
                                chapterId="ch-01"
                                sceneMood={sceneInfo.label}
                                ambientProfile={ambience ? sceneInfo.profile : undefined}
                                ambienceManifest={ambience ? STAND_IN_SPRITE_PACK : undefined}
                                fxClip={ambience ? fxClip : undefined}
                                intensity={intensity}
                                ambienceVolume={ambienceVolume}
                                narrationVolume={narrationVolume}
                                duckAmount={duckAmount}
                                crossfadeMs={crossfadeMs}
                                embedded={embedded}
                                showExpand={showExpand}
                                onExpand={() => append("Expand pressed (host opens settings)")}
                                {...SEA_THEME}
                            />
                        </article>
                        {embedded && (
                            <Note>
                                Embedded mode pins the face as a small overlay at the bottom of the
                                window, the way a reader app shows it over the text.
                            </Note>
                        )}
                        <Panel title="Narration session">
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
                        <Panel title="Narration">
                            <SelectField
                                label="Narration tracks"
                                value={trackSetId}
                                options={TRACK_SET_OPTIONS}
                                onChange={setTrackSet}
                            />
                            <RangeField
                                label="Narration level"
                                value={narrationVolume}
                                min={0}
                                max={1}
                                step={0.05}
                                format={pct}
                                onChange={setNarrationVolume}
                            />
                        </Panel>
                        <Panel
                            title="Ambience"
                            hint="Stand-in clips cut from the sample track. No real ambience packs exist yet."
                        >
                            <Switch
                                label="Stand-in ambience pack"
                                hint="Starts on your next tap (browser audio rules)"
                                checked={ambience}
                                onChange={setAmbience}
                            />
                            <Segmented
                                label="Scene"
                                value={scene}
                                options={(Object.keys(SCENES) as Scene[]).map((id) => ({
                                    value: id,
                                    label: SCENES[id].label,
                                    disabled: !ambience,
                                }))}
                                onChange={(next) => {
                                    setScene(next)
                                    append(`Scene → ${SCENES[next].label}`)
                                }}
                            />
                            <ButtonRow>
                                <Button onClick={playChime} disabled={!ambience}>
                                    Play chime (FX)
                                </Button>
                            </ButtonRow>
                            <RangeField
                                label="Intensity"
                                value={intensity}
                                min={0}
                                max={1}
                                step={0.05}
                                format={pct}
                                onChange={setIntensity}
                            />
                            <RangeField
                                label="Ambience level"
                                value={ambienceVolume}
                                min={0}
                                max={1}
                                step={0.05}
                                format={pct}
                                onChange={setAmbienceVolume}
                            />
                            <RangeField
                                label="Duck under narration"
                                value={duckAmount}
                                min={0}
                                max={1}
                                step={0.05}
                                format={pct}
                                onChange={setDuckAmount}
                            />
                            <RangeField
                                label="Scene crossfade"
                                value={crossfadeMs}
                                min={200}
                                max={4000}
                                step={100}
                                unit=" ms"
                                onChange={setCrossfadeMs}
                            />
                        </Panel>
                        <Panel title="Placement">
                            <Switch
                                label="Embedded overlay"
                                hint="Fixed to the bottom of the window"
                                checked={embedded}
                                onChange={setEmbedded}
                            />
                            <Switch
                                label="Show expand button"
                                checked={showExpand}
                                onChange={setShowExpand}
                            />
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
