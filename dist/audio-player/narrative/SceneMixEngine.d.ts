import { Track } from '../types';
/**
 * Default crossfade length for scene switches. Shorter than the music-player
 * `AUTOMIX_FADE_MS`: a narrative cue ("the boss appears") wants the score to
 * turn over in a couple of seconds, not a DJ-length blend.
 */
export declare const SCENE_FADE_MS = 2000;
export interface SceneMixEngineOptions {
    /** Loop every scene track. Defaults to true — scores are beds, not songs. */
    loop?: boolean;
    /** Default crossfade length in ms. Defaults to {@link SCENE_FADE_MS}. */
    fadeMs?: number;
}
export interface SceneCrossfadeOptions {
    /** Crossfade length for this switch only. */
    fadeMs?: number;
}
/**
 * Cue-driven two-deck crossfader for scene scores (reader BGM, ambient beds).
 *
 * `AutomixPlugin` blends playlist tracks at their natural *end*; a narrative
 * host instead needs "switch to this track *now*" mid-track, whenever the
 * story's mood changes. This engine reuses the same building blocks — an
 * equal-power cos/sin ramp on a wall-clock interval, deck parking at the
 * silence-trim start via the shared Automix Lite analysis, autoplay-rejection
 * and volume-locked-browser fallbacks — behind one imperative call:
 *
 * ```ts
 * const mix = createSceneMixEngine()
 * mix.setLevel(0.4)
 * mix.crossfadeTo({ id: "BOSS_1", title: "Boss 1", audioFile: url })
 * ```
 *
 * Headless by design: it renders nothing and owns detached `Audio` elements,
 * so a host can keep its existing UI untouched. Level/mute changes re-target
 * live (including mid-fade), matching how the Automix ramp re-reads the user
 * volume every tick.
 */
export declare class SceneMixEngine {
    private decks;
    private active;
    private level;
    private muted;
    private loop;
    private defaultFadeMs;
    private tickTimer;
    private disposed;
    constructor(options?: SceneMixEngineOptions);
    /** Key of the track currently owning the mix (fading in or steady). */
    getCurrentTrackKey(): string | null;
    /**
     * Set the effective output level (0..1) for the whole scene layer. The
     * host owns any composition (user volume × intensity × layer share) and
     * hands the result here; mid-fade changes re-target on the next tick.
     */
    setLevel(value: number): void;
    getLevel(): number;
    /** Mute/unmute without losing playback position or fade state. */
    setMuted(muted: boolean): void;
    getMuted(): boolean;
    /**
     * Crossfade the scene score to `track`. The incoming deck parks at the
     * track's silence-trim start (when analysis is available) so the fade
     * never runs through dead air. Calling again mid-fade retires every
     * audible deck toward silence and hands the mix to the newest track; a
     * repeat call for the already-active track is a no-op.
     */
    crossfadeTo(track: Track, options?: SceneCrossfadeOptions): void;
    /** Fade the whole scene layer to silence and release every deck. */
    stop(fadeMs?: number): void;
    dispose(): void;
    private retire;
    /** Bring a retiring deck back (the switch that displaced it fell through). */
    private unretire;
    /**
     * Advance every in-flight ramp along the equal-power curve and write the
     * composed gain to each element. Mirrors `AutomixPlugin.runRamp`: fade-in
     * follows sin(t·π/2), fade-out follows g₀·cos(t·π/2), and the write is
     * verified so volume-locked browsers latch the hard-swap fallback instead
     * of fading silently into nothing.
     */
    private tick;
    private applyGains;
    private applyDeckGain;
    private startTicking;
    private stopTicking;
    private releaseDeck;
}
export declare function createSceneMixEngine(options?: SceneMixEngineOptions): SceneMixEngine;
//# sourceMappingURL=SceneMixEngine.d.ts.map