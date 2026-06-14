import type { ReactNode } from "react"

export interface SurfaceButtonProps {
    /** Whether the surface this button toggles is currently open. */
    active: boolean
    /** The icon to render. */
    children: ReactNode
    onClick: () => void
    /** Accessible label (differs per side: "Show canvas" / "Up next"). */
    label: string
    disabled?: boolean
    className?: string
}

/**
 * The single shared surface-toggle button shell (Apple-Music style). Both the
 * canvas (left) and queue (right) buttons render through this one component, so
 * their size, shape, padding, press animation, and active styling are identical
 * by construction. Active state is exposed via `aria-pressed` + a modifier class.
 */
export function SurfaceButton({
    active,
    children,
    onClick,
    label,
    disabled = false,
    className,
}: SurfaceButtonProps) {
    return (
        <button
            type="button"
            className={`ap-surface-btn ap-tap${active ? " ap-surface-btn--active" : ""}${
                className ? ` ${className}` : ""
            }`}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={active}
            aria-label={label}
        >
            {children}
        </button>
    )
}

export default SurfaceButton
