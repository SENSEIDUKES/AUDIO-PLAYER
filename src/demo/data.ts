import type { AudioPlayerProps, Track } from "../audio-player"

/* ----------------------------- OG Framer defaults ----------------------------- */
export const OG_DEFAULTS: AudioPlayerProps = {
    audioFile:
        "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3",
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

export const SAMPLE =
    "https://framerusercontent.com/assets/8w3IUatLX9a5JVJ6XPCVuHi94.mp3"
export const BROKEN = "https://example.com/this-track-does-not-exist.mp3"
export const OG_BG =
    "https://framerusercontent.com/images/GfGkADagM4KEibNcIiRUWlfrR0.jpg"

// All three share the same SAMPLE URL to validate the sourceKey fix:
// switching between First Light → Midnight Run → Aurora must reset
// currentTime, duration, and buffered even though the src is unchanged.
export const playlist: Track[] = [
    { id: "track-1", title: "First Light", artist: "SEIHouse", audioFile: SAMPLE, lyrics: "Verse one\nVerse two\nChorus line", purchaseUrl: "https://example.com/buy/first-light" },
    { id: "track-2", title: "Midnight Run", artist: "SEIHouse", audioFile: SAMPLE, lyrics: "Late night city glow\nNeon on the wall", purchaseUrl: "https://example.com/buy/midnight-run" },
    { id: "track-3", title: "Signal Lost", artist: "SEIHouse", audioFile: BROKEN, lyrics: "(unreachable)" },
    { id: "track-4", title: "Aurora", artist: "SEIHouse", audioFile: SAMPLE },
]

// Clean playlist (no broken track) so transitions actually fire back to back.
export const proPlaylist: Track[] = playlist.filter((t) => t.audioFile !== BROKEN)

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
    { id: "sea-nl-0101", title: "Angel Numbers", artist: "SENSEI", audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0101.wav" },
    { id: "sea-nl-0102", title: "Forces", artist: "SENSEI", audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0102.wav" },
    { id: "sea-nl-0103", title: "Heartbreak Hotel", artist: "SENSEI", audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0103.wav" },
    { id: "sea-nl-0104", title: "Tell Me", artist: "SENSEI", audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0104.wav" },
    { id: "sea-nl-0105", title: "I Am", artist: "SENSEI", audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0105.wav" },
    { id: "sea-nl-0106", title: "Message", artist: "SENSEI", audioFile: "https://audio.seihouse.org/SEA-NL/SEA-NL-0106.wav" },
]

// Skin `art` props take a CSS background-image value, not a bare URL.
export const NO_LUCK_ART = `url("${NO_LUCK_COVER}")`
