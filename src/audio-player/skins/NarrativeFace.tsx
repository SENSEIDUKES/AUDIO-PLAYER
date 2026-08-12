import { useCallback } from "react"
import type { ChangeEvent, CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import type { AudioSpriteManifest } from "../core/audio/AudioSpriteEngine"
import { useAudioSession } from "../session/AudioSessionContext"
import { VolumeControl } from "../components/VolumeControl"
import { useNarrativeAudio, type NarrationState } from "../narrative/useNarrativeAudio"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon, DotsIcon } from "./icons"
import "./skins.css"

export type { NarrationState } from "../narrative/useNarrativeAudio"

export interface NarrativeFaceProps extends AudioPlayerTheme {
    /** Logical chapter id the reader app is on. Forwarded for host wiring. */
    chapterId?: string
    /** Scene mood label shown next to the soundscape indicator. */
    sceneMood?: string
    /** Ambience clip name within `ambienceManifest` to loop for this scene. */
    ambientProfile?: string
    /** Optional FX/music clip name within the manifest. */
    fxClip?: string
    /** Whether the FX clip loops. Defaults to false. */
    fxLoop?: boolean
    /** Packed ambience/FX clips. Without it, the face is narration-only. */
    ambienceManifest?: AudioSpriteManifest
    /** Narration phase hint. When omitted, derived from session playback. */
    narrationState?: NarrationState
    /** 0..1 — scales ambience level and duck depth. */
    intensity?: number
    /** Initial ambience level, 0..1. */
    ambienceVolume?: number
    /** Initial narration level, 0..1. */
    narrationVolume?: number
    /** How far ambience ducks under narration, 0..1. */
    duckAmount?: number
    /** Crossfade duration on mood/profile change, ms. */
    crossfadeMs?: number
    /** Render as a tiny fixed bottom overlay instead of an inline block. */
    embedded?: boolean
    /** Show the expand/settings affordance. */
    showExpand?: boolean
    /** Called when the expand/settings control is pressed. */
    onExpand?: () => void
    className?: string
    style?: CSSProperties
}

/**
 * A "faceless" SAP control surface for story/reader apps. It keeps the full SAP
 * audio engine underneath — narration on the shared session, ambience/FX on the
 * sprite layer (see {@link useNarrativeAudio}) — but presents only story-native
 * controls: a soundscape indicator, play/pause, mute, and ambience + narration
 * volume, with an optional expand/settings affordance.
 *
 * It deliberately renders none of the music-player chrome (no album art,
 * artwork, shuffle, repeat, queue, or waveform), per its `narrative`-family
 * capability declaration. Pass `embedded` to pin it as a tiny bottom overlay in
 * a reader. Scene metadata (`sceneMood`, `ambientProfile`, `intensity`, …) is
 * accepted as props so a host like the Light Novels app can feed scenes in
 * without the UI changing.
 */
export function NarrativeFace({
    chapterId,
    sceneMood,
    ambientProfile,
    fxClip,
    fxLoop,
    ambienceManifest,
    narrationState,
    intensity,
    ambienceVolume,
    narrationVolume,
    duckAmount,
    crossfadeMs,
    embedded = false,
    showExpand = false,
    onExpand,
    className,
    style,
    ...theme
}: NarrativeFaceProps) {
    const session = useAudioSession()
    const narrative = useNarrativeAudio({
        chapterId,
        sceneMood,
        ambientProfile,
        fxClip,
        fxLoop,
        ambienceManifest,
        narrationState,
        intensity,
        ambienceVolume,
        narrationVolume,
        duckAmount,
        crossfadeMs,
    })

    const handleAmbienceChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            narrative.setAmbienceVolume(Number(e.target.value) / 100)
        },
        [narrative]
    )

    const showSpinner = session.isBuffering
    const moodLabel = narrative.mood ?? "Ambience"

    return (
        <div
            className={`ap-nf${embedded ? " ap-nf--embedded" : ""} ap-nf--${narrative.indicatorState}${className ? ` ${className}` : ""}`}
            style={{ ...buildThemeVars(theme), ...style }}
            role="region"
            aria-label="Narration audio"
            data-chapter-id={chapterId}
        >
            {/* Soundscape indicator — a quiet mood dot + label, not a track. */}
            <div className="ap-nf__scape" title={`Soundscape: ${moodLabel}`}>
                <span className="ap-nf__dot" aria-hidden="true" />
                <span className="ap-nf__mood">{moodLabel}</span>
            </div>

            <button
                type="button"
                className={`ap-btn ap-btn--play ap-nf__play ap-tap${narrative.isPlaying ? " ap-btn--play-active" : ""}`}
                onClick={narrative.togglePlay}
                disabled={!narrative.hasNarration}
                aria-label={
                    showSpinner
                        ? "Buffering narration"
                        : narrative.isPlaying
                          ? "Pause narration"
                          : "Play narration"
                }
            >
                {showSpinner ? <SpinnerIcon /> : narrative.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Narration level + mute (the reused VolumeControl bundles both). */}
            <div className="ap-nf__vol ap-nf__vol--narration">
                <span className="ap-nf__vol-label" aria-hidden="true">
                    Voice
                </span>
                <VolumeControl
                    volume={narrative.narrationVolume}
                    isMuted={narrative.isMuted}
                    disabled={!narrative.hasNarration}
                    volumeUnsupported={session.volumeUnsupported}
                    onVolumeChange={narrative.setNarrationVolume}
                    onToggleMute={narrative.toggleMute}
                />
            </div>

            {/* Ambience level — a plain slider; ambience has no mute of its own. */}
            <label className="ap-nf__vol ap-nf__vol--ambience">
                <span className="ap-nf__vol-label">Ambience</span>
                <input
                    className="ap-nf__range"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(narrative.ambienceVolume * 100)}
                    disabled={!narrative.hasAmbience}
                    onChange={handleAmbienceChange}
                    aria-label="Ambience volume"
                />
            </label>

            {showExpand && (
                <button
                    type="button"
                    className="ap-icon-btn ap-nf__expand ap-tap"
                    onClick={onExpand}
                    aria-label="Soundscape settings"
                >
                    <DotsIcon />
                </button>
            )}
        </div>
    )
}

export default NarrativeFace
