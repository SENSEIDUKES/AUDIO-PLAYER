import { useAudioSession } from "../session/AudioSessionContext";

export interface QueueSurfaceProps {
  /** Optional cap on how many upcoming tracks to list. */
  maxItems?: number;
  className?: string;
}

/**
 * In-region "Up Next" surface (Apple-Music style), rendered inside the shared
 * surface region by the right surface button. Reads the shared session queue;
 * tap a row to jump to that track. This is intentionally lightweight — the full
 * drag-to-reorder/remove experience stays in the existing QueueDrawer overlay.
 */
export function QueueSurface({ maxItems, className }: QueueSurfaceProps) {
  const s = useAudioSession();
  const { queue, currentIndex } = s;
  const upcoming = queue
    .map((track, index) => ({ track, index }))
    .filter(({ index }) => index >= currentIndex);
  const items =
    typeof maxItems === "number" ? upcoming.slice(0, maxItems) : upcoming;

  return (
    <div
      className={`ap-queue-surface${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="Up next"
    >
      <div className="ap-queue-surface__head">Up next</div>
      {items.length === 0 ? (
        <div className="ap-queue-surface__empty">Queue is empty</div>
      ) : (
        <ul className="ap-queue-surface__list">
          {items.map(({ track, index }) => {
            const isCurrent = index === currentIndex;
            return (
              <li key={track.id ?? `${track.title}-${index}`}>
                <button
                  type="button"
                  className={`ap-queue-surface__row ap-tap${
                    isCurrent ? " ap-queue-surface__row--current" : ""
                  }`}
                  onClick={() => s.playTrack(index)}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`${isCurrent ? "Now playing:" : "Play"} ${track.title} by ${track.artist}`}
                >
                  <span className="ap-queue-surface__title" title={track.title}>
                    {track.title}
                  </span>
                  <span
                    className="ap-queue-surface__artist"
                    title={track.artist}
                  >
                    {track.artist}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default QueueSurface;
