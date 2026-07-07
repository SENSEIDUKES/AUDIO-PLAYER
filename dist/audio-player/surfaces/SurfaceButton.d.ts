import { ReactNode } from 'react';
export interface SurfaceButtonProps {
    /** Whether the surface this button toggles is currently open. */
    active: boolean;
    /** The icon to render. */
    children: ReactNode;
    onClick: () => void;
    /** Accessible label (differs per side: "Show canvas" / "Up next"). */
    label: string;
    disabled?: boolean;
    className?: string;
}
/**
 * The single shared surface-toggle button shell (Apple-Music style). Both the
 * canvas (left) and queue (right) buttons render through this one component, so
 * their size, shape, padding, press animation, and active styling are identical
 * by construction. Active state is exposed via `aria-pressed` + a modifier class.
 */
export declare function SurfaceButton({ active, children, onClick, label, disabled, className, }: SurfaceButtonProps): import("react").JSX.Element;
export default SurfaceButton;
//# sourceMappingURL=SurfaceButton.d.ts.map