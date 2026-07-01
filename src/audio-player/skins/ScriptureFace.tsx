import { useCallback } from "react"
import type { ChangeEvent, CSSProperties } from "react"
import type { AudioPlayerTheme } from "../types"
import type { AudioSpriteManifest } from "../core/audio/AudioSpriteEngine"
import { useAudioSession } from "../session/AudioSessionContext"
import { VolumeControl } from "../components/VolumeControl"
import {
    useNarrativeAudio,
    type NarrationState,
} from "../narrative/useNarrativeAudio"
import { buildThemeVars } from "./themeVars"
import { PauseIcon, PlayIcon, SpinnerIcon, DotsIcon } from "./icons"
import "./skins.css"

export type { NarrationState } from "../narrative/useNarrativeAudio"

/**
 * SEIHOUSE brand defaults for the reading chamber: void glass, signal text,
 * portal-turquoise accent. Callers can still override any of these through
 * the normal `AudioPlayerTheme` props — this only supplies the face's
 * out-of-the-box identity so a Light Novels host doesn't have to re-declare
 * six hex codes to get the right look.
 */
const SCRIPTURE_THEME_DEFAULTS: AudioPlayerTheme = {
    accentColor: "#04ACFF",
    playIconColor: "#04121a",
    textColor: "#FAFAFA",
    progressColor: "#04ACFF",
    trackColor: "rgba(250, 250, 250, 0.16)",
    backgroundColor: "rgba(8, 9, 12, 0.72)",
    glowColor: "#04ACFF",
    glowIntensity: 70,
}

export interface ScriptureFaceProps extends AudioPlayerTheme {
    /** Logical chapter id the reader app is on. Forwarded for host wiring. */
    chapterId?: string
    /** Human chapter label shown in the eyebrow, e.g. "Chapter 12". Falls back
        to `chapterId` when omitted. */
    chapterLabel?: string
    /** Scene mood label shown next to the soundscape rune (e.g. "rain", "battle"). */
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
    /**
     * 0..1 — scene danger/climax level (e.g. from `cuePayload.danger` or a
     * death-flag block already detected upstream in the reader). Bleeds the
     * ambient portal-turquoise glow toward the brand's crimson accent so a
     * tense scene *feels* different without any extra markup in the chamber.
     * Defaults to 0 (pure portal glow).
     */
    danger?: number
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
 * The SEIHOUSE-branded reading-chamber face for the Light Novels app. Same
 * headless engine as {@link NarrativeFace} — narration rides the shared
 * session, ambience/FX ride the sprite layer via {@link useNarrativeAudio} —
 * but the chrome is built for the Scripture Meridian Chamber reader instead
 * of a generic dark-glass player: an Alegreya SC eyebrow, a holographic glass
 * panel that echoes the reader's own `.holographic-panel` treatment, and a
 * pulsing soundscape rune that bleeds from portal turquoise to crimson as
 * `danger` rises.
 *
 * It declares the same `narrative`-family capability contract as
 * `NarrativeFace` (see `faceCapabilities.ts`): no artwork, scrubber, queue, or
 * music chrome — just story-native controls sized to sit under or beside the
 * reading viewport.
 */
export function ScriptureFace({
    chapterId,
    chapterLabel,
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
    danger = 0,
    embedded = false,
    showExpand = false,
    onExpand,
    className,
    style,
    ...theme
}: ScriptureFaceProps) {
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

    const dangerLevel = Math.max(0, Math.min(1, danger))
    const showSpinner = session.isBuffering
    const moodLabel = narrative.mood ?? "Ambience"
    const eyebrow = chapterLabel ?? chapterId

    return (
        <div
            className={`ap-sf${embedded ? " ap-sf--embedded" : ""} ap-sf--${narrative.indicatorState}${className ? ` ${className}` : ""}`}
            style={{
                ...buildThemeVars({ ...SCRIPTURE_THEME_DEFAULTS, ...theme }),
                "--ap-sf-danger": dangerLevel,
                ...style,
            } as CSSProperties}
            role="region"
            aria-label="Scripture narration"
            data-chapter-id={chapterId}
        >
            <div className="ap-sf__head">
                {eyebrow && <span className="ap-sf__eyebrow">{eyebrow}</span>}
                <div className="ap-sf__scape" title={`Soundscape: ${moodLabel}`}>
                    <span className="ap-sf__rune" aria-hidden="true" />
                    <span className="ap-sf__mood">{moodLabel}</span>
                </div>
            </div>

            <div className="ap-sf__body">
                <button
                    type="button"
                    className={`ap-btn ap-btn--play ap-sf__play ap-tap${narrative.isPlaying ? " ap-btn--play-active" : ""}`}
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
                    {showSpinner ? (
                        <SpinnerIcon />
                    ) : narrative.isPlaying ? (
                        <PauseIcon />
                    ) : (
                        <PlayIcon />
                    )}
                </button>

                <div className="ap-sf__levels">
                    <div className="ap-sf__vol ap-sf__vol--narration">
                        <span className="ap-sf__vol-label" aria-hidden="true">
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

                    <label className="ap-sf__vol ap-sf__vol--ambience">
                        <span className="ap-sf__vol-label">Ambience</span>
                        <input
                            className="ap-sf__range"
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(narrative.ambienceVolume * 100)}
                            disabled={!narrative.hasAmbience}
                            onChange={handleAmbienceChange}
                            aria-label="Ambience volume"
                        />
                    </label>
                </div>

                {showExpand && (
                    <button
                        type="button"
                        className="ap-icon-btn ap-sf__expand ap-tap"
                        onClick={onExpand}
                        aria-label="Soundscape settings"
                    >
                        <DotsIcon />
                    </button>
                )}
            </div>
        </div>
    )
}

export default ScriptureFace
