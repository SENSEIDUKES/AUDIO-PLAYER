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
export type { PlayerSurfaceMode, SurfaceAction, SurfaceState } from "./surfaceReducer"

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
    hasRequiredCapabilities,
    pruneDeadArcActions,
    collectArcLeaves,
    describeArcRoutes,
    routeArcAction,
} from "../menu/arcRouting"
export type {
    ArcActionTarget,
    ArcCommandId,
    ArcCommandHost,
    ArcRouteDescriptor,
    PlayerActionCapability,
} from "../menu/arcRouting"

export {
    buildCanonicalPlayerActions,
    buildPluginsArcBranch,
    buildPlaybackArcBranch,
    buildQueueArcBranch,
    buildShareArcBranch,
    buildAgentsArcBranch,
    buildVaultArcBranch,
} from "../menu/canonicalActions"
export type {
    ArcMenuEntitlements,
    BuildCanonicalPlayerActionsOptions,
} from "../menu/canonicalActions"

export { isNodeInteractive } from "../menu/menuData"
export type { MenuNode, MenuItemState } from "../menu/menuData"

export { SEICanvasHost } from "./SEICanvasHost"
export type { SEICanvasHostProps } from "./SEICanvasHost"

export { ScrubberCanvasHost } from "./ScrubberCanvasHost"
export type { ScrubberCanvasHostProps } from "./ScrubberCanvasHost"

export { PlayerHero } from "./PlayerHero"
export type { PlayerHeroProps } from "./PlayerHero"

export { QueueSurface } from "./QueueSurface"
export type { QueueSurfaceProps } from "./QueueSurface"
