import type { AudioPlayerProps, AudioSpriteManifest, Track } from "../audio-player"

/* ----------------------------- OG Framer defaults ----------------------------- */
export const OG_DEFAULTS: AudioPlayerProps = {
    audioFile: "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
    backgroundColor: "rgba(255, 255, 255, 0)",
    accentColor: "#FFFFFF",
    textColor: "#FFFFFF",
    progressColor: "#000000",
    trackColor: "#CCCCCC",
    autoPlay: false,
    loop: false,
    title: "Audio Track",
    artist: "Artist Name",
    titleFont: {
        fontSize: "24px",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: "1.2em",
    },
    artistFont: {
        fontSize: "15px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        lineHeight: "1.3em",
    },
    playIconColor: "#000000",
    blurSize: 20,
    purchaseUrl: "",
    backgroundImage: {
        src: "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg",
    },
    darkenAmount: 45,
    lyrics: "",
    showTracklist: false,
}

export const SAMPLE = "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"
export const BROKEN = "https://example.com/this-track-does-not-exist.mp3"
export const OG_BG = "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg"

// All three share the same SAMPLE URL to validate the sourceKey fix:
// switching between First Light → Midnight Run → Aurora must reset
// currentTime, duration, and buffered even though the src is unchanged.
export const playlist: Track[] = [
    {
        id: "track-1",
        title: "First Light",
        artist: "SEIHouse",
        audioFile: SAMPLE,
        lyrics: "Verse one\nVerse two\nChorus line",
        purchaseUrl: "https://example.com/buy/first-light",
    },
    {
        id: "track-2",
        title: "Midnight Run",
        artist: "SEIHouse",
        audioFile: SAMPLE,
        lyrics: "Late night city glow\nNeon on the wall",
        purchaseUrl: "https://example.com/buy/midnight-run",
    },
    {
        id: "track-3",
        title: "Signal Lost",
        artist: "SEIHouse",
        audioFile: BROKEN,
        lyrics: "(unreachable)",
    },
    { id: "track-4", title: "Aurora", artist: "SEIHouse", audioFile: SAMPLE },
]

// Clean playlist (no broken track) so transitions actually fire back to back.
export const proPlaylist: Track[] = playlist.filter((t) => t.audioFile !== BROKEN)

// Truncation fixture: absurdly long title/artist prepended to the standard
// playlist so the width-matrix QA section exercises ellipsis everywhere.
export const stressPlaylist: Track[] = [
    {
        id: "stress-1",
        title: "An Extraordinarily Long Track Title That Should Truncate Gracefully (Extended Club Edit) [Remastered 2026]",
        artist: "SEIHouse feat. The Unreasonably Long Artist Collective Ensemble",
        audioFile: SAMPLE,
        lyrics: "Long-form lyrics line one\nLine two keeps going and going\nLine three for scroll testing\nLine four\nLine five\nLine six\nLine seven\nLine eight",
        purchaseUrl: "https://example.com/buy/stress",
    },
    ...playlist,
]

export const SEA_THEME = {
    accentColor: "#7C5CFF",
    progressColor: "#7C5CFF",
    trackColor: "rgba(124,92,255,0.25)",
    playIconColor: "#0b0b12",
    textColor: "#FFFFFF",
    backgroundColor: "rgba(20,20,28,0.6)",
}

export const SEA_ARTS = [
    "linear-gradient(135deg,#FF7AC6,#7C5CFF)",
    "linear-gradient(135deg,#22D3A6,#0EA5E9)",
    "linear-gradient(135deg,#F59E0B,#EF4444)",
    "linear-gradient(135deg,#A855F7,#EC4899)",
]

/* ----------------------------- Showcase release: No Luck ----------------------------- */
export const NO_LUCK_COVER =
    "https://images.seihouse.org/COVER%20ART/SENSEI%20-%20COVER%20ART/NO%20LUCK%20-%20COVER.JPG"

export const noLuckTracks: Track[] = [
    {
        id: "sea-nl-0101",
        title: "Angel Numbers",
        artist: "SENSEI",
        audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0101.wav",
    },
    {
        id: "sea-nl-0102",
        title: "Forces",
        artist: "SENSEI",
        audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0102.wav",
    },
    {
        id: "sea-nl-0103",
        title: "Heartbreak Hotel",
        artist: "SENSEI",
        audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0103.wav",
    },
    {
        id: "sea-nl-0104",
        title: "Tell Me",
        artist: "SENSEI",
        audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0104.wav",
    },
    {
        id: "sea-nl-0105",
        title: "I Am",
        artist: "SENSEI",
        audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0105.wav",
    },
    {
        id: "sea-nl-0106",
        title: "Message",
        artist: "SENSEI",
        audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0106.wav",
    },
]

// Skin `art` props take a CSS background-image value, not a bare URL.
export const NO_LUCK_ART = `url("${NO_LUCK_COVER}")`

/* ----------------------------- SEN narration: Library Help lines ----------------------------- */
/* Real spoken narration (Library's in-app help lines), used where a face or
   engine is about narration rather than music. Served without cross-origin
   headers: fine for playback, not for decoding. */
const HELP_LINES = "https://lines.seihouse.org/LIBRARY/Lines/SYSTEM/SYSTEM/HELP%20LINES"

export const narrationTracks: Track[] = [
    {
        id: "sen-help-story-seed",
        title: "Story Seed",
        artist: "Library Help · SEN",
        audioFile: `${HELP_LINES}/STORY%20SEED%20ENG.mp3`,
    },
    {
        id: "sen-help-premise",
        title: "Premise",
        artist: "Library Help · SEN",
        audioFile: `${HELP_LINES}/PREMISE%20ENG.mp3`,
    },
    {
        id: "sen-help-world",
        title: "World",
        artist: "Library Help · SEN",
        audioFile: `${HELP_LINES}/WORLD%20ENG.mp3`,
    },
    {
        id: "sen-help-arc",
        title: "Arc",
        artist: "Library Help · SEN",
        audioFile: `${HELP_LINES}/ARC%20ENG.mp3`,
    },
]

/* ----------------------------- Stand-in sprite pack ----------------------------- */
/* No real ambience or cue sound packs exist yet. These named clips are slices
   of the sample track (~48 s, served with cross-origin headers so Web Audio can
   decode it). They exist only so the ambience, ducking, crossfade, and sprite
   cue paths can be exercised; they are not production sounds. */
export const STAND_IN_SPRITE_PACK: AudioSpriteManifest = {
    src: SAMPLE,
    clips: {
        "rain-loop": { offset: 4, duration: 6, loop: true },
        "wind-loop": { offset: 16, duration: 6, loop: true },
        "tavern-loop": { offset: 28, duration: 6, loop: true },
        chime: { offset: 40, duration: 1.4 },
    },
}

export const STAND_IN_AMBIENCE_PROFILES = ["rain-loop", "wind-loop", "tavern-loop"] as const

/* ----------------------------- Track sets ----------------------------- */
export type TrackSetId = "no-luck" | "sample" | "long" | "automix" | "narration"

export interface TrackSet {
    label: string
    tracks: Track[]
    /** Honest one-liner about what this set can and cannot exercise. */
    note: string
}

export const TRACK_SETS: Record<TrackSetId, TrackSet> = {
    "no-luck": {
        label: "No Luck · SENSEI",
        tracks: noLuckTracks,
        note: "The real release (WAV). Plays everywhere; its host does not allow cross-site decoding, so waveforms and analysis fall back.",
    },
    sample: {
        label: "Sample playlist (includes a broken track)",
        tracks: playlist,
        note: "Short MP3s that allow decoding, plus one unreachable URL (“Signal Lost”) to exercise errors.",
    },
    long: {
        label: "Long titles (truncation)",
        tracks: stressPlaylist,
        note: "An extremely long title and artist first, then the sample playlist.",
    },
    automix: {
        label: "Automix-ready (clean samples)",
        tracks: proPlaylist,
        note: "The sample playlist without its broken track, so transitions fire back to back.",
    },
    narration: {
        label: "SEN narration (Library Help)",
        tracks: narrationTracks,
        note: "Spoken help lines from the Library app.",
    },
}

export const TRACK_SET_OPTIONS = (Object.keys(TRACK_SETS) as TrackSetId[]).map((id) => ({
    value: id,
    label: TRACK_SETS[id].label,
}))

export function isTrackSetId(value: string): value is TrackSetId {
    return value in TRACK_SETS
}
