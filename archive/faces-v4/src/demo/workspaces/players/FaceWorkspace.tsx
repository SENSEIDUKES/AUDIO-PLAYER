import { useState } from "react"
import type { ReactNode } from "react"
import { AudioSessionProvider, getFaceCapability, getScrubberHeight } from "../../../audio-player"
import type { AudioPlayerPlugin } from "../../../audio-player"
import { TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { SchemaPanel } from "../../panel/SchemaPanel"
import { WORKSHOP_FACES, defaultWorkshopSettings } from "../../workshopFaces"
import type { FaceRenderOptions, WorkshopFaceId, WorkshopSettings } from "../../workshopFaces"
import { useWorkspaceParam } from "../../workshop/routing"
import {
    Note,
    Panel,
    RangeField,
    Readout,
    STAGE_WIDTH_OPTIONS,
    Segmented,
    SelectField,
    SplitLayout,
    Switch,
    TextField,
    WidthFrame,
    parseStageWidth,
} from "../../workshop/ui"
import { SessionReadout } from "../shared/session"

/* One workspace per player face. The live view is the real face (inside a
   shared session when the face needs one); the controls are the shared
   property registry panel, a track set, a test width, and whatever options are
   specific to that face. */

const NO_PLUGINS: readonly AudioPlayerPlugin[] = []

function yesNo(value: boolean | undefined): string {
    return value ? "Yes" : "No"
}

function CapabilityPanel({ faceId }: { faceId: WorkshopFaceId }) {
    const face = WORKSHOP_FACES.find((f) => f.id === faceId) ?? WORKSHOP_FACES[0]
    const cap = getFaceCapability(face.playerFace)
    const density = cap.scrubberDensity ?? "standard"
    return (
        <Panel
            title="Capabilities"
            hint="Declared by the package's face capability model — what this face can do, independent of screen size."
        >
            <Readout
                rows={[
                    ["Family", cap.family],
                    ["SEI Canvas", yesNo(cap.supportsSEICanvas)],
                    ["Own scrubber", yesNo(cap.supportsScrubberCanvas)],
                    ["Waveform scrubber", yesNo(cap.supportsWaveform)],
                    ["Radial action menu", yesNo(cap.supportsContextualActions)],
                    ["Action button", yesNo(cap.supportsAction)],
                    ["Hero collapse", yesNo(cap.supportsHeroCollapse)],
                    ["Canvas placement", cap.preferredCanvasPlacement ?? "none"],
                    ["Scrubber density", `${density} (${getScrubberHeight(density)}px)`],
                ]}
            />
        </Panel>
    )
}

export function FaceWorkspaceBase({
    faceId,
    options,
    extraControls,
    stageNote,
    defaultTrackSet = "no-luck",
}: {
    faceId: WorkshopFaceId
    options?: FaceRenderOptions
    extraControls?: ReactNode
    stageNote?: ReactNode
    defaultTrackSet?: string
}) {
    const face = WORKSHOP_FACES.find((f) => f.id === faceId) ?? WORKSHOP_FACES[0]
    const [settings, setSettings] = useState<WorkshopSettings>(defaultWorkshopSettings)
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", defaultTrackSet)
    const [widthParam, setWidth] = useWorkspaceParam("width", "auto")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "no-luck"
    const trackSet = TRACK_SETS[trackSetId]
    const width = parseStageWidth(widthParam)

    const preview = face.render({
        settings,
        tracks: trackSet.tracks,
        plugins: NO_PLUGINS,
        options,
    })

    // Shuffle, repeat, and auto play are *initial* options in the package (a
    // session or player reads them once), so changing them starts a fresh one.
    const sessionKey = [
        face.id,
        trackSetId,
        settings.shuffle,
        settings.repeatMode,
        settings.autoPlay,
        options?.single,
    ].join(":")

    const stage = face.sessionBased ? (
        <AudioSessionProvider
            key={sessionKey}
            initialQueue={trackSet.tracks}
            shuffle={settings.shuffle}
            repeatMode={settings.repeatMode}
            autoPlay={settings.autoPlay}
        >
            <div className="wk-stage-card">
                <WidthFrame width={width}>{preview}</WidthFrame>
            </div>
            {stageNote}
            <Panel title="Shared session">
                <SessionReadout />
            </Panel>
        </AudioSessionProvider>
    ) : (
        <>
            <div className="wk-stage-card" key={sessionKey}>
                <WidthFrame width={width}>{preview}</WidthFrame>
            </div>
            {stageNote}
        </>
    )

    return (
        <SplitLayout
            stage={stage}
            controls={
                <>
                    <Panel title="Test setup">
                        <SelectField
                            label="Tracks"
                            value={trackSetId}
                            options={TRACK_SET_OPTIONS}
                            onChange={setTrackSet}
                        />
                        <Note>{trackSet.note}</Note>
                        <Segmented
                            label="Container width"
                            options={STAGE_WIDTH_OPTIONS}
                            value={widthParam}
                            onChange={setWidth}
                        />
                        {extraControls}
                    </Panel>
                    <SchemaPanel
                        face={face}
                        settings={settings}
                        onChange={setSettings}
                        onReset={() => setSettings(defaultWorkshopSettings())}
                    />
                    <CapabilityPanel faceId={face.id} />
                </>
            }
        />
    )
}

/* ----------------------------- Per-face entries ----------------------------- */

export function PortablePlayerWorkspace() {
    const [single, setSingle] = useState(false)
    return (
        <FaceWorkspaceBase
            faceId="audio-player"
            options={{ single }}
            extraControls={
                <Switch
                    label="Single-track mode"
                    hint="Uses the title / artist / audioFile props instead of a playlist"
                    checked={single}
                    onChange={setSingle}
                />
            }
            stageNote={
                <Note>
                    This face runs its own engine, separate from any shared session. Focus it and
                    use Space, J, K, L for playback.
                </Note>
            }
        />
    )
}

export function FullCardWorkspace() {
    return (
        <FaceWorkspaceBase
            faceId="full-card"
            stageNote={
                <Note>
                    Tap the canvas button under the controls to open the SEI Canvas (the hero
                    collapses); the queue button opens Up Next. The “…” button opens the controller.
                </Note>
            }
        />
    )
}

export function SeaCardWorkspace() {
    const [cardCount, setCardCount] = useState(4)
    const [cardTag, setCardTag] = useState("SEA")
    return (
        <FaceWorkspaceBase
            faceId="sea-card"
            options={{ cardCount, cardTag }}
            extraControls={
                <>
                    <RangeField
                        label="Cards"
                        value={cardCount}
                        min={1}
                        max={6}
                        onChange={setCardCount}
                    />
                    <TextField label="Tag chip" value={cardTag} onChange={setCardTag} />
                </>
            }
            stageNote={
                <Note>
                    Every card plays its own track into one shared session, so starting a card jumps
                    the whole session to it.
                </Note>
            }
        />
    )
}

export function StickyBottomWorkspace() {
    const [stickyFixed, setStickyFixed] = useState(false)
    return (
        <FaceWorkspaceBase
            faceId="sticky-bottom"
            options={{ stickyFixed }}
            extraControls={
                <Switch
                    label="Pin to the bottom of the window"
                    hint="Production behavior (position: fixed)"
                    checked={stickyFixed}
                    onChange={setStickyFixed}
                />
            }
            stageNote={
                stickyFixed ? (
                    <Note>The bar is pinned to the bottom of this window while this is on.</Note>
                ) : undefined
            }
        />
    )
}

export function MiniSidebarWorkspace() {
    return (
        <FaceWorkspaceBase
            faceId="mini-sidebar"
            stageNote={
                <Note>
                    Compact faces have no scrubber of their own; skip and the rest of the actions
                    live in the radial menu and the “…” controller.
                </Note>
            }
        />
    )
}
