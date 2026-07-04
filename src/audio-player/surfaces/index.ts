export {
    PLAYER_FACE_CAPABILITIES,
    FAMILY_DEFAULTS,
    getFaceCapability,
    getFaceFamily,
    faceSupportsAction,
    faceSupportsSEICanvas,
    faceSupportsScrubberCanvas,
    faceSupportsContextualActions,
    faceSupportsWaveform,
    faceSupportsHeroCollapse,
    getScrubberDensity,
    getScrubberHeight,
    getPreferredCanvasPlacement,
} from "./faceCapabilities"
export type {
    PlayerFace,
    PlayerFamily,
    PlayerFaceCapability,
    ScrubberDensity,
} from "./faceCapabilities"

export {
    INITIAL_SURFACE_STATE,
    canEnterCanvas,
    deriveHeroCollapsed,
    surfaceReducer,
} from "./surfaceReducer"
export type {
    PlayerSurfaceMode,
    SurfaceAction,
    SurfaceState,
} from "./surfaceReducer"

export { usePlayerSurface } from "./usePlayerSurface"
export type { UsePlayerSurfaceResult } from "./usePlayerSurface"

export { SurfaceButton } from "./SurfaceButton"
export type { SurfaceButtonProps } from "./SurfaceButton"

export { PlayerSurfaceButtons } from "./PlayerSurfaceButtons"
export type { PlayerSurfaceButtonsProps } from "./PlayerSurfaceButtons"

export { SEICanvasActionMenu, arcOffsets, ARC_RADIUS } from "./SEICanvasActionMenu"
export type { SEICanvasActionMenuProps, ArcOffset } from "./SEICanvasActionMenu"

export { ArcActionButton } from "./ArcActionButton"
export type { ArcAction, ArcActionButtonProps } from "./ArcActionButton"

export {
    resolveArcActionState,
    isArcActionLive,
    pruneDeadArcActions,
    routeArcAction,
} from "../menu/arcRouting"
export type {
    ArcActionTarget,
    ArcCommandId,
    ArcCommandHost,
} from "../menu/arcRouting"

export { buildVaultTrackArcActions } from "../menu/vaultTrackMenu"
export type {
    VaultTrackEntitlements,
    BuildVaultTrackArcActionsOptions,
} from "../menu/vaultTrackMenu"

export {
    buildStandardTrackArcActions,
    buildPluginsArcBranch,
    buildPlaybackArcBranch,
    buildShareArcBranch,
    buildAgentsArcBranch,
} from "../menu/standardArcActions"
export type { BuildStandardArcActionsOptions } from "../menu/standardArcActions"

export { buildMenuTree, isNodeInteractive } from "../menu/menuData"
export type {
    MenuNode,
    MenuItemState,
    MenuActionId,
    ArcMenuEntitlements,
    BuildMenuTreeOptions,
} from "../menu/menuData"

export { SEICanvasHost } from "./SEICanvasHost"
export type { SEICanvasHostProps } from "./SEICanvasHost"

export { ScrubberCanvasHost } from "./ScrubberCanvasHost"
export type { ScrubberCanvasHostProps } from "./ScrubberCanvasHost"

export { PlayerHero } from "./PlayerHero"
export type { PlayerHeroProps } from "./PlayerHero"

export { QueueSurface } from "./QueueSurface"
export type { QueueSurfaceProps } from "./QueueSurface"
