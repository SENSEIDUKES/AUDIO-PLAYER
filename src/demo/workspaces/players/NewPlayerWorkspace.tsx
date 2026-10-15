import { AudioSessionProvider } from "../../../audio-player"
import { TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Note,
    Panel,
    STAGE_WIDTH_OPTIONS,
    Segmented,
    SelectField,
    SplitLayout,
    WidthFrame,
    parseStageWidth,
} from "../../workshop/ui"
import { SessionReadout } from "../shared/session"
import { TestControls } from "../shared/TestControls"

/* The drafting table for the one new player face. The stage is empty on
   purpose: the v4 faces are archived (archive/faces-v4) and the new face is
   designed from scratch. The engine already runs underneath, so the face only
   has to read the shared session through the public hooks to play. */
export function NewPlayerWorkspace() {
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "no-luck")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "no-luck"
    const [widthParam, setWidth] = useWorkspaceParam("width", "auto")

    return (
        <AudioSessionProvider key={trackSetId} initialQueue={TRACK_SETS[trackSetId].tracks}>
            <SplitLayout
                stage={
                    <>
                        <WidthFrame width={parseStageWidth(widthParam)}>
                            <div className="wk-face-slot">
                                <p className="wk-face-slot__title">The new player goes here</p>
                                <p className="wk-face-slot__hint">
                                    One face, designed from scratch. Its variations come from
                                    settings on this one face, not separate players.
                                </p>
                            </div>
                        </WidthFrame>
                        <TestControls />
                    </>
                }
                controls={
                    <>
                        <Panel title="Stage">
                            <Segmented
                                label="Width"
                                value={widthParam}
                                options={STAGE_WIDTH_OPTIONS}
                                onChange={setWidth}
                            />
                            <SelectField
                                label="Tracks"
                                value={trackSetId}
                                options={TRACK_SET_OPTIONS}
                                onChange={setTrackSet}
                            />
                        </Panel>
                        <Panel title="What's playing">
                            <SessionReadout />
                        </Panel>
                        <Note>
                            The old faces are kept in archive/faces-v4 for reference. They are not
                            part of the package or this Workshop.
                        </Note>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
