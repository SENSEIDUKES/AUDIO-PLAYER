import type { ReactNode } from "react"
import type { PlayerFace } from "./faceCapabilities"

export interface PlayerHeroProps {
    face: PlayerFace
    /** When true, render as a compact identity header (= surface.isHeroCollapsed). */
    collapsed: boolean
    title: string
    artist: string
    /** Optional art node shown in the compact header. */
    art?: ReactNode
    className?: string
}

/**
 * The hero identity block. It renders the full hero by default and a compact
 * identity header when `collapsed` — the SAME DOM node with a `data-collapsed`
 * flag, so the transition animates and nothing navigates away (no route/modal/
 * tab). Faces that don't support hero collapse always receive `collapsed={false}`.
 */
export function PlayerHero({
    face,
    collapsed,
    title,
    artist,
    art,
    className,
}: PlayerHeroProps) {
    return (
        <div
            className={`ap-hero${className ? ` ${className}` : ""}`}
            data-collapsed={collapsed ? "true" : "false"}
            data-face={face}
            role="group"
            aria-label="Track information"
        >
            {art && <div className="ap-hero__art">{art}</div>}
            <div className="ap-hero__text">
                <div className="ap-hero__title" title={title}>
                    {title}
                </div>
                <div className="ap-hero__artist" title={artist}>
                    {artist}
                </div>
            </div>
        </div>
    )
}

export default PlayerHero
