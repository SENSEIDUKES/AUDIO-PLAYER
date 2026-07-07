import { CSSProperties } from 'react';
import { AudioPlayerTheme, BackgroundImage, MediaSource } from '../types';
export interface FullCardPlayerProps extends AudioPlayerTheme {
    /**
     * Show the volume slider. Defaults to `true` on desktop and `false` on
     * mobile/touch devices (e.g. iOS Safari), where programmatic volume is
     * ignored and the mute button is the reliable control. Pass an explicit
     * boolean to override the per-device default.
     */
    showVolume?: boolean;
    /**
     * Optional full-bleed background media (image or video) behind the card.
     * Off by default — the card looks unchanged unless this (or `backgroundImage`)
     * is set. Video renders muted/looping; the engine owns audio.
     */
    backgroundMedia?: MediaSource | null;
    /** Legacy background image. Superseded by `backgroundMedia` when both set. */
    backgroundImage?: BackgroundImage;
    /** Background blur in px (applied to the backdrop). Default 20. */
    blurSize?: number;
    /** Darken overlay over the backdrop, 0–100. Default 0. */
    darkenAmount?: number;
    /** Optional artwork media shown in the collapsed hero identity block. */
    artMedia?: MediaSource | null;
    /** Legacy CSS background-image string for the hero art (url/gradient). */
    art?: string;
    /** Inline typography for the title line. */
    titleFont?: CSSProperties;
    /** Inline typography for the artist line. */
    artistFont?: CSSProperties;
    className?: string;
    style?: CSSProperties;
}
/**
 * The rich "now playing" card, driven by the global session. Keeps the core
 * transport visible (prev / back 10 / play / fwd 10 / next); shuffle, repeat,
 * automix, queue, info, and share live in the SAP Controller behind the "…"
 * button. This skin is the designated owner of the autoplay-blocked prompt so
 * users don't see five simultaneous prompts.
 *
 * Capability-driven (`PLAYER_FACE_CAPABILITIES.fullCard`): the fully-wired face.
 * It hosts the SEICanvas (`supportsSEICanvas`), the ScrubberCanvas
 * (`supportsScrubberCanvas`), and the contextual radial menu
 * (`supportsContextualActions`, rendered via `PlayerSurfaceButtons`) — none of
 * these are hard-coded here; each render zone follows the model. The SAP
 * three-dot controller is always present for deep actions independent of those
 * capabilities.
 */
export declare function FullCardPlayer({ showVolume, backgroundMedia, backgroundImage, blurSize, darkenAmount, artMedia, art, titleFont, artistFont, className, style, ...theme }: FullCardPlayerProps): import("react").JSX.Element;
export default FullCardPlayer;
//# sourceMappingURL=FullCardPlayer.d.ts.map