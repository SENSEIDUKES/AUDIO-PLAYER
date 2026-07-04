import { Track } from '../types';
export interface QueueDrawerProps {
    /** The full queue (all tracks including the active one). */
    queue: Track[];
    /** Index of the currently playing track. */
    currentIndex: number;
    /** Whether the active track is currently playing. */
    isPlaying?: boolean;
    /** Whether the drawer is visible. */
    open: boolean;
    /** Close the drawer. */
    onClose: () => void;
    /** Jump to a track by index. */
    onPlayTrack: (index: number) => void;
    /** Reorder: move the item at `fromIndex` to `toIndex`. */
    onReorder: (fromIndex: number, toIndex: number) => void;
    /** Remove a track by index (no-op on the active track). */
    onRemove: (index: number) => void;
}
/**
 * An overlay drawer that shows the "Now Playing" track and "Up Next" tracks.
 * Supports:
 * - Drag-and-drop reorder of upcoming tracks
 * - Remove tracks from the queue (not the active track)
 * - Click-to-play any upcoming track
 * - Accessibility via ARIA roles and live announcements
 *
 * Designed to work with both the standalone AudioPlayer's local queue and the
 * global session's queue (via useAudioSession).
 */
export declare function QueueDrawer({ queue, currentIndex, isPlaying, open, onClose, onPlayTrack, onReorder, onRemove, }: QueueDrawerProps): import("react").JSX.Element | null;
export default QueueDrawer;
//# sourceMappingURL=QueueDrawer.d.ts.map