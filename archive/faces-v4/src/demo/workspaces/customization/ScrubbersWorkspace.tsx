import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    ProgressBar,
    StickyBottomPlayer,
    formatTime,
    getScrubberDensity,
    getScrubberHeight,
    getVisualComponentsForSlot,
    useAudioSession,
    useAudioTime,
} from "../../../audio-player"
import type { PlayerFace } from "../../../audio-player"
import { SEA_THEME, TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import { Note, Panel, Readout, SelectField, SplitLayout } from "../../workshop/ui"
import { SessionReadout } from "../shared/session"

/* Scrubbers: every seek surface the faces use, side by side, all driving the
   same session (the portable player has its own engine). */

const FACES: readonly { face: PlayerFace; label: string }[] = [
    { face: "stickyBottom", label: "StickyBottomPlayer" },
    { face: "miniSidebar", label: "MiniSidebarPlayer" },
    { face: "vaultRow", label: "VaultRowPlayer" },
    { face: "fullCard", label: "FullCardPlayer" },
    { face: "seaCard", label: "SeaCardPlayer" },
    { face: "portable", label: "Portable AudioPlayer" },
]

function StandaloneProgress() {
    const s = useAudioSession()
    const { currentTime, duration, buffered } = useAudioTime()
    return (
        <>
            <div className="wk-progress-host" style={{ color: SEA_THEME.accentColor }}>
                <ProgressBar
                    currentTime={currentTime}
                    duration={duration}
                    buffered={buffered}
                    disabled={!s.hasAudio}
                    isSeeking={s.isSeeking}
                    onSeek={s.seek}
                    onSeekStart={() => s.setSeeking(true)}
                    onSeekEnd={() => s.setSeeking(false)}
                />
            </div>
            <Readout
                rows={[
                    ["Position", `${formatTime(currentTime)} / ${formatTime(duration)}`],
                    [
                        "Buffered ranges",
                        s.bufferedRanges.length
                            ? s.bufferedRanges
                                  .map((r) => `${formatTime(r.start)}–${formatTime(r.end)}`)
                                  .join(", ")
                            : "none yet",
                    ],
                    ["Seeking", s.isSeeking ? "yes" : "no"],
                ]}
            />
        </>
    )
}

export function ScrubbersWorkspace() {
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "sample")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "sample"
    const tracks = TRACK_SETS[trackSetId].tracks
    const scrubberVisuals = getVisualComponentsForSlot("scrubberCanvas")

    return (
        <AudioSessionProvider key={trackSetId} initialQueue={tracks}>
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                Standalone ProgressBar · wired to the session
                            </p>
                            <StandaloneProgress />
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                Compact · StickyBottomPlayer (the family's master scrubber)
                            </p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                Standard · FullCardPlayer (waveform when peaks load)
                            </p>
                            <FullCardPlayer {...SEA_THEME} />
                        </div>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                Expanded · Portable AudioPlayer (own engine)
                            </p>
                            <AudioPlayer tracks={tracks} repeatMode="all" {...SEA_THEME} />
                        </div>
                    </>
                }
                controls={
                    <>
                        <Panel title="Tracks">
                            <SelectField
                                label="Tracks"
                                value={trackSetId}
                                options={TRACK_SET_OPTIONS}
                                onChange={setTrackSet}
                            />
                            <Note>{TRACK_SETS[trackSetId].note}</Note>
                        </Panel>
                        <Panel title="Density by face" hint="From the face capability model.">
                            <Readout
                                rows={FACES.map(({ face, label }) => {
                                    const density = getScrubberDensity(face)
                                    return [
                                        label,
                                        `${density} · ${getScrubberHeight(density)}px`,
                                    ] as const
                                })}
                            />
                            <Note>
                                Compact faces other than the bar have no scrubber of their own; they
                                seek through the StickyBottom master.
                            </Note>
                        </Panel>
                        <Panel title="How to seek">
                            <Note>
                                Click or drag any bar (audio seeks on release). With a bar focused,
                                ←/→ move 5 s and Shift+←/→ move 30 s.
                            </Note>
                        </Panel>
                        <Panel title="ScrubberCanvas slot">
                            <Readout
                                rows={[
                                    ["Registered scrubber visuals", String(scrubberVisuals.length)],
                                ]}
                            />
                            <Note tone="placeholder">
                                The slot exists (waveform skins, lyric ribbons, and beat markers are
                                its intended use) but no component ships for it yet, so every face
                                falls back to its built-in scrubber.
                            </Note>
                        </Panel>
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
