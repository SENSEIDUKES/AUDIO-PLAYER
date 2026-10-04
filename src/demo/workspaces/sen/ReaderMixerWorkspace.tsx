import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import {
    AudioSessionProvider,
    NarrativeFace,
    ReaderMixerPanel,
    ReaderMixerProvider,
    ReaderMixerVoice,
    loadReaderMixerPreferences,
    saveReaderMixerPreferences,
    useReaderMixer,
    useReaderMixerState,
} from "../../../audio-player"
import type {
    ReaderAtmosphereOption,
    ReaderMixerLayer,
    ReaderMixerOptions,
    Track,
    LoudnessMeasurement,
} from "../../../audio-player"
import measurements from "../../readerLoudness.json"
import { SAMPLE, SEA_THEME, narrationTracks } from "../../data"
import { SEN_SOUNDSCAPES_VOLUME_1, SEN_SOUNDSCAPE_CATEGORIES } from "../../senSoundscapes"
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
    WidthFrame,
    parseStageWidth,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"

/* SEN reader audio: the four-layer ReaderMixer driven the way the NovelExpanded
   reader will drive it. The chapter buttons and cue pads stand in for the host
   app; the mixer view is the piece that goes in the reader's Settings › Audio.
   Preferences persist in this browser only, under a Workshop-owned key. */

const STORAGE_KEY = "sap-workshop:reader-mixer"
const CELESTIAL = "https://celestialaudio.seihouse.org/DEFAULT"

type Host = "seihouse" | "cors-sample"
type Routing = NonNullable<ReaderMixerOptions["routing"]>

interface ScoreOption {
    track: Track
    category: string
    /** Mood and length, shown under the title. */
    detail: string
}

interface SceneSet {
    /** Every score the reader can play, in display order. */
    scores: ScoreOption[]
    categories: readonly string[]
    /** Category "Battle starts" cycles through. */
    battleCategory: string
    atmospheres: ReaderAtmosphereOption[]
    cues: {
        id: string
        label: string
        url: string
        volume?: number
        loudness?: LoudnessMeasurement
    }[]
}

const atmosphere = (
    id: string,
    label: string,
    group: string,
    path: string
): ReaderAtmosphereOption => ({
    id,
    label,
    group,
    sources: [{ url: `${CELESTIAL}/atmosphere/${path}` }],
    loudness: measurements.find((entry) => entry.id === id)?.loudness as
        LoudnessMeasurement | undefined,
})

const formatLength = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

const SEN_SCORES: ScoreOption[] = SEN_SOUNDSCAPES_VOLUME_1.map((score) => ({
    track: {
        id: score.id,
        title: `${score.category} ${score.number} · ${score.title}`,
        artist: "SEN Soundscapes · Volume 1",
        audioFile: score.url,
        loudness: score.loudness,
    },
    category: score.category,
    detail: `${score.mood} · ${formatLength(score.durationSeconds)}`,
}))

const SETS: Record<Host, SceneSet> = {
    seihouse: {
        scores: SEN_SCORES,
        categories: SEN_SOUNDSCAPE_CATEGORIES,
        battleCategory: "Fighting",
        atmospheres: [
            atmosphere("gentle-rain", "Gentle rain", "Weather", "Rain/Gentle_Rain_1.mp3"),
            atmosphere("heavy-rain", "Heavy rain", "Weather", "Rain/Heavy_Rain_1.mp3"),
            atmosphere("gentle-wind", "Gentle wind", "Weather", "Wind/Gentle_Wind_1.mp3"),
            atmosphere("strong-wind", "Strong wind", "Weather", "Wind/Strong_Wind_2.mp3"),
            atmosphere("waves", "Waves", "Weather", "Waves/Gentle_Waves_1.mp3"),
            atmosphere("forest", "Forest", "Places", "Noise/Forest_1.mp3"),
            atmosphere("village", "Village", "Places", "Noise/Village_1.mp3"),
            atmosphere("cave", "Cave", "Places", "Noise/Cave_1.mp3"),
            atmosphere("city", "City", "Places", "Noise/Modern_City_1.mp3"),
            atmosphere("crowd", "Crowd", "Places", "Crowd/Crowd_Chatter_1.mp3"),
        ],
        cues: [
            {
                id: "growl",
                loudness: measurements.find((entry) => entry.id === "growl")?.loudness as
                    LoudnessMeasurement | undefined,
                label: "Beast growl",
                url: `${CELESTIAL}/Beasts/Growl/Tiger_Growl_1.mp3`,
            },
            {
                id: "dragon",
                loudness: measurements.find((entry) => entry.id === "dragon")?.loudness as
                    LoudnessMeasurement | undefined,
                label: "Dragon call",
                url: `${CELESTIAL}/Beasts/Call/Dragon_Call_1.mp3`,
            },
            {
                id: "bell",
                loudness: measurements.find((entry) => entry.id === "bell")?.loudness as
                    LoudnessMeasurement | undefined,
                label: "Temple bell",
                url: `${CELESTIAL}/Locations/Signatures/Temple_Bell_1.mp3`,
            },
            {
                id: "chime",
                loudness: measurements.find((entry) => entry.id === "chime")?.loudness as
                    LoudnessMeasurement | undefined,
                label: "Magic chime (50%)",
                url: `${CELESTIAL}/Locations/Signatures/Magic_Chime_1.mp3`,
                volume: 0.5,
            },
            {
                id: "magic",
                loudness: measurements.find((entry) => entry.id === "magic")?.loudness as
                    LoudnessMeasurement | undefined,
                label: "Wind magic",
                url: `${CELESTIAL}/Weapons/Magic/Wind_Magic_1.mp3`,
            },
        ],
    },
    // One third-party CORS file stands in for every layer, as a control for
    // the Web Audio route independent of the SEIHouse hosts.
    "cors-sample": {
        scores: [
            {
                track: {
                    id: "sample-chapter",
                    title: "Chapter score (sample)",
                    artist: "",
                    audioFile: SAMPLE,
                },
                category: "Chapter",
                detail: "third-party CORS file",
            },
            {
                track: {
                    id: "sample-battle",
                    title: "Battle score (sample)",
                    artist: "",
                    sources: [{ url: `${SAMPLE}#battle` }],
                },
                category: "Battle",
                detail: "the same file, as a second score",
            },
        ],
        categories: ["Chapter", "Battle"],
        battleCategory: "Battle",
        atmospheres: [
            {
                id: "sample-bed",
                label: "Sample bed",
                group: "Sample",
                sources: [{ url: `${SAMPLE}#bed` }],
            },
        ],
        cues: [
            { id: "sample-hit", label: "Sample hit", url: `${SAMPLE}#cue` },
            { id: "sample-quiet", label: "Sample hit (30%)", url: `${SAMPLE}#cue`, volume: 0.3 },
        ],
    },
}

const MIXER_THEME = {
    "--sap-reader-mixer-accent": "#7c5cff",
    "--sap-reader-mixer-track": "rgba(255, 255, 255, 0.18)",
    "--sap-reader-mixer-border": "rgba(255, 255, 255, 0.1)",
    "--sap-reader-mixer-chip-bg": "rgba(255, 255, 255, 0.06)",
} as CSSProperties

const LAYER_NAMES: Record<ReaderMixerLayer, string> = {
    soundscapes: "Soundscapes",
    atmosphere: "Atmosphere",
    cues: "Sound Cues",
    voice: "Voice",
}

const MIXER_VIEW_ID = "sen-reader-mixer-view"

function ReaderSimulation({
    set,
    width,
    duckAmount,
    append,
}: {
    set: SceneSet
    width: number | "auto"
    duckAmount: number
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const mixer = useReaderMixer()
    const state = useReaderMixerState()
    const previous = useRef(state)
    const [category, setCategory] = useState(set.categories[0])
    const [chapterScore, setChapterScore] = useState(set.scores[0])
    const battleTurn = useRef(0)
    const titleFor = (key: string | null) =>
        set.scores.find((score) => `id:${score.track.id}` === key)?.track.title ?? key

    // Log every layer status change, like a host's diagnostics would.
    useEffect(() => {
        const before = previous.current
        previous.current = state
        if (!state || !before) return
        for (const layer of Object.keys(LAYER_NAMES) as ReaderMixerLayer[]) {
            const now = state.layers[layer]
            if (now.status === before.layers[layer].status) continue
            const tone =
                now.status === "failed" ? "error" : now.status === "blocked" ? "warn" : "info"
            append(
                `${LAYER_NAMES[layer]}: ${now.status}${now.failure ? ` (${now.failure})` : ""}`,
                now.status === "playing" ? "ok" : tone
            )
        }
    }, [state, append])

    if (!state) return null
    const row = (layer: ReaderMixerLayer) => {
        const layerState = state.layers[layer]
        const current = layer === "soundscapes" ? titleFor(layerState.current) : layerState.current
        return `${layerState.status} · ${Math.round(layerState.effectiveLevel * 100)}%${
            current ? ` · ${current}` : ""
        }`
    }
    const playScore = (score: ScoreOption, reason: string) => {
        mixer.playSoundscape(score.track)
        append(`${reason} → playSoundscape(“${score.track.title}”)`)
    }
    const audibleKey = state.layers.soundscapes.current

    return (
        <>
            <article className="wk-stage-card wk-reader" aria-label="Reader preview">
                <p className="wk-stage-card__title">Chapter · NarrativeFace + Reader Mixer</p>
                <p className="wk-reader__text">
                    The NarrativeFace carries the narration. Inside the same ReaderMixerProvider it
                    becomes the mixer&apos;s companion: its Ambience slider is the reader&apos;s
                    Atmosphere level, its mood shows the chosen atmosphere, and while the voice
                    plays the music and atmosphere step back under it. Voice volume and mute agree
                    with the mixer&apos;s fourth slot. Cues stay at full level.
                </p>
                <NarrativeFace
                    duckAmount={duckAmount}
                    showExpand
                    onExpand={() => {
                        const view = document.getElementById(MIXER_VIEW_ID)
                        view?.scrollIntoView({ behavior: "smooth", block: "start" })
                        view?.querySelector<HTMLElement>('[role="switch"]')?.focus({
                            preventScroll: true,
                        })
                        append("face → open Settings › Audio (the mixer view)")
                    }}
                    {...SEA_THEME}
                />
            </article>
            <Panel
                title="Reader · what the app does"
                hint="These buttons stand in for NovelExpanded: it picks the score, places cues in the text, and calls the mixer."
            >
                <ButtonRow>
                    <Button
                        onClick={() => {
                            playScore(chapterScore, "chapter opens")
                            mixer.startAtmosphere()
                            append("chapter opens → startAtmosphere()")
                        }}
                    >
                        Open chapter
                    </Button>
                    <Button
                        onClick={() => {
                            const battles = set.scores.filter(
                                (score) => score.category === set.battleCategory
                            )
                            if (battles.length === 0) return
                            const score = battles[battleTurn.current % battles.length]
                            battleTurn.current += 1
                            playScore(score, "battle starts")
                        }}
                    >
                        Battle starts
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => {
                            mixer.stopAll()
                            append("reader closes → stopAll()")
                        }}
                    >
                        Close chapter
                    </Button>
                </ButtonRow>
                <div className="wk-pads">
                    {set.cues.map((cue) => (
                        <button
                            key={cue.id}
                            type="button"
                            className="wk-pad"
                            onClick={() => {
                                const played = mixer.playCue(cue.url, {
                                    volume: cue.volume,
                                    loudness: cue.loudness,
                                })
                                append(
                                    `cue reached → playCue(“${cue.label}”)${played ? "" : " skipped"}`,
                                    played ? "ok" : "warn"
                                )
                            }}
                        >
                            <span className="wk-pad__title">{cue.label}</span>
                            <span className="wk-pad__sub">Sound cue</span>
                        </button>
                    ))}
                </div>
                <Readout
                    label="Mixer state"
                    rows={[
                        ["Soundscapes", row("soundscapes")],
                        ["Atmosphere", row("atmosphere")],
                        ["Sound Cues", `${row("cues")} · ${state.activeCues} playing`],
                        ["Voice", row("voice")],
                        ["Saved atmosphere", state.preferences.atmosphereId ?? "Off"],
                        ["Routing", state.routing],
                        ["Sliders", state.volumeControl === "level" ? "set loudness" : "on/off"],
                        ["Needs a tap", state.needsGesture ? "yes" : "no"],
                        ["Ducked under narration", `${Math.round(state.duck * 100)}%`],
                    ]}
                />
            </Panel>
            <Panel
                title={`Soundscapes · ${set.scores.length} scores`}
                hint="The chapter score. Play switches the music now (a crossfade); the chosen score is also what Open chapter plays. Battle starts cycles through the Fighting scores."
            >
                {set.categories.length > 1 && (
                    <Segmented
                        label="Category"
                        value={category}
                        options={set.categories.map((name) => ({ value: name, label: name }))}
                        onChange={setCategory}
                    />
                )}
                <ul className="wk-inline-list">
                    {set.scores
                        .filter((score) => score.category === category)
                        .map((score) => {
                            const audible = audibleKey === `id:${score.track.id}`
                            const chosen = chapterScore.track.id === score.track.id
                            return (
                                <li
                                    key={score.track.id}
                                    className={`wk-inline-list__row${audible ? " wk-inline-list__row--active" : ""}`}
                                >
                                    <span className="wk-inline-list__main">
                                        <span className="wk-inline-list__title">
                                            {score.track.title}
                                        </span>
                                        <span className="wk-inline-list__sub">
                                            {audible ? "Playing now · " : ""}
                                            {chosen ? "Chapter score · " : ""}
                                            {score.detail}
                                        </span>
                                    </span>
                                    <span className="wk-inline-list__actions">
                                        <Button
                                            onClick={() => {
                                                setChapterScore(score)
                                                playScore(score, "score chosen")
                                            }}
                                        >
                                            Play
                                        </Button>
                                    </span>
                                </li>
                            )
                        })}
                </ul>
            </Panel>
            <Panel
                title="Settings › Audio · the mixer view"
                hint="ReaderMixerPanel, rendered inline the way the reader's Settings menu will place it."
            >
                <WidthFrame width={width}>
                    <div className="wk-sen-settings" id={MIXER_VIEW_ID}>
                        <ReaderMixerPanel style={MIXER_THEME} />
                    </div>
                </WidthFrame>
            </Panel>
        </>
    )
}

function ResetMixerSettings({ append }: { append: ReturnType<typeof useEventLog>["append"] }) {
    const mixer = useReaderMixer()
    return (
        <Button
            variant="ghost"
            onClick={() => {
                mixer.resetPreferences()
                mixer.flushPreferences()
                append("saved settings reset")
            }}
        >
            Reset saved settings
        </Button>
    )
}

export function ReaderMixerWorkspace() {
    const { lines, append, clear } = useEventLog(60)
    const [routing, setRouting] = useState<Routing>("auto")
    const [host, setHost] = useState<Host>("seihouse")
    const [stageWidth, setStageWidth] = useState("390")
    const [duckAmount, setDuckAmount] = useState(0.6)
    const set = SETS[host]

    // A new routing or catalog means a new mixer; the old one is disposed.
    const options = useMemo<ReaderMixerOptions>(
        () => ({
            routing,
            atmospheres: set.atmospheres,
            initialPreferences: loadReaderMixerPreferences(STORAGE_KEY),
            onPreferencesChange: (preferences) =>
                saveReaderMixerPreferences(STORAGE_KEY, preferences),
        }),
        [routing, set]
    )

    return (
        <ReaderMixerProvider key={`${routing}:${host}`} options={options}>
            <SplitLayout
                stage={
                    <>
                        <AudioSessionProvider initialQueue={narrationTracks} audioBackend="html5">
                            <ReaderMixerVoice />
                            <ReaderSimulation
                                set={set}
                                width={parseStageWidth(stageWidth)}
                                duckAmount={duckAmount}
                                append={append}
                            />
                        </AudioSessionProvider>
                        <Panel
                            title="Events"
                            actions={
                                <Button variant="ghost" onClick={clear}>
                                    Clear
                                </Button>
                            }
                        >
                            <EventLog
                                lines={lines}
                                empty="Open a chapter, pick an atmosphere, fire a cue."
                            />
                        </Panel>
                    </>
                }
                controls={
                    <>
                        <Panel title="Mixer setup">
                            <Segmented
                                label="Routing"
                                value={routing}
                                options={[
                                    { value: "element", label: "Element" },
                                    { value: "auto", label: "Auto" },
                                    { value: "web-audio", label: "Web Audio" },
                                ]}
                                onChange={setRouting}
                            />
                            <Segmented
                                label="Audio files"
                                value={host}
                                options={[
                                    { value: "seihouse", label: "SEIHouse" },
                                    { value: "cors-sample", label: "CORS sample" },
                                ]}
                                onChange={setHost}
                            />
                            <Segmented
                                label="Settings width"
                                value={stageWidth}
                                options={[
                                    { value: "auto", label: "Auto" },
                                    { value: "320", label: "320" },
                                    { value: "390", label: "390" },
                                    { value: "480", label: "480" },
                                ]}
                                onChange={setStageWidth}
                            />
                            <ButtonRow>
                                <ResetMixerSettings append={append} />
                            </ButtonRow>
                            <RangeField
                                label="Duck under narration"
                                value={duckAmount}
                                min={0}
                                max={1}
                                step={0.05}
                                format={(value) => `${Math.round(value * 100)}%`}
                                onChange={setDuckAmount}
                            />
                        </Panel>
                        <Note>
                            Auto (the default) uses Web Audio only where the browser ignores element
                            volume, as iPhone Safari does, so every slider sets real loudness there.
                            Element forces plain media elements: on iPhone the sliders then work as
                            on/off and the view says so. Web Audio routes the score, atmosphere and
                            cues through their own GainNodes. Voice uses the recorded help lines on
                            HTML5: desktop volume works; iPhone uses the on/off fallback. TTS files
                            with CORS can use the narration session&apos;s Web Audio backend for
                            real iPhone volume.
                        </Note>
                        <Note>
                            celestialaudio.seihouse.org and audio.seihouse.org send CORS headers
                            (enabled 2026-10-02), so SEIHouse files play on every route.
                        </Note>
                        <Note>
                            Hide this tab to see both loops and a playing voice pause; they resume
                            when it returns. Your levels, switches and atmosphere are saved in this
                            browser only.
                        </Note>
                    </>
                }
            />
        </ReaderMixerProvider>
    )
}
