import { AudioPlayerEngine, UseAudioPlayerOptions } from './types';
/**
 * Headless audio engine. Owns a playback backend (HTML5 `<audio>` element by
 * default, Web Audio API on request) and is the sole source of truth for
 * playback state. UI components read state and call actions; they never touch
 * the backend directly.
 *
 * Notable behavior:
 * - `currentTime` is driven by a single rAF loop while playing, and set
 *   explicitly on seek / pause / metadata. There is no second update path.
 * - When `src` changes, playback continues automatically if it was playing
 *   (track-change UX). The very first load only plays when `autoPlay` is set.
 * - Browsers block audible autoplay without a user gesture; `autoPlay` is a
 *   best-effort attempt, not a guarantee. When blocked, the engine exposes an
 *   `autoplayBlocked` flag so the UI can prompt the user for a tap.
 * - A monotonic `playbackToken` is bumped on every source / play-attempt
 *   boundary. Async callbacks captured before the swap check the token and
 *   no-op if it has changed, which removes the rapid-track-skip race.
 * - The backend is fixed at mount; remount (e.g. via `key`) to switch.
 */
export declare function useAudioPlayer(options: UseAudioPlayerOptions): AudioPlayerEngine;
//# sourceMappingURL=useAudioPlayer.d.ts.map