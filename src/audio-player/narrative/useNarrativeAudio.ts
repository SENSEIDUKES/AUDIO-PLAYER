import { useCallback, useEffect, useRef, useState } from "react"
import { useAudioSession } from "../session/AudioSessionContext"
import {
    createAudioSpriteEngine,
    type AudioSpriteEngine,
    type AudioSpriteInstanceId,
    type AudioSpriteManifest,
} from "../core/audio/AudioSpriteEngine"

/** Narration playback phase the host (reader app) can drive or observe. */
export type NarrationState = "idle" | "playing" | "paused"

/** Coarse soundscape activity for the face's indicator dot. */
export type SoundscapeIndicatorState = "silent" | "ambient" | "narrating"

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
}

export interface UseNarrativeAudioOptions {
    /** Logical chapter id — used only for change detection / host wiring. */
    chapterId?: string
    /** Current scene mood label (e.g. "rain", "battle"). Drives crossfades. */
    sceneMood?: string
    /** Ambience clip name within `ambienceManifest` to loop for this scene. */
    ambientProfile?: string
    /** Optional one-shot/loop FX or music clip name within the manifest. */
    fxClip?: string
    /** Whether the FX clip loops. Defaults to false (one-shot). */
    fxLoop?: boolean
    /** Packed ambience/FX clips. Without it, the hook is narration-only. */
    ambienceManifest?: AudioSpriteManifest
    /** Narration phase hint. When omitted, derived from session playback. */
    narrationState?: NarrationState
    /** 0..1 — scales ambience level and duck depth. Defaults to 1. */
    intensity?: number
    /** Target ambience level, 0..1. Defaults to 0.6. */
    ambienceVolume?: number
    /** Target narration level, 0..1. Defaults to the current session volume. */
    narrationVolume?: number
    /** How far to duck ambience under narration, 0..1. Defaults to 0.6. */
    duckAmount?: number
    /** Crossfade duration for mood/profile changes, ms. Defaults to 1200. */
    crossfadeMs?: number
}

export interface NarrativeAudioController {
    /** Whether narration is currently playing. */
    isPlaying: boolean
    /** Whether narration is muted. */
    isMuted: boolean
    /** Whether a narration track is loaded and controllable. */
    hasNarration: boolean
    /** Whether an ambience layer is active (manifest loaded + profile playing). */
    hasAmbience: boolean
    /** Current scene mood label (echoed for the indicator). */
    mood: string | undefined
    /** Coarse activity for the soundscape indicator. */
    indicatorState: SoundscapeIndicatorState
    /** Current ambience level, 0..1. */
    ambienceVolume: number
    /** Current narration level, 0..1. */
    narrationVolume: number
    /** Toggle narration play/pause via the shared session. */
    togglePlay: () => void
    /** Toggle narration mute via the shared session. */
    toggleMute: () => void
    /** Set the ambience layer level (drives the sprite master gain). */
    setAmbienceVolume: (value: number) => void
    /** Set the narration level (drives the session volume). */
    setNarrationVolume: (value: number) => void
}

/**
 * Headless orchestrator for the Narrative face. It layers three audio sources
 * over existing SAP primitives without changing engine behavior:
 *
 * - **Narration / voice** → the shared global session (`useAudioSession`). The
 *   current session track is the narration; play/pause/mute/volume all route to
 *   it, so any other SAP face stays in sync.
 * - **Ambience loop + FX** → a private `AudioSpriteEngine`. The `ambientProfile`
 *   names a looping clip in `ambienceManifest`; `fxClip` is an optional extra
 *   layer.
 *
 * Behaviors it wires for story playback:
 * - **Ducking** — while narration plays, ambience fades to
 *   `ambienceVolume * (1 - duckAmount)` (scaled by `intensity`), and restores on
 *   pause.
 * - **Crossfade** — when `sceneMood`/`ambientProfile` changes, the old ambience
 *   instance fades out (and stops) while the new clip fades in.
 *
 * With no `ambienceManifest`, ambience is inert and the face is a narration-only
 * transport. The reader app feeds scene metadata in via the options; the UI does
 * not need to change.
 */
export function useNarrativeAudio(
    options: UseNarrativeAudioOptions = {}
): NarrativeAudioController {
    const {
        sceneMood,
        ambientProfile,
        fxClip,
        fxLoop = false,
        ambienceManifest,
        narrationState,
        intensity = 1,
        ambienceVolume: ambienceVolumeProp = 0.6,
        narrationVolume: narrationVolumeProp,
        duckAmount = 0.6,
        crossfadeMs = 1200,
    } = options

    const session = useAudioSession()

    // The sprite engine is created lazily on first use (it needs a user gesture
    // for the AudioContext) and disposed on unmount.
    const engineRef = useRef<AudioSpriteEngine | null>(null)
    const ambienceIdRef = useRef<AudioSpriteInstanceId | null>(null)
    const fxIdRef = useRef<AudioSpriteInstanceId | null>(null)
    // Tracks the manifest src currently loaded so we only reload on change.
    const loadedSrcRef = useRef<string | null>(null)

    const [ambienceVolume, setAmbienceVolumeState] = useState(clamp01(ambienceVolumeProp))

    // Keep local ambience level in sync when the host drives it via props, so it
    // behaves like the narration volume passthrough below (host wins on change).
    useEffect(() => {
        setAmbienceVolumeState(clamp01(ambienceVolumeProp))
    }, [ambienceVolumeProp])

    const getEngine = useCallback((): AudioSpriteEngine => {
        if (!engineRef.current) engineRef.current = createAudioSpriteEngine()
        return engineRef.current
    }, [])

    // Effective levels factor in the global intensity dial.
    const targetAmbience = clamp01(ambienceVolume * clamp01(intensity))
    const isNarrating =
        narrationState === "playing" || (narrationState === undefined && session.isPlaying)
    const duckedAmbience = clamp01(targetAmbience * (1 - clamp01(duckAmount) * clamp01(intensity)))
    const liveAmbienceTarget = isNarrating ? duckedAmbience : targetAmbience

    // ---- Ambience manifest load + profile crossfade ----------------------
    useEffect(() => {
        const src = ambienceManifest?.src?.trim()
        if (!src) {
            // No manifest: tear down any prior ambience layer.
            const engine = engineRef.current
            if (engine) {
                if (ambienceIdRef.current) engine.fadeOut(ambienceIdRef.current, crossfadeMs)
                if (fxIdRef.current) engine.stop(fxIdRef.current)
            }
            ambienceIdRef.current = null
            fxIdRef.current = null
            loadedSrcRef.current = null
            return
        }

        const engine = getEngine()
        let cancelled = false

        const run = async () => {
            if (loadedSrcRef.current !== src) {
                loadedSrcRef.current = src
                try {
                    await engine.load(ambienceManifest!)
                } catch {
                    // A superseding load or a bad pack: leave ambience silent.
                    loadedSrcRef.current = null
                    return
                }
            } else {
                await engine.ready()
            }
            if (cancelled) return

            engine.setMasterVolume(1)

            // Crossfade the ambience loop to the new profile.
            if (ambientProfile) {
                const previous = ambienceIdRef.current
                const next = engine.play(ambientProfile, { loop: true, volume: 0 })
                if (next) {
                    ambienceIdRef.current = next
                    engine.fade(next, liveAmbienceTarget, crossfadeMs)
                } else {
                    ambienceIdRef.current = null
                }
                // Retire the old loop unconditionally — even if the new clip is
                // missing from the manifest (play returned null), the prior
                // scene's ambience must not keep looping under the new scene.
                if (previous) engine.fadeOut(previous, crossfadeMs)
            } else if (ambienceIdRef.current) {
                engine.fadeOut(ambienceIdRef.current, crossfadeMs)
                ambienceIdRef.current = null
            }

            // (Re)trigger the FX layer for this scene, starting at the live
            // (possibly ducked) target so it matches the ambience level when
            // narration is already playing.
            if (fxIdRef.current) {
                engine.stop(fxIdRef.current)
                fxIdRef.current = null
            }
            if (fxClip) {
                fxIdRef.current = engine.play(fxClip, {
                    loop: fxLoop,
                    volume: liveAmbienceTarget,
                })
            }
        }

        void run()
        return () => {
            cancelled = true
        }
        // Intensity/volume changes are applied by the ducking effect below; this
        // effect only re-runs when the *scene* (manifest/profile/mood/fx) changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ambienceManifest?.src, ambientProfile, sceneMood, fxClip, fxLoop])

    // ---- Live ducking + ambience level -----------------------------------
    useEffect(() => {
        const engine = engineRef.current
        if (!engine) return
        // Short fade so ducking feels responsive but not abrupt. Both layers
        // track the same level so a looping FX bed ducks/adjusts with ambience.
        if (ambienceIdRef.current) {
            engine.fade(ambienceIdRef.current, liveAmbienceTarget, 350)
        }
        if (fxIdRef.current) {
            engine.fade(fxIdRef.current, liveAmbienceTarget, 350)
        }
    }, [liveAmbienceTarget])

    // ---- Narration volume passthrough -------------------------------------
    useEffect(() => {
        if (narrationVolumeProp === undefined) return
        session.setVolume(clamp01(narrationVolumeProp))
    }, [narrationVolumeProp, session])

    // ---- Cleanup ----------------------------------------------------------
    useEffect(() => {
        return () => {
            engineRef.current?.dispose()
            engineRef.current = null
            ambienceIdRef.current = null
            fxIdRef.current = null
        }
    }, [])

    const setAmbienceVolume = useCallback((value: number) => {
        setAmbienceVolumeState(clamp01(value))
    }, [])

    const setNarrationVolume = useCallback(
        (value: number) => session.setVolume(clamp01(value)),
        [session]
    )

    const hasAmbience = Boolean(ambienceManifest?.src?.trim()) && Boolean(ambientProfile)
    const indicatorState: SoundscapeIndicatorState = isNarrating
        ? "narrating"
        : hasAmbience
          ? "ambient"
          : "silent"

    return {
        isPlaying: session.isPlaying,
        isMuted: session.isMuted,
        hasNarration: session.hasAudio,
        hasAmbience,
        mood: sceneMood,
        indicatorState,
        ambienceVolume,
        narrationVolume: session.volume,
        togglePlay: session.toggle,
        toggleMute: session.toggleMute,
        setAmbienceVolume,
        setNarrationVolume,
    }
}
