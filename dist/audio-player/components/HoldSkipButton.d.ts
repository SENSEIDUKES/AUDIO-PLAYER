import { ReactNode } from 'react';
export interface HoldSkipButtonProps {
    direction: "previous" | "next";
    disabled?: boolean;
    skipDisabled?: boolean;
    seekLabel: string;
    skipLabel: string;
    onSeek: () => void;
    onSkip: () => void;
    children: ReactNode;
    className?: string;
    holdMs?: number;
}
/**
 * Consolidated transport button: a short press seeks, an intentional hold skips
 * tracks. Pointer and keyboard paths share the same timer so mobile, desktop,
 * and assistive keyboard users get equivalent behavior.
 */
export declare function HoldSkipButton({ direction, disabled, skipDisabled, seekLabel, skipLabel, onSeek, onSkip, children, className, holdMs, }: HoldSkipButtonProps): import("react").JSX.Element;
//# sourceMappingURL=HoldSkipButton.d.ts.map