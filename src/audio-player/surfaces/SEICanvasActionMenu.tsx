import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { createPortal } from "react-dom"
import { ChevronLeftIcon, CloseIcon, LockIcon } from "../skins/icons"
import { isNodeInteractive } from "../menu/menuData"
import type { MenuNode } from "../menu/menuData"
import "./sei-canvas-action-menu.css"

/** Radius of the half-circle the nodes fan out on, in px. */
export const ARC_RADIUS = 128

/**
 * The `--ap-*` tokens the trigger inherits from the player root. Copied onto the
 * portal container so the menu stays themed even though it renders on
 * `document.body`, outside the player's token scope. Keeping this a plain list
 * (rather than importing the theme builder) lets the arc stay decoupled.
 */
const THEME_VARS = ["--ap-accent", "--ap-text", "--ap-play-icon", "--ap-bg"] as const

export interface ArcOffset {
    x: number
    y: number
}

/**
 * Polar fan geometry: `n` points spread across a half-circle that opens upward
 * (angles 180°→0°), centered on the pivot. `y` is negative (up). A single item
 * sits straight above the pivot.
 */
export function arcOffsets(n: number, radius: number = ARC_RADIUS): ArcOffset[] {
    if (n <= 0) return []
    if (n === 1) return [{ x: 0, y: -radius }]
    return Array.from({ length: n }, (_, i) => {
        const deg = 180 - (i / (n - 1)) * 180
        const rad = (deg * Math.PI) / 180
        return { x: radius * Math.cos(rad), y: -radius * Math.sin(rad) }
    })
}

interface ResolvedLevel {
    level: MenuNode[]
    /** Labels of the entered branch nodes, root → current. */
    trail: string[]
}

/** Walk `items` by the id `path` to the current submenu level + breadcrumb. */
function resolveLevel(items: MenuNode[], path: string[]): ResolvedLevel {
    let level = items
    const trail: string[] = []
    for (const id of path) {
        const node = level.find((n) => n.id === id)
        if (!node || !node.children) break
        trail.push(node.label)
        level = node.children
    }
    return { level, trail }
}

export interface SEICanvasActionMenuProps {
    /** The menu tree to render. */
    items: MenuNode[]
    /** Resolves the `open-queue` leaf action. */
    onOpenQueue: () => void
    /** Resolves the `activate-canvas` leaf action. */
    onActivateCanvas: () => void
    /** Resolves any other leaf action (and `select-lyrics`). */
    onSelect?: (node: MenuNode) => void
    /** Accessible label for the trigger + menu. */
    ariaLabel?: string
    className?: string
}

/** Default trigger glyph — a small command-wheel mark. */
const TriggerIcon = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="12" cy="4.5" r="1.8" />
        <circle cx="18.5" cy="15.5" r="1.8" />
        <circle cx="5.5" cy="15.5" r="1.8" />
        <path d="M12 6.7v3M13.8 13.1l2.8 1.6M10.2 13.1l-2.8 1.6" />
    </svg>
)

/**
 * The SEI Canvas Action Menu: a bottom-anchored half-circle command wheel. The
 * closed state is a single round trigger that drops into the queue surface slot.
 * Tapping it opens a dimmed, blurred portal overlay that fans the menu items on
 * an arc, with submenu navigation, a depth-aware Close/Back center button, and a
 * breadcrumb. The arc's open + navigation state is entirely local here — it is an
 * overlay, never a player surface. Kept free of engine/session imports so it can
 * later be promoted into the seihouse-ui design system.
 */
export function SEICanvasActionMenu({
    items,
    onOpenQueue,
    onActivateCanvas,
    onSelect,
    ariaLabel = "Canvas actions",
    className,
}: SEICanvasActionMenuProps) {
    const triggerRef = useRef<HTMLButtonElement>(null)
    const centerRef = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [entered, setEntered] = useState(false)
    const [path, setPath] = useState<string[]>([])
    const [themeStyle, setThemeStyle] = useState<CSSProperties>({})

    const close = useCallback(() => {
        setOpen(false)
        setEntered(false)
        setPath([])
    }, [])

    const openMenu = useCallback(() => {
        // Snapshot the inherited theme tokens from the trigger so the portal
        // (mounted on document.body) renders in the player's palette.
        const el = triggerRef.current
        if (el) {
            const cs = getComputedStyle(el)
            const vars: Record<string, string> = {}
            for (const name of THEME_VARS) {
                const value = cs.getPropertyValue(name).trim()
                if (value) vars[name] = value
            }
            setThemeStyle(vars as CSSProperties)
        }
        setOpen(true)
    }, [])

    // Flip to the entered state on the next frame so the open animation runs.
    useEffect(() => {
        if (!open) return
        const raf = requestAnimationFrame(() => setEntered(true))
        return () => cancelAnimationFrame(raf)
    }, [open])

    // Escape closes; body scroll locks; focus moves to the center button on open
    // and restores to the trigger on close (same pattern as SAPController).
    useEffect(() => {
        if (!open) return
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const raf = requestAnimationFrame(() => centerRef.current?.focus())
        const handleKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        document.addEventListener("keydown", handleKey)
        return () => {
            document.body.style.overflow = prevOverflow
            cancelAnimationFrame(raf)
            document.removeEventListener("keydown", handleKey)
            const trigger = triggerRef.current
            if (trigger?.isConnected) trigger.focus()
        }
    }, [open, close])

    const { level, trail } = resolveLevel(items, path)
    const offsets = arcOffsets(level.length)

    const handleNode = useCallback(
        (node: MenuNode) => {
            if (!isNodeInteractive(node)) return
            if (node.children && node.children.length > 0) {
                setPath((p) => [...p, node.id])
                return
            }
            switch (node.actionId) {
                case "open-queue":
                    onOpenQueue()
                    break
                case "activate-canvas":
                    onActivateCanvas()
                    break
                default:
                    onSelect?.(node)
            }
            close()
        },
        [close, onActivateCanvas, onOpenQueue, onSelect]
    )

    const handleCenter = useCallback(() => {
        if (path.length > 0) {
            setPath((p) => p.slice(0, -1))
        } else {
            close()
        }
    }, [close, path.length])

    const inSubmenu = path.length > 0

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`ap-surface-btn ap-tap${open ? " ap-surface-btn--active" : ""}${
                    className ? ` ${className}` : ""
                }`}
                onClick={openMenu}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <TriggerIcon />
            </button>

            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div className="sac" style={themeStyle}>
                        <div
                            className="sac__backdrop"
                            onClick={close}
                            aria-hidden="true"
                            data-entered={entered}
                        />
                        <div
                            className="sac__stage"
                            role="menu"
                            aria-label={ariaLabel}
                        >
                            <div className="sac__arc" data-open={entered}>
                                {inSubmenu && (
                                    <div className="sac__crumb" aria-hidden="true">
                                        {trail.join(" › ")}
                                    </div>
                                )}

                                {level.map((node, i) => {
                                    const state = node.state ?? "available"
                                    const interactive = isNodeInteractive(node)
                                    const offset = offsets[i]
                                    const Icon = node.icon
                                    return (
                                        <button
                                            key={node.id}
                                            type="button"
                                            role="menuitem"
                                            className={`sac__node ap-tap sac__node--${state}`}
                                            style={
                                                {
                                                    "--sac-x": `${offset.x}px`,
                                                    "--sac-y": `${offset.y}px`,
                                                    transitionDelay: `${i * 25}ms`,
                                                } as CSSProperties
                                            }
                                            onClick={() => handleNode(node)}
                                            aria-disabled={!interactive}
                                            aria-haspopup={
                                                node.children ? "menu" : undefined
                                            }
                                            tabIndex={interactive ? 0 : -1}
                                        >
                                            <span className="sac__node-icon">
                                                {state === "locked" ? (
                                                    <LockIcon />
                                                ) : (
                                                    <Icon />
                                                )}
                                            </span>
                                            <span className="sac__node-label">
                                                {node.label}
                                            </span>
                                            {state === "coming-soon" && (
                                                <span className="sac__badge">soon</span>
                                            )}
                                        </button>
                                    )
                                })}

                                <button
                                    ref={centerRef}
                                    type="button"
                                    className="sac__center ap-tap"
                                    onClick={handleCenter}
                                    aria-label={inSubmenu ? "Back" : "Close menu"}
                                >
                                    {inSubmenu ? <ChevronLeftIcon /> : <CloseIcon />}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}

export default SEICanvasActionMenu
