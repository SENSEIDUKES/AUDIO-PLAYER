// Copy-paste examples for a consuming React application.
// This file is type-checked by `npm run test:docs`.

import { useEffect, useMemo } from "react"
import {
    AudioPlayer,
    AudioSessionProvider,
    NarrativeFace,
    ReaderMixerPanel,
    ReaderMixerProvider,
    ReaderMixerVoice,
    ReaderMixerNote,
    createAutomixPlugin,
    createKeyboardShortcutPlugin,
    StickyBottomPlayer,
    type Track,
    useAudioSession,
    useReaderMixer,
} from "@seihouse/audio-player"
import "@seihouse/audio-player/styles.css"

const tracks: Track[] = [
    {
        id: "track-1",
        title: "Song Title",
        artist: "Artist Name",
        artwork: "https://example.com/cover.jpg",
        audioFile: "https://example.com/audio.mp3",
    },
]

// One self-contained player. AudioPlayer owns its session internally.
export function StandalonePlayerExample() {
    return <AudioPlayer tracks={tracks} accentColor="#6366f1" backgroundColor="#0f172a" />
}

// One shared queue with custom controls and a skin. Every child uses the same
// audio element, playback state, and queue from AudioSessionProvider.
export function SharedSessionExample() {
    return (
        <AudioSessionProvider initialQueue={tracks}>
            <CustomPlayerControls />
            <StickyBottomPlayer />
        </AudioSessionProvider>
    )
}

// Recorded or generated TTS audio uses the same queue and the fourth mixer slot.
// Mount one Voice connection per narration session, alongside its visual controls.
export function ReaderMixerExample({ narration }: { narration: Track[] }) {
    return (
        <ReaderMixerProvider>
            <AudioSessionProvider initialQueue={narration} audioBackend="webaudio">
                <ReaderMixerVoice />
                <NarrativeFace />
                <ReaderMixerPanel />
            </AudioSessionProvider>
        </ReaderMixerProvider>
    )
}

// Host policy stays in SEN. Settings and note placement are host-owned.
export function ReaderChapterAudioExample({
    chapter,
    listenSpeaking,
    stopListen,
    openAudioSettings,
}: {
    chapter: { id: string; score: Track | null; cues: { url: string }[] }
    listenSpeaking: boolean
    stopListen: () => void
    openAudioSettings: () => void
}) {
    const mixer = useReaderMixer()
    useEffect(() => {
        mixer.setLayerAvailability({
            soundscapes: !!chapter.score,
            cues: chapter.cues.length > 0,
            atmosphere: true,
        })
        if (chapter.score) mixer.playSoundscape(chapter.score, { scene: chapter.id })
        else mixer.stopSoundscape()
        mixer.startAtmosphere()
        mixer.preloadCues(chapter.cues.map((cue) => cue.url))
    }, [mixer, chapter])
    // Required: leaving the reader cancels sleep, idle and rest state too.
    useEffect(() => () => mixer.stopAll(), [mixer])
    useEffect(() => mixer.subscribeSleep(stopListen), [mixer, stopListen])
    useEffect(() => {
        if (!listenSpeaking) return
        const releaseActivity = mixer.retainActivity()
        const duck = mixer.retainDuck()
        duck.setDuck(0.6)
        return () => {
            releaseActivity()
            duck.release()
        }
    }, [mixer, listenSpeaking])
    return (
        <>
            <ReaderMixerNote onOpenSettings={openAudioSettings} />
            {/* The host's chapter-end callback makes this same call. */}
            <button type="button" onClick={() => mixer.notifyChapterEnd()}>
                Chapter ended
            </button>
        </>
    )
}

function CustomPlayerControls() {
    const { isPlaying, currentTime, duration, pause, play, seek } = useAudioSession()

    return (
        <div className="custom-player">
            <button type="button" onClick={() => (isPlaying ? pause() : play())}>
                {isPlaying ? "Pause" : "Play"}
            </button>
            <input
                type="range"
                aria-label="Seek within track"
                min={0}
                max={Math.max(duration, 0)}
                value={currentTime}
                onChange={(event) => seek(Number(event.target.value))}
            />
            <span>
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
            </span>
        </div>
    )
}

// Plugins are lifecycle objects, so keep their array stable across renders.
export function PluginExample() {
    const plugins = useMemo(
        () => [
            createAutomixPlugin({ confidenceMin: 0.6 }),
            createKeyboardShortcutPlugin({ scope: "document" }),
        ],
        []
    )

    return <AudioPlayer tracks={tracks} plugins={plugins} />
}
