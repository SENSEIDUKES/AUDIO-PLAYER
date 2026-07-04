import { AudioPlayerEngine, RepeatMode, Track } from '../types';
export interface UseActivityLogRecordingOptions {
    engine: AudioPlayerEngine;
    currentTrack: Track | null;
    repeatMode: RepeatMode;
    shuffle: boolean;
    /** Optional prefix for track identifiers. */
    trackLabel?: string;
}
/**
 * Automatically records common lifecycle events to the activity log. Safe to
 * call from any component; does nothing if no ActivityLogProvider is mounted.
 *
 * Designed for use inside AudioSessionProvider or a skin component.
 */
export declare function useActivityLogRecording({ engine, currentTrack, repeatMode, shuffle, trackLabel, }: UseActivityLogRecordingOptions): void;
//# sourceMappingURL=useActivityLogRecording.d.ts.map