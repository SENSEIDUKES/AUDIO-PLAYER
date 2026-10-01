import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import {
    ReaderMixerPanel,
    ReaderMixerProvider,
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
} from "../../../audio-player"
import { SAMPLE, noLuckTracks } from "../../data"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    Readout,
    Segmented,
    SplitLayout,
    WidthFrame,
    parseStageWidth,
    useEventLog,
} from "../../workshop/ui"
import type { LogLine } from "../../workshop/ui"

/* SEN reader audio: the three-layer ReaderMixer driven the way the NovelExpanded
   reader will drive it. The chapter buttons and cue pads stand in for the host
   app; the mixer view is the piece that goes in the reader's Settings › Audio.
   Preferences persist in this browser only, under a Workshop-owned key. */

const STORAGE_KEY = "sap-workshop:reader-mixer"
const CELESTIAL = "https://celestialaudio.seihouse.org/DEFAULT"

type Host = "seihouse" | "cors-sample"
type Routing = NonNullable<ReaderMixerOptions["routing"]>

interface SceneSet {
    chapter: Track
    battle: Track
    atmospheres: ReaderAtmosphereOption[]
    cues: { id: string; label: string; url: string; volume?: number }[]
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
})

const SETS: Record<Host, SceneSet> = {
    seihouse: {
        chapter: { ...noLuckTracks[0], id: "sen-chapter-1", title: "Chapter 1 score" },
        battle: { ...noLuckTracks[2], id: "sen-battle", title: "Battle score" },
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
                label: "Beast growl",
                url: `${CELESTIAL}/Beasts/Growl/Tiger_Growl_1.mp3`,
            },
            {
                id: "dragon",
                label: "Dragon call",
                url: `${CELESTIAL}/Beasts/Call/Dragon_Call_1.mp3`,
            },
            {
                id: "bell",
                label: "Temple bell",
                url: `${CELESTIAL}/Locations/Signatures/Temple_Bell_1.mp3`,
            },
            {
                id: "chime",
                label: "Magic chime (50%)",
                url: `${CELESTIAL}/Locations/Signatures/Magic_Chime_1.mp3`,
                volume: 0.5,
            },
            {
                id: "magic",
                label: "Wind magic",
                url: `${CELESTIAL}/Weapons/Magic/Wind_Magic_1.mp3`,
            },
        ],
    },
    // One CORS-enabled file stands in for every layer, so the Web Audio route
    // can be heard end to end before the SEIHouse hosts send CORS headers.
    "cors-sample": {
        chapter: {
            id: "sample-chapter",
            title: "Chapter score (sample)",
            artist: "",
            audioFile: SAMPLE,
        },
        battle: {
            id: "sample-battle",
            title: "Battle score (sample)",
            artist: "",
            sources: [{ url: `${SAMPLE}#battle` }],
        },
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
}

function ReaderSimulation({
    set,
    width,
    append,
}: {
    set: SceneSet
    width: number | "auto"
    append: (text: string, tone?: LogLine["tone"]) => void
}) {
    const mixer = useReaderMixer()
    const state = useReaderMixerState()
    const previous = useRef(state)

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
        return `${layerState.status} · ${Math.round(layerState.effectiveLevel * 100)}%${
            layerState.current ? ` · ${layerState.current}` : ""
        }`
    }

    return (
        <>
            <Panel
                title="Reader · what the app does"
                hint="These buttons stand in for NovelExpanded: it picks the score, places cues in the text, and calls the mixer."
            >
                <ButtonRow>
                    <Button
                        onClick={() => {
                            mixer.playSoundscape(set.chapter)
                            mixer.startAtmosphere()
                            append("chapter opens → playSoundscape(chapter) + startAtmosphere()")
                        }}
                    >
                        Open chapter
                    </Button>
                    <Button
                        onClick={() => {
                            mixer.playSoundscape(set.battle)
                            append("battle starts → playSoundscape(battle)")
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
                                const played = mixer.playCue(cue.url, { volume: cue.volume })
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
                        ["Saved atmosphere", state.preferences.atmosphereId ?? "Off"],
                        ["Routing", state.routing],
                        ["Sliders", state.volumeControl === "level" ? "set loudness" : "on/off"],
                        ["Needs a tap", state.needsGesture ? "yes" : "no"],
                    ]}
                />
            </Panel>
            <Panel
                title="Settings › Audio · the mixer view"
                hint="ReaderMixerPanel, rendered inline the way the reader's Settings menu will place it."
            >
                <WidthFrame width={width}>
                    <div className="wk-sen-settings">
                        <ReaderMixerPanel style={MIXER_THEME} />
                    </div>
                </WidthFrame>
            </Panel>
        </>
    )
}

export function ReaderMixerWorkspace() {
    const { lines, append, clear } = useEventLog(60)
    const [routing, setRouting] = useState<Routing>("element")
    const [host, setHost] = useState<Host>("seihouse")
    const [stageWidth, setStageWidth] = useState("390")
    const [generation, setGeneration] = useState(0)
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
        // generation forces a fresh mixer after "Reset saved settings".
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [routing, set, generation]
    )

    return (
        <SplitLayout
            stage={
                <>
                    <ReaderMixerProvider key={`${routing}:${host}:${generation}`} options={options}>
                        <ReaderSimulation
                            set={set}
                            width={parseStageWidth(stageWidth)}
                            append={append}
                        />
                    </ReaderMixerProvider>
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
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    try {
                                        localStorage.removeItem(STORAGE_KEY)
                                    } catch {
                                        // Storage may be blocked; the fresh mixer still resets.
                                    }
                                    setGeneration((value) => value + 1)
                                    append("saved settings cleared")
                                }}
                            >
                                Reset saved settings
                            </Button>
                        </ButtonRow>
                    </Panel>
                    <Note tone="warn">
                        celestialaudio.seihouse.org and audio.seihouse.org send no
                        Access-Control-Allow-Origin header, so their files fail to load on the Auto
                        (on iPhone) and Web Audio routes. Use Element for SEIHouse files, or switch
                        Audio files to the CORS sample to hear the Web Audio route.
                    </Note>
                    <Note>
                        Element routing plays through plain media elements. On iPhone Safari the
                        sliders then work as on/off and the view says so. Web Audio routing gives
                        every layer its own GainNode, so all three sliders set real loudness.
                    </Note>
                    <Note>
                        Hide this tab to see both loops pause; they resume when it returns. Your
                        levels, switches and atmosphere are saved in this browser only.
                    </Note>
                </>
            }
        />
    )
}
