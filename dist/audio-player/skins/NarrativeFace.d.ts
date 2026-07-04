import { CSSProperties } from 'react';
import { AudioPlayerTheme } from '../types';
import { AudioSpriteManifest } from '../core/audio/AudioSpriteEngine';
import { NarrationState } from '../narrative/useNarrativeAudio';
export type { NarrationState } from '../narrative/useNarrativeAudio';
export interface NarrativeFaceProps extends AudioPlayerTheme {
    /** Logical chapter id the reader app is on. Forwarded for host wiring. */
    chapterId?: string;
    /** Scene mood label shown next to the soundscape indicator. */
    sceneMood?: string;
    /** Ambience clip name within `ambienceManifest` to loop for this scene. */
    ambientProfile?: string;
    /** Optional FX/music clip name within the manifest. */
    fxClip?: string;
    /** Whether the FX clip loops. Defaults to false. */
    fxLoop?: boolean;
    /** Packed ambience/FX clips. Without it, the face is narration-only. */
    ambienceManifest?: AudioSpriteManifest;
    /** Narration phase hint. When omitted, derived from session playback. */
    narrationState?: NarrationState;
    /** 0..1 — scales ambience level and duck depth. */
    intensity?: number;
    /** Initial ambience level, 0..1. */
    ambienceVolume?: number;
    /** Initial narration level, 0..1. */
    narrationVolume?: number;
    /** How far ambience ducks under narration, 0..1. */
    duckAmount?: number;
    /** Crossfade duration on mood/profile change, ms. */
    crossfadeMs?: number;
    /** Render as a tiny fixed bottom overlay instead of an inline block. */
    embedded?: boolean;
    /** Show the expand/settings affordance. */
    showExpand?: boolean;
    /** Called when the expand/settings control is pressed. */
    onExpand?: () => void;
    className?: string;
    style?: CSSProperties;
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
export declare function NarrativeFace({ chapterId, sceneMood, ambientProfile, fxClip, fxLoop, ambienceManifest, narrationState, intensity, ambienceVolume, narrationVolume, duckAmount, crossfadeMs, embedded, showExpand, onExpand, className, style, ...theme }: NarrativeFaceProps): import("react").JSX.Element;
export default NarrativeFace;
//# sourceMappingURL=NarrativeFace.d.ts.map