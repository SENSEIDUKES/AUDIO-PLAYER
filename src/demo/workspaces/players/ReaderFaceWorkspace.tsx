import { useEffect, useMemo, useState } from "react"
import { SEITabs, SEITabsList, SEITabsPanel, SEITabsTrigger } from "@seihouse/ui"
import {
    AudioSessionProvider,
    DEFAULT_READER_MIXER_PREFERENCES,
    ReaderMixerProvider,
    ReaderMixerVoice,
    ReaderNoteFace,
    useAudioSession,
    useReaderMixer,
    useReaderMixerState,
} from "../../../audio-player"
import type { ReaderAtmosphereOption, ReaderMixerOptions } from "../../../audio-player"
import { ReaderSettingsAudio } from "../../../reader-ui"
import { narrationTracks } from "../../data"
import { SEN_SOUNDSCAPES_VOLUME_1 } from "../../senSoundscapes"
import {
    Button,
    ButtonRow,
    EventLog,
    MobileShell,
    Note,
    Panel,
    Readout,
    Segmented,
    ShellPanel,
    SplitLayout,
    WidthFrame,
    parseStageWidth,
    useEventLog,
} from "../../workshop/ui"
import type { ShellTab } from "../../workshop/ui"
import "./reader-face.css"

/* The narrator face SEN's reader ships, and the Reader Settings it opens:
   the floating music note (tap mutes, hold opens a quick master volume) over
   the chapter, and the gear's Text / Audio / Narration sheet whose Audio page
   is ReaderSettingsAudio. Text and Narration belong to SEN's reader, so here
   they only say so. The page never saves settings. */

const CELESTIAL = "https://celestialaudio.seihouse.org/DEFAULT"

const ATMOSPHERES: ReaderAtmosphereOption[] = [
    ["gentle-rain", "Gentle rain", "Weather", "Rain/Gentle_Rain_1.mp3"],
    ["heavy-rain", "Heavy rain", "Weather", "Rain/Heavy_Rain_1.mp3"],
    ["gentle-wind", "Gentle wind", "Weather", "Wind/Gentle_Wind_1.mp3"],
    ["forest", "Forest", "Places", "Noise/Forest_1.mp3"],
    ["village", "Village", "Places", "Noise/Village_1.mp3"],
    ["cave", "Cave", "Places", "Noise/Cave_1.mp3"],
].map(([id, label, group, path]) => ({
    id,
    label,
    group,
    sources: [{ url: `${CELESTIAL}/atmosphere/${path}` }],
}))

/** SEN's own starting mix (host/reader/readerMixer.ts, HOST_DEFAULT_MIX). */
const SEN_DEFAULT_MIX = {
    ...DEFAULT_READER_MIXER_PREFERENCES,
    masterEnabled: true,
    masterMuted: false,
    masterLevel: 1,
    layers: {
        ...DEFAULT_READER_MIXER_PREFERENCES.layers,
        soundscapes: { enabled: true, level: 0.25 },
        atmosphere: { enabled: true, level: 0.6 },
        cues: { enabled: true, level: 1 },
    },
    atmosphereId: "gentle-rain",
}

const SCORE =
    SEN_SOUNDSCAPES_VOLUME_1.find((score) => score.category === "Ambient") ??
    SEN_SOUNDSCAPES_VOLUME_1[0]

/** SEN's reader ducks the music this much while it reads aloud (useReaderSoundtrack.ts). */
const LISTEN_DUCK = 0.25

type Section = "text" | "audio" | "narration"

/** Phone sections, switched in place by the shell's pill dock. */
const SHELL_TABS: readonly ShellTab[] = [
    { id: "face", label: "Reader" },
    { id: "controls", label: "Controls" },
    { id: "state", label: "State" },
]

/** Duck the music and keep the mixer awake while narration speaks, as SEN's reader does. */
function NarrationDuck() {
    const mixer = useReaderMixer()
    const { isPlaying } = useAudioSession()
    useEffect(() => {
        if (!isPlaying) return undefined
        const duck = mixer.retainDuck()
        duck.setDuck(LISTEN_DUCK)
        const releaseActivity = mixer.retainActivity()
        return () => {
            duck.release()
            releaseActivity()
        }
    }, [mixer, isPlaying])
    return null
}

function GearIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

/** The Reader Settings sheet, as SEN's reader composes it around the shared Audio page. */
function ReaderSettingsSheet({
    section,
    onSection,
    onClose,
}: {
    section: Section
    onSection: (section: Section) => void
    onClose: () => void
}) {
    return (
        <SEITabs
            value={section}
            onValueChange={(value) => onSection(value as Section)}
            className="wk-rf-sheet sap-reader-settings"
        >
            <div
                role="dialog"
                aria-labelledby="wk-rf-settings-title"
                className="wk-rf-sheet__panel"
                onKeyDown={(event) => {
                    if (event.key === "Escape") onClose()
                }}
            >
                <div className="wk-rf-sheet__header">
                    <div className="wk-rf-sheet__heading">
                        <h2 id="wk-rf-settings-title">Reader Settings</h2>
                        <button
                            type="button"
                            className="wk-rf-icon"
                            aria-label="Close Reader Settings"
                            onClick={onClose}
                        >
                            <span aria-hidden>×</span>
                        </button>
                    </div>
                    <SEITabsList aria-label="Reader settings categories" className="wk-rf-tabs">
                        <SEITabsTrigger value="text" className="wk-rf-tab">
                            Text
                        </SEITabsTrigger>
                        <SEITabsTrigger value="audio" className="wk-rf-tab">
                            Audio
                        </SEITabsTrigger>
                        <SEITabsTrigger value="narration" className="wk-rf-tab">
                            Narration
                        </SEITabsTrigger>
                    </SEITabsList>
                </div>
                <div className="wk-rf-sheet__body">
                    <SEITabsPanel value="text" className="wk-rf-page">
                        <p className="sap-reader-settings__help">
                            Font, size, line spacing and weight belong to SEN&apos;s reader, not the
                            audio player, so they are not shown here.
                        </p>
                    </SEITabsPanel>
                    <SEITabsPanel value="audio" className="wk-rf-page">
                        <ReaderSettingsAudio />
                    </SEITabsPanel>
                    <SEITabsPanel value="narration" className="wk-rf-page">
                        <p className="sap-reader-settings__help">
                            Read-aloud voices and speed belong to SEN&apos;s reader (device speech),
                            not the audio player, so they are not shown here. Narration still ducks
                            the music through the mixer&apos;s Voice layer.
                        </p>
                    </SEITabsPanel>
                    <p className="sap-reader-settings__help wk-rf-saved">
                        In SEN, changes are saved on the device. This page keeps them until you
                        leave it.
                    </p>
                </div>
            </div>
        </SEITabs>
    )
}

function ReaderStage({ append }: { append: ReturnType<typeof useEventLog>["append"] }) {
    const [settings, setSettings] = useState(false)
    const [section, setSection] = useState<Section>("audio")
    return (
        <div className="wk-rf" data-settings={settings}>
            <div className="wk-rf__reader">
                <header className="wk-rf__bar">
                    <span className="wk-rf__chapter">Chapter 3 · The Physician&apos;s Room</span>
                    <button
                        type="button"
                        className="wk-rf-icon"
                        aria-label="Reader Settings"
                        aria-expanded={settings}
                        onClick={() => {
                            setSettings((open) => !open)
                            append("gear → Reader Settings")
                        }}
                    >
                        <GearIcon />
                    </button>
                </header>
                <article className="wk-rf__page" aria-label="Chapter">
                    <p>
                        The room smelled of old incense, and the copper basin had been filled up too
                        late. Yan Wu lay on a narrow bed, wrapped in linen that was already stained,
                        and did not look at it. He had learned long ago that wounds did not heal
                        faster, and that men did not need to watch them to die of it.
                    </p>
                    <p>
                        The physician came in with murky water in one hand and a lamp in the other.
                        Rain worked at the shutters. Somewhere below, the music of the house kept on
                        as though nothing in it had changed.
                    </p>
                    <p>
                        Tap the note to mute the story audio. Hold it, or focus it and press ↑, to
                        open the quick volume. The gear opens Reader Settings.
                    </p>
                </article>
                <div className="wk-rf__note">
                    <ReaderNoteFace />
                </div>
            </div>
            {settings && (
                <ReaderSettingsSheet
                    section={section}
                    onSection={setSection}
                    onClose={() => setSettings(false)}
                />
            )}
        </div>
    )
}

function HostControls({ append }: { append: ReturnType<typeof useEventLog>["append"] }) {
    const mixer = useReaderMixer()
    const state = useReaderMixerState()
    const session = useAudioSession()
    if (!state) return null
    const level = (value: number) => `${Math.round(value * 100)}%`
    return (
        <>
            <ShellPanel tab="controls">
                <Panel
                    title="Reader · what the app does"
                    hint="These buttons stand in for SEN's reader: it starts the chapter's score and atmosphere, and reads aloud."
                >
                    <ButtonRow>
                        <Button
                            onClick={() => {
                                mixer.playSoundscape(
                                    {
                                        id: SCORE.id,
                                        title: SCORE.title,
                                        artist: "SEN Soundscapes · Volume 1",
                                        audioFile: SCORE.url,
                                        loudness: SCORE.loudness,
                                    },
                                    { scene: "workshop-face" }
                                )
                                mixer.startAtmosphere()
                                append(`chapter opens → “${SCORE.title}” + atmosphere`)
                            }}
                        >
                            Open chapter
                        </Button>
                        <Button
                            onClick={() => {
                                session.toggle()
                                append(
                                    session.isPlaying ? "read-aloud paused" : "read-aloud speaks"
                                )
                            }}
                        >
                            {session.isPlaying ? "Pause narration" : "Play narration"}
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
                </Panel>
            </ShellPanel>
            <ShellPanel tab="state">
                <Panel title="Mixer state">
                    <Readout
                        label="Mixer"
                        rows={[
                            [
                                "Master",
                                `${state.preferences.masterEnabled ? "on" : "off"}${state.preferences.masterMuted ? " · muted by the note" : ""} · ${level(state.preferences.masterLevel ?? 1)}`,
                            ],
                            [
                                "Soundscapes",
                                `${state.layers.soundscapes.status} · ${level(state.layers.soundscapes.effectiveLevel)}`,
                            ],
                            [
                                "Atmosphere",
                                `${state.layers.atmosphere.status} · ${level(state.layers.atmosphere.effectiveLevel)}`,
                            ],
                            [
                                "Voice",
                                `${state.layers.voice.status} · ${level(state.layers.voice.effectiveLevel)}`,
                            ],
                            ["Preset", state.activePresetId ?? "custom"],
                            ["Needs a tap", state.needsGesture ? "yes" : "no"],
                        ]}
                    />
                </Panel>
            </ShellPanel>
        </>
    )
}

export function ReaderFaceWorkspace() {
    const { lines, append, clear } = useEventLog(40)
    const [stageWidth, setStageWidth] = useState("auto")
    const options = useMemo<ReaderMixerOptions>(
        () => ({ atmospheres: ATMOSPHERES, defaultPreferences: SEN_DEFAULT_MIX }),
        []
    )
    return (
        <ReaderMixerProvider options={options}>
            <AudioSessionProvider initialQueue={narrationTracks} audioBackend="html5">
                <ReaderMixerVoice />
                <NarrationDuck />
                <MobileShell tabs={SHELL_TABS}>
                    <SplitLayout
                        stage={
                            <>
                                <ShellPanel tab="face" fill>
                                    <WidthFrame width={parseStageWidth(stageWidth)}>
                                        <div className="wk-rf-frame">
                                            <ReaderStage append={append} />
                                        </div>
                                    </WidthFrame>
                                </ShellPanel>
                                <ShellPanel tab="state">
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
                                            empty="Open the chapter, then tap or hold the note."
                                        />
                                    </Panel>
                                </ShellPanel>
                            </>
                        }
                        controls={
                            <>
                                {/* A phone already shows the reader at its own width. */}
                                <div className="wk-shell-wide-only">
                                    <Panel title="Stage">
                                        <Segmented
                                            label="Reader width"
                                            value={stageWidth}
                                            options={[
                                                { value: "auto", label: "Auto" },
                                                { value: "390", label: "Phone" },
                                                { value: "768", label: "Tablet" },
                                            ]}
                                            onChange={setStageWidth}
                                        />
                                    </Panel>
                                </div>
                                <HostControls append={append} />
                                <ShellPanel tab="controls">
                                    <Note>
                                        This is the face SEN&apos;s reader ships: ReaderNoteFace
                                        from the main entry and ReaderSettingsAudio from the
                                        reader-ui entry. The older NarrativeFace bar is archived; no
                                        reader uses it.
                                    </Note>
                                </ShellPanel>
                            </>
                        }
                    />
                </MobileShell>
            </AudioSessionProvider>
        </ReaderMixerProvider>
    )
}
