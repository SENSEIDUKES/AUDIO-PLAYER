/**
 * Per-face capability model — the single source of truth for which render zones
 * and surface behaviors a player face supports.
 *
 * Rules are declared here, never inferred from layout/width. Every consumer asks
 * these getters (e.g. `faceSupportsSEICanvas`) so support is a property of the
 * face, not of the current viewport.
 */

/** Every player face the library ships. */
export type PlayerFace =
    | "fullCard" // FullCardPlayer — rich now-playing card (expanded)
    | "miniSidebar" // MiniSidebarPlayer — condensed sidebar widget (compact)
    | "seaCard" // SeaCardPlayer — marketplace/album card
    | "stickyBottom" // StickyBottomPlayer — persistent bottom bar
    | "vaultRow" // VaultRowPlayer — slim list row
    | "portable" // default AudioPlayer — standalone portable player

export type ScrubberDensity = "compact" | "standard" | "expanded"

export type PlayerFaceCapability = {
    /** May host the SEICanvas main visual area. Compact/mini faces are false. */
    supportsSEICanvas: boolean
    /** May host the ScrubberCanvas timeline zone. Available on every face. */
    supportsScrubberCanvas: boolean
    /** Hero can collapse into a compact identity header when a surface opens. */
    supportsHeroCollapse?: boolean
    /** Where the canvas prefers to live relative to the face. */
    preferredCanvasPlacement?: "main" | "overlay" | "none"
    /** How dense the scrubber renders on this face. */
    scrubberDensity?: ScrubberDensity
}

/**
 * Declared capabilities for all faces. Phase 1 physically wires up `fullCard`
 * and `miniSidebar`; the rest declare capabilities so the model is complete and
 * honest for future phases and tests, without changing their rendering.
 */
export const PLAYER_FACE_CAPABILITIES: Record<PlayerFace, PlayerFaceCapability> =
    {
        fullCard: {
            supportsSEICanvas: true,
            supportsScrubberCanvas: true,
            supportsHeroCollapse: true,
            preferredCanvasPlacement: "main",
            scrubberDensity: "standard",
        },
        portable: {
            supportsSEICanvas: true,
            supportsScrubberCanvas: true,
            supportsHeroCollapse: true,
            preferredCanvasPlacement: "main",
            scrubberDensity: "expanded",
        },
        seaCard: {
            supportsSEICanvas: true,
            supportsScrubberCanvas: true,
            supportsHeroCollapse: true,
            preferredCanvasPlacement: "overlay",
            scrubberDensity: "standard",
        },
        miniSidebar: {
            supportsSEICanvas: false,
            supportsScrubberCanvas: true,
            supportsHeroCollapse: false,
            preferredCanvasPlacement: "none",
            scrubberDensity: "compact",
        },
        stickyBottom: {
            supportsSEICanvas: false,
            supportsScrubberCanvas: true,
            supportsHeroCollapse: false,
            preferredCanvasPlacement: "none",
            scrubberDensity: "compact",
        },
        vaultRow: {
            supportsSEICanvas: false,
            supportsScrubberCanvas: true,
            supportsHeroCollapse: false,
            preferredCanvasPlacement: "none",
            scrubberDensity: "compact",
        },
    }

export function getFaceCapability(face: PlayerFace): PlayerFaceCapability {
    return PLAYER_FACE_CAPABILITIES[face]
}

export function faceSupportsSEICanvas(face: PlayerFace): boolean {
    return getFaceCapability(face).supportsSEICanvas
}

export function faceSupportsScrubberCanvas(face: PlayerFace): boolean {
    return getFaceCapability(face).supportsScrubberCanvas
}

export function faceSupportsHeroCollapse(face: PlayerFace): boolean {
    return getFaceCapability(face).supportsHeroCollapse ?? false
}

export function getScrubberDensity(face: PlayerFace): ScrubberDensity {
    return getFaceCapability(face).scrubberDensity ?? "standard"
}

export function getPreferredCanvasPlacement(
    face: PlayerFace
): "main" | "overlay" | "none" {
    return getFaceCapability(face).preferredCanvasPlacement ?? "none"
}
