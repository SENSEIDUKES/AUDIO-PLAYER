import { formatTime, useAudioSession, useAudioTime } from "../../../audio-player"

/* Plain test controls for the shared session. Deliberately undesigned: this is
   not a player face, just enough transport to drive the engine on a workspace
   while the new face is being designed. Everything reads and writes the session
   through the public hooks, exactly as a face would. */
export function TestControls({ label = "Test controls" }: { label?: string }) {
    const s = useAudioSession()
    const { currentTime, duration } = useAudioTime()
    const status = s.hasError
        ? `Can't play: ${s.errorMessage}`
        : s.isBuffering
          ? "Loading…"
          : s.isPlaying
            ? "Playing"
            : "Paused"

    return (
        <section className="wk-test-controls" aria-label={label}>
            <div className="wk-test-controls__head">
                <p className="wk-test-controls__label">{label}</p>
                <p className="wk-test-controls__track">
                    {s.currentTrack
                        ? `${s.currentTrack.title} — ${s.currentTrack.artist}`
                        : "Nothing loaded"}
                </p>
                <p className="wk-test-controls__status" role="status">
                    {status}
                </p>
            </div>
            <div className="wk-test-controls__row">
                <button
                    type="button"
                    className="wk-btn"
                    onClick={s.previous}
                    disabled={!s.canPrevious}
                >
                    Back
                </button>
                <button
                    type="button"
                    className="wk-btn wk-btn--primary"
                    onClick={s.toggle}
                    disabled={!s.currentTrack}
                >
                    {s.isPlaying ? "Pause" : "Play"}
                </button>
                <button type="button" className="wk-btn" onClick={s.next} disabled={!s.canNext}>
                    Next
                </button>
            </div>
            <label className="wk-test-controls__seek">
                <span className="wk-test-controls__time">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    disabled={!duration}
                    onChange={(event) => s.seek(Number(event.target.value))}
                    aria-label="Position"
                />
                <span className="wk-test-controls__time">{formatTime(duration)}</span>
            </label>
            <div className="wk-test-controls__row">
                <button type="button" className="wk-btn" onClick={s.toggleMute}>
                    {s.isMuted ? "Unmute" : "Mute"}
                </button>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={s.volume}
                    onChange={(event) => s.setVolume(Number(event.target.value))}
                    aria-label="Volume"
                />
            </div>
        </section>
    )
}
