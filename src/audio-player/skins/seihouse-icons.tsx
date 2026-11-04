import type { ReactNode, SVGProps } from "react"

/*
 * SEIHouse's official icons: one source for the player, the reader UI and the
 * Workshop, so SAP looks like the rest of SEIHouse. Copied, not redrawn:
 *
 * - Audio, Soundscape, Atmosphere, Cue, Back, Undo, Save, Remove, Delete:
 *   SEN's `HighlightActionIcon` (development repo,
 *   src/components/highlight-engine/development/HighlightActionIcon.tsx).
 * - Mortal, Immortal, Heaven: SEN's `FatePressureIcon`
 *   (src/components/story-seed/development/FatePressureIcon.tsx).
 * - Settings, Help, Search, Information: SEN's v2 artwork
 *   (src/components/sen-icons/assets/*.svg).
 * - Exit, Download, and the SEIHouse arrowhead they share: the master icons in
 *   LIBRARY CORE/IMAGES/ICONS/Master Icons/Basic.
 *
 * Change artwork at its source first, then here. `SEIArrowIcon` and
 * `SEIRetryIcon` are built from the official arrowhead: there is no master
 * file for a lone arrow or for retry yet.
 *
 * Every icon paints with `currentColor` and is hidden from assistive tech
 * unless given an accessible name; the button around it carries the label.
 */

export interface SEIIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
    size?: number | string
}

function Glyph({
    size = 20,
    viewBox = "0 0 24 24",
    fill = "currentColor",
    children,
    ...props
}: SEIIconProps & { children: ReactNode }) {
    const labelled = Boolean(props["aria-label"] || props["aria-labelledby"])
    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill={fill}
            aria-hidden={labelled ? undefined : true}
            role={labelled ? "img" : undefined}
            focusable="false"
            {...props}
        >
            {children}
        </svg>
    )
}

/** The stroked master icons (Exit, Download, Settings, Help, Search) share these. */
const STROKE = {
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const

/** The SEIHouse arrowhead from the Exit and Download masters, pointing right. */
const ARROWHEAD =
    "M15.65 7.65C15.42 7.48 15.2 7.6 15.32 7.9C15.8 9.05 16.22 10.12 15.87 10.53C15.46 11.02 11.28 10.89 8.17 10.55C7.93 10.52 7.83 10.68 7.99 10.86L9 12L7.99 13.14C7.83 13.32 7.93 13.48 8.17 13.45C11.28 13.11 15.46 12.98 15.87 13.47C16.22 13.88 15.8 14.95 15.32 16.1C15.2 16.4 15.42 16.52 15.65 16.35L21.76 12.56Q22.55 12 21.76 11.44Z"

/* --------------------------------- Sound --------------------------------- */

/** Audio: headphones. */
export function SEIAudioIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M12 2a10 10 0 0 0-10 10v6a3 3 0 0 0 3 3h2V11H4a8 8 0 0 1 16 0h-3v10h2a3 3 0 0 0 3-3v-6A10 10 0 0 0 12 2Z" />
        </Glyph>
    )
}

/** Soundscape: a pair of notes. The score. */
export function SEISoundscapeIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M9 3a1 1 0 0 0-1 1v11.5A4 4 0 1 0 10 19V8l10-2v7.5A4 4 0 1 0 22 17V1L9 3Z" />
        </Glyph>
    )
}

/** Atmosphere: a cloud over drifting air. */
export function SEIAtmosphereIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M6 14a4 4 0 0 1-.7-7.9 6 6 0 0 1 11.4-1A4.5 4.5 0 1 1 18.5 14H6Z" />
            <path d="M3 17a1 1 0 0 1 0-2h13a1 1 0 0 1 0 2H3Zm4 4a1 1 0 0 1 0-2h14a1 1 0 0 1 0 2H7Z" />
        </Glyph>
    )
}

/** Cue: a short waveform. Sound cues. */
export function SEICueIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <rect x="2" y="9" width="3" height="6" rx="1.5" />
            <rect x="7" y="5" width="3" height="14" rx="1.5" />
            <rect x="12" y="2" width="3" height="20" rx="1.5" />
            <rect x="17" y="7" width="3" height="10" rx="1.5" />
            <rect x="22" y="10" width="2" height="4" rx="1" />
        </Glyph>
    )
}

/* ---------------------------- Tiers (pressure) ---------------------------- */

export type SEIPressureLevel = "mortal" | "immortal" | "heaven"

const FLAMES: Record<SEIPressureLevel, string> = {
    mortal: "M12 8c.7 3.2 4.5 5.3 4.5 8.6a4.5 4.5 0 0 1-9 0C7.5 13.3 10.6 11.8 12 8Zm0 7c-.5 1.3-1.7 2.2-1.7 3.3a1.7 1.7 0 0 0 3.4 0c0-1.1-1.2-2-1.7-3.3Z",
    immortal:
        "M14 3c0 5-5 6-5 10-2.2-1-3-3-3-5-2.2 2.5-3 5.2-3 8a9 9 0 0 0 18 0c0-5.3-5-7-7-13Zm-1 11c-.5 2.1-3.5 3.6-3.5 5.6a3 3 0 0 0 6 0c0-1.8-1.8-3.2-2.5-5.6Z",
    heaven: "M12 1c1 4 5.8 6.2 5.5 10.1 2-1.5 2.3-3.6 2-5.1 3 3.5 3.5 6.4 3.5 10a11 11 0 0 1-22 0c0-3.6 1.5-6.6 4-9-.4 2.7.1 4.3 1.7 5.3C6 7.2 10 5.1 12 1Zm0 10c-.7 3.2-4 5-4 7.2a4 4 0 0 0 8 0c0-2.2-3.3-4-4-7.2Z",
}
const FLAME_OFFSET: Record<SEIPressureLevel, number> = { mortal: 6, immortal: 2, heaven: 0 }

/** A tier's Fate Pressure flame: it grows from Mortal to Heaven, so no color is needed. */
export function SEIPressureIcon({ level, ...props }: SEIIconProps & { level: SEIPressureLevel }) {
    return (
        <Glyph {...props} viewBox="0 0 24 28">
            <path
                transform={`translate(0 ${FLAME_OFFSET[level]})`}
                d={FLAMES[level]}
                fillRule="evenodd"
                clipRule="evenodd"
            />
        </Glyph>
    )
}
export function SEIMortalIcon(props: SEIIconProps) {
    return <SEIPressureIcon {...props} level="mortal" />
}
export function SEIImmortalIcon(props: SEIIconProps) {
    return <SEIPressureIcon {...props} level="immortal" />
}
export function SEIHeavenIcon(props: SEIIconProps) {
    return <SEIPressureIcon {...props} level="heaven" />
}

/* ------------------------------- Navigation ------------------------------- */

export type SEIArrowDirection = "left" | "right" | "up" | "down"
const ARROW_TURN: Record<SEIArrowDirection, number> = { right: 0, down: 90, left: 180, up: 270 }

/** The SEIHouse arrowhead on its own: steppers, next and previous. */
export function SEIArrowIcon({
    direction = "right",
    ...props
}: SEIIconProps & { direction?: SEIArrowDirection }) {
    return (
        <Glyph {...props}>
            <path
                transform={`rotate(${ARROW_TURN[direction]} 12 12) translate(12 12) scale(1.3) translate(-15.2 -12)`}
                d={ARROWHEAD}
            />
        </Glyph>
    )
}

/** Back: an arrow pointing left. Leaving a submenu or panel. */
export function SEIBackIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M10.7 3.3a1 1 0 0 1 0 1.4L5.4 10H21a1 1 0 0 1 0 2H5.4l5.3 5.3a1 1 0 0 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0Z" />
        </Glyph>
    )
}

/** Exit: an open door with the SEIHouse arrow. Closing a sheet or the player. */
export function SEIExitIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <path
                {...STROKE}
                strokeWidth="1.9"
                d="M15.5 6.25V4a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2.25"
            />
            <path transform="translate(1.05 2.4) scale(.88 .8)" d={ARROWHEAD} fill="currentColor" />
        </Glyph>
    )
}

/** Download: a tray with the SEIHouse arrow pointing in. */
export function SEIDownloadIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <path
                {...STROKE}
                strokeWidth="1.9"
                d="M8 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3"
            />
            <path transform="matrix(0 .92 -.8 0 21.6 -5)" d={ARROWHEAD} fill="currentColor" />
        </Glyph>
    )
}

/** Retry: a loop closed by the SEIHouse arrowhead, drawn to match Exit. */
export function SEIRetryIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <path {...STROKE} strokeWidth="1.9" d="M10.5 6.2A7 7 0 1 0 17.95 9.3" />
            <path
                transform="translate(16.6 6) scale(.62) translate(-22.55 -12)"
                d={ARROWHEAD}
                fill="currentColor"
            />
        </Glyph>
    )
}

/** Undo: a hooked arrow turning back. */
export function SEIUndoIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M8.7 2.3a1 1 0 0 1 0 1.4L5.4 7H14a8 8 0 0 1 0 16h-3a1 1 0 0 1 0-2h3a6 6 0 0 0 0-12H5.4l3.3 3.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
        </Glyph>
    )
}

/* -------------------------------- Actions -------------------------------- */

/** Save: a check. Done, copied, confirmed. */
export function SEISaveIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M20.7 5.3a1 1 0 0 1 0 1.4l-12 12a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.4L8 16.6 19.3 5.3a1 1 0 0 1 1.4 0Z" />
        </Glyph>
    )
}

/** Remove: a circle with a bar. Taking something out of a list. */
export function SEIRemoveIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM7 11a1 1 0 0 0 0 2h10a1 1 0 0 0 0-2H7Z"
            />
        </Glyph>
    )
}

/** Delete: a bin. Removing something for good. */
export function SEIDeleteIcon(props: SEIIconProps) {
    return (
        <Glyph {...props}>
            <path d="M9 2h6a1 1 0 0 1 1 1v1h4a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1Z" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="m5 8 1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12H5Zm4 3v8h2v-8H9Zm4 0v8h2v-8h-2Z"
            />
        </Glyph>
    )
}

/* --------------------------------- Header --------------------------------- */

/** Settings: an open eight-tooth gear. */
export function SEISettingsIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <path
                stroke="currentColor"
                strokeWidth="2.15"
                strokeLinejoin="round"
                d="M10.16 5.14 L10.56 2.91 L13.44 2.91 L13.84 5.14 L15.55 5.85 L17.41 4.56 L19.44 6.59 L18.15 8.45 L18.86 10.16 L21.09 10.56 L21.09 13.44 L18.86 13.84 L18.15 15.55 L19.44 17.41 L17.41 19.44 L15.55 18.15 L13.84 18.86 L13.44 21.09 L10.56 21.09 L10.16 18.86 L8.45 18.15 L6.59 19.44 L4.56 17.41 L5.85 15.55 L5.14 13.84 L2.91 13.44 L2.91 10.56 L5.14 10.16 L5.85 8.45 L4.56 6.59 L6.59 4.56 L8.45 5.85Z"
            />
            <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="2.15" />
        </Glyph>
    )
}

/** Help: a question mark. */
export function SEIHelpIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <path
                {...STROKE}
                strokeWidth="2.15"
                d="M7.15 8.6c0-2.85 2.05-4.65 4.85-4.65 2.9 0 4.85 1.75 4.85 4.2 0 3.2-4.85 3.75-4.85 6.7v.45"
            />
            <circle cx="12" cy="20" r="1.35" fill="currentColor" />
        </Glyph>
    )
}

/** Search: a lens. */
export function SEISearchIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <circle {...STROKE} strokeWidth="2.15" cx="10" cy="9.8" r="5.8" />
            <path {...STROKE} strokeWidth="2.15" d="m14.2 14 5.3 5.9" />
        </Glyph>
    )
}

/** Information: a calligraphic i in an open ring. */
export function SEIInformationIcon(props: SEIIconProps) {
    return (
        <Glyph {...props} fill="none">
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.1" />
            <circle cx="12.8" cy="6.9" r="1.35" fill="currentColor" />
            <path
                fill="currentColor"
                d="M9.8 10h4.1l-1.5 6.8h2l-.3 1.5H8.7l.3-1.5h1.3l1.2-5.3H9.5l.3-1.5Z"
            />
        </Glyph>
    )
}
