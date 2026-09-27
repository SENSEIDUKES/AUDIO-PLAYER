import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, FlaskConical, Plus, Smartphone, X } from "lucide-react"
import { AudioSessionProvider } from "../../../audio-player"
import type { WorkspaceRoute } from "../../../audio-player"
import { NO_LUCK_ART, TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { handleLinkClick, useWorkspaceParam, workspaceHref } from "../../workshop/routing"
import {
    Button,
    ButtonRow,
    EventLog,
    Note,
    Panel,
    STAGE_WIDTH_OPTIONS,
    Segmented,
    SelectField,
    SplitLayout,
    Switch,
    TextField,
    WidthFrame,
    parseStageWidth,
    useEventLog,
} from "../../workshop/ui"
import { ComposedFace } from "../shared/ComposedFace"
import {
    BLANK_FACE,
    INTERACTION_CHOICES,
    LAYOUT_CHOICES,
    MAX_PIECES,
    PIECES,
    PIECE_ORDER,
    STARTERS,
    addPiece,
    decodeFace,
    encodeFace,
    movePiece,
    pieceOption,
    removePiece,
    setInteractions,
    setLayout,
    setPieceOption,
    setPieceText,
} from "../shared/faceSpec"
import type { FaceSpec, PieceInstance } from "../shared/faceSpec"
import { SessionController, SessionReadout } from "../shared/session"
import { themeFor } from "../shared/themes"

/* New Face: start from a blank surface, assemble the package's building blocks
   in any order, try different gestures, and take the result into the Testing
   Lab's app shell. The whole face lives in the link (`?face=`), so it can be
   shared, reopened, and loaded by the Lab's preview pages. */

const DRAFT_KEY = "seihouse-audio-player:new-face:draft:v1"

function readDraft(): string {
    try {
        return localStorage.getItem(DRAFT_KEY) ?? ""
    } catch {
        return ""
    }
}

function writeDraft(value: string): void {
    try {
        localStorage.setItem(DRAFT_KEY, value)
    } catch {
        // Storage can be blocked; the link still holds the face.
    }
}

function PieceRow({
    piece,
    index,
    count,
    onChange,
}: {
    piece: PieceInstance
    index: number
    count: number
    onChange: (update: (spec: FaceSpec) => FaceSpec) => void
}) {
    const definition = PIECES[piece.kind]
    const name = `${definition.label} (${index + 1})`
    return (
        <li className="wk-piece-row" aria-label={name}>
            <div className="wk-piece-row__head">
                <span className="wk-piece-row__name">
                    <span className="wk-piece-row__index">{index + 1}</span>
                    {definition.label}
                </span>
                <span className="wk-piece-row__actions">
                    <button
                        type="button"
                        className="wk-icon-btn"
                        onClick={() => onChange((spec) => movePiece(spec, piece.id, -1))}
                        disabled={index === 0}
                        aria-label={`Move ${name} up`}
                    >
                        <ArrowUp size={14} />
                    </button>
                    <button
                        type="button"
                        className="wk-icon-btn"
                        onClick={() => onChange((spec) => movePiece(spec, piece.id, 1))}
                        disabled={index === count - 1}
                        aria-label={`Move ${name} down`}
                    >
                        <ArrowDown size={14} />
                    </button>
                    <button
                        type="button"
                        className="wk-icon-btn wk-icon-btn--danger"
                        onClick={() => onChange((spec) => removePiece(spec, piece.id))}
                        aria-label={`Remove ${name}`}
                    >
                        <X size={14} />
                    </button>
                </span>
            </div>
            {(Object.keys(definition.options).length > 0 || piece.kind === "text") && (
                <div className="wk-piece-row__options">
                    {piece.kind === "text" && (
                        <TextField
                            label="Words"
                            value={piece.text ?? ""}
                            onChange={(text) =>
                                onChange((spec) => setPieceText(spec, piece.id, text))
                            }
                        />
                    )}
                    {Object.entries(definition.options).map(([key, option]) => (
                        <SelectField
                            key={key}
                            label={option.label}
                            value={pieceOption(piece, key)}
                            options={option.values}
                            onChange={(value) =>
                                onChange((spec) => setPieceOption(spec, piece.id, key, value))
                            }
                        />
                    ))}
                </div>
            )}
        </li>
    )
}

export function NewFaceWorkspace() {
    const [faceParam, setFaceParam] = useWorkspaceParam("face", "")
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "no-luck")
    const [widthParam, setWidth] = useWorkspaceParam("width", "auto")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "no-luck"
    const spec = useMemo(() => decodeFace(faceParam), [faceParam])
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    const [draft] = useState(readDraft)
    const { lines, append, clear } = useEventLog(40)

    const change = (update: (current: FaceSpec) => FaceSpec) =>
        setFaceParam(encodeFace(update(spec)))

    // Keep the latest face as a local draft, so leaving never loses it.
    useEffect(() => {
        if (faceParam) writeDraft(faceParam)
    }, [faceParam])

    const art = trackSetId === "no-luck" ? NO_LUCK_ART : undefined
    const full = spec.pieces.length >= MAX_PIECES
    const labParams = (extra: Record<string, string>) => ({
        main: "custom",
        face: faceParam,
        ...(trackSetId === "no-luck" ? {} : { tracks: trackSetId }),
        ...extra,
    })
    const shellHref = workspaceHref({ workspace: "testing-lab", params: labParams({}) })
    const phoneHref = workspaceHref({
        workspace: "testing-lab",
        params: labParams({ context: "phone", viewport: "390" }),
    })

    return (
        <AudioSessionProvider key={trackSetId} initialQueue={TRACK_SETS[trackSetId].tracks}>
            <SplitLayout
                stageLabel="Your face"
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                New Face · {spec.pieces.length}{" "}
                                {spec.pieces.length === 1 ? "piece" : "pieces"}
                            </p>
                            <WidthFrame width={parseStageWidth(widthParam)}>
                                <ComposedFace
                                    spec={spec}
                                    art={art}
                                    onOpenController={setRoute}
                                    onInteraction={(text) => append(text, "ok")}
                                    gestureHints
                                />
                            </WidthFrame>
                        </div>
                        <Panel
                            title="Take it into the Testing Lab"
                            hint="The Lab loads this exact face in a real viewport, alongside the sidebar player and the bottom bar."
                        >
                            {spec.pieces.length === 0 ? (
                                <Note>Add at least one piece, then place the face.</Note>
                            ) : (
                                <div className="wk-btn-row">
                                    <a
                                        className="wk-btn wk-btn--primary"
                                        href={shellHref}
                                        onClick={(event) => handleLinkClick(event, shellHref)}
                                    >
                                        <FlaskConical size={14} /> Place in the app shell
                                    </a>
                                    <a
                                        className="wk-btn"
                                        href={phoneHref}
                                        onClick={(event) => handleLinkClick(event, phoneHref)}
                                    >
                                        <Smartphone size={14} /> Try it on a phone screen
                                    </a>
                                </div>
                            )}
                        </Panel>
                        <Panel
                            title="Interaction log"
                            actions={
                                <Button variant="ghost" onClick={clear}>
                                    Clear
                                </Button>
                            }
                        >
                            <EventLog
                                lines={lines}
                                empty="Turn on a gesture under Interactions, then try it on the surface."
                            />
                        </Panel>
                        <Panel title="Session">
                            <SessionReadout />
                        </Panel>
                    </>
                }
                controls={
                    <>
                        <Panel
                            title="Start"
                            hint="The workspace opens blank. Starters are only examples to pull apart."
                        >
                            <ButtonRow>
                                <Button
                                    onClick={() => {
                                        if (
                                            spec.pieces.length === 0 ||
                                            window.confirm("Clear the surface and start blank?")
                                        ) {
                                            setFaceParam(encodeFace(BLANK_FACE))
                                        }
                                    }}
                                >
                                    Blank surface
                                </Button>
                                {STARTERS.map((starter) => (
                                    <Button
                                        key={starter.id}
                                        onClick={() => setFaceParam(encodeFace(starter.spec))}
                                        label={`${starter.label}: ${starter.description}`}
                                    >
                                        {starter.label}
                                    </Button>
                                ))}
                            </ButtonRow>
                            {!faceParam && draft && (
                                <ButtonRow>
                                    <Button variant="primary" onClick={() => setFaceParam(draft)}>
                                        Resume your last face
                                    </Button>
                                </ButtonRow>
                            )}
                        </Panel>

                        <Panel
                            title="Add a piece"
                            hint="Each piece is one of the package's public building blocks, wired to the shared session."
                        >
                            <div className="wk-palette">
                                {PIECE_ORDER.map((kind) => (
                                    <button
                                        key={kind}
                                        type="button"
                                        className="wk-palette__item"
                                        onClick={() => change((current) => addPiece(current, kind))}
                                        disabled={full}
                                        title={PIECES[kind].description}
                                        aria-label={`Add ${PIECES[kind].label}`}
                                    >
                                        <Plus size={13} aria-hidden="true" />
                                        {PIECES[kind].label}
                                    </button>
                                ))}
                            </div>
                            {full && (
                                <Note tone="warn">A face holds up to {MAX_PIECES} pieces.</Note>
                            )}
                        </Panel>

                        <Panel
                            title="Pieces on the surface"
                            hint="In order: top to bottom, or left to right in a row."
                        >
                            {spec.pieces.length === 0 ? (
                                <p className="wk-panel__hint">Nothing here yet.</p>
                            ) : (
                                <ol className="wk-piece-list" aria-label="Pieces on the surface">
                                    {spec.pieces.map((piece, index) => (
                                        <PieceRow
                                            key={piece.id}
                                            piece={piece}
                                            index={index}
                                            count={spec.pieces.length}
                                            onChange={change}
                                        />
                                    ))}
                                </ol>
                            )}
                        </Panel>

                        <Panel title="Surface">
                            <Segmented
                                label={LAYOUT_CHOICES.direction.label}
                                value={spec.layout.direction}
                                options={LAYOUT_CHOICES.direction.values}
                                onChange={(direction) =>
                                    change((current) => setLayout(current, { direction }))
                                }
                            />
                            <SelectField
                                label={LAYOUT_CHOICES.align.label}
                                value={spec.layout.align}
                                options={LAYOUT_CHOICES.align.values}
                                onChange={(align) =>
                                    change((current) => setLayout(current, { align }))
                                }
                            />
                            <SelectField
                                label={LAYOUT_CHOICES.gap.label}
                                value={spec.layout.gap}
                                options={LAYOUT_CHOICES.gap.values}
                                onChange={(gap) => change((current) => setLayout(current, { gap }))}
                            />
                            <SelectField
                                label={LAYOUT_CHOICES.padding.label}
                                value={spec.layout.padding}
                                options={LAYOUT_CHOICES.padding.values}
                                onChange={(padding) =>
                                    change((current) => setLayout(current, { padding }))
                                }
                            />
                            <SelectField
                                label={LAYOUT_CHOICES.shape.label}
                                value={spec.layout.shape}
                                options={LAYOUT_CHOICES.shape.values}
                                onChange={(shape) =>
                                    change((current) => setLayout(current, { shape }))
                                }
                            />
                            <SelectField
                                label={LAYOUT_CHOICES.background.label}
                                value={spec.layout.background}
                                options={LAYOUT_CHOICES.background.values}
                                onChange={(background) =>
                                    change((current) => setLayout(current, { background }))
                                }
                            />
                            <Segmented
                                label={LAYOUT_CHOICES.theme.label}
                                value={spec.layout.theme}
                                options={LAYOUT_CHOICES.theme.values}
                                onChange={(theme) =>
                                    change((current) => setLayout(current, { theme }))
                                }
                            />
                        </Panel>

                        <Panel
                            title="Interactions"
                            hint="Gestures fire on the surface around the pieces. Buttons, sliders, and menus keep their own clicks."
                        >
                            <SelectField
                                label={INTERACTION_CHOICES.tap.label}
                                value={spec.interactions.tap}
                                options={INTERACTION_CHOICES.tap.values}
                                onChange={(tap) =>
                                    change((current) => setInteractions(current, { tap }))
                                }
                            />
                            <SelectField
                                label={INTERACTION_CHOICES.doubleTap.label}
                                value={spec.interactions.doubleTap}
                                options={INTERACTION_CHOICES.doubleTap.values}
                                onChange={(doubleTap) =>
                                    change((current) => setInteractions(current, { doubleTap }))
                                }
                            />
                            <SelectField
                                label={INTERACTION_CHOICES.swipe.label}
                                value={spec.interactions.swipe}
                                options={INTERACTION_CHOICES.swipe.values}
                                onChange={(swipe) =>
                                    change((current) => setInteractions(current, { swipe }))
                                }
                            />
                            <SelectField
                                label={INTERACTION_CHOICES.longPress.label}
                                value={spec.interactions.longPress}
                                options={INTERACTION_CHOICES.longPress.values}
                                onChange={(longPress) =>
                                    change((current) => setInteractions(current, { longPress }))
                                }
                            />
                            <Switch
                                label="Keyboard"
                                hint="Space or K plays, arrows jump, Shift+arrows skip, M mutes (while the face has focus)"
                                checked={spec.interactions.keyboard}
                                onChange={(keyboard) =>
                                    change((current) => setInteractions(current, { keyboard }))
                                }
                            />
                            <Switch
                                label="Reveal controls on hover or tap"
                                hint="Controls stay hidden until needed; the first touch only shows them"
                                checked={spec.interactions.reveal}
                                onChange={(reveal) =>
                                    change((current) => setInteractions(current, { reveal }))
                                }
                            />
                        </Panel>

                        <Panel title="Preview">
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
                            <Note>{TRACK_SETS[trackSetId].note}</Note>
                        </Panel>
                    </>
                }
            />
            <SessionController
                route={route}
                onClose={() => setRoute(null)}
                theme={themeFor(spec.layout.theme)}
            />
        </AudioSessionProvider>
    )
}
