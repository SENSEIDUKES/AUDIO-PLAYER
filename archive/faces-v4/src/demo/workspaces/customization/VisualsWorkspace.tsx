import {
    AudioSessionProvider,
    ControllerPanelRenderer,
    SEICanvasRenderer,
    StickyBottomPlayer,
    VisualSlotPicker,
    VisualSlotsProvider,
    getAllVisualComponents,
    useAudioSession,
    useVisualSlots,
} from "../../../audio-player"
import type { Track, VisualSlot } from "../../../audio-player"
import { SAMPLE, SEA_THEME, noLuckTracks } from "../../data"
import { Note, Panel, SplitLayout } from "../../workshop/ui"

/* SEI Canvas visuals: components registered into the player's visual slots.
   This is the same picker and settings panel the controller's Canvas screen
   shows, mounted directly so the canvas and its settings sit side by side. */

const LYRIC_TRACK: Track = {
    id: "visuals-lyrics",
    title: "Lyric Display test",
    artist: "Sample audio",
    audioFile: SAMPLE,
    lyrics: [
        "Rain found the archive windows",
        "Long before the lamps were lit",
        "Every page remembers something",
        "Every voice leaves something behind",
        "Turn the light down low",
        "Let the room keep time",
        "Hold the last line longer",
        "Then let the silence speak",
    ].join("\n"),
}

const SLOTS: readonly { slot: VisualSlot; label: string }[] = [
    { slot: "seiCanvas", label: "SEI Canvas" },
    { slot: "scrubberCanvas", label: "Scrubber Canvas" },
    { slot: "controllerPanel", label: "Controller Panel" },
]

function CanvasStage() {
    const s = useAudioSession()
    return (
        <div className="wk-canvas-stage">
            <SEICanvasRenderer lyrics={s.currentTrack?.lyrics ?? null} />
        </div>
    )
}

function ActiveSettings() {
    const s = useAudioSession()
    const { getActive } = useVisualSlots()
    const active = getActive("seiCanvas")
    if (!active) return <Note>No visual selected. Pick one above.</Note>
    return <ControllerPanelRenderer componentId={active} lyrics={s.currentTrack?.lyrics} />
}

function Registry() {
    const all = getAllVisualComponents()
    return (
        <div className="wk-table-wrap">
            <table className="wk-table">
                <thead>
                    <tr>
                        <th scope="col">Slot</th>
                        <th scope="col">Registered visuals</th>
                    </tr>
                </thead>
                <tbody>
                    {SLOTS.map(({ slot, label }) => {
                        const inSlot = all.filter((def) => def.slot === slot)
                        return (
                            <tr key={slot}>
                                <td>{label}</td>
                                <td>
                                    {inSlot.length
                                        ? inSlot
                                              .map(
                                                  (def) =>
                                                      `${def.name}${def.SettingsPanel ? "" : " (no settings)"}`
                                              )
                                              .join(", ")
                                        : "None yet"}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export function VisualsWorkspace() {
    return (
        <AudioSessionProvider initialQueue={[LYRIC_TRACK, ...noLuckTracks.slice(0, 2)]}>
            <VisualSlotsProvider>
                <SplitLayout
                    stage={
                        <>
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">SEI Canvas</p>
                                <CanvasStage />
                            </div>
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">Transport</p>
                                <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                            </div>
                            <Note>
                                Lyric Display has no timed lyric data here, so it estimates the
                                active line from playback progress. The No Luck tracks have no
                                lyrics, which shows its empty state.
                            </Note>
                        </>
                    }
                    controls={
                        <>
                            <Panel title="Choose visual">
                                <VisualSlotPicker slot="seiCanvas" />
                            </Panel>
                            <Panel
                                title="Visual settings"
                                hint="Edits flow straight into the live canvas."
                            >
                                <ActiveSettings />
                            </Panel>
                            <Panel title="Slot registry">
                                <Registry />
                            </Panel>
                            <Note tone="placeholder">
                                Sample Skin is an imported scaffold (npm run skin:import): its
                                settings panel is still a TODO. No components ship for the Scrubber
                                Canvas or Controller Panel slots yet.
                            </Note>
                        </>
                    }
                />
            </VisualSlotsProvider>
        </AudioSessionProvider>
    )
}
