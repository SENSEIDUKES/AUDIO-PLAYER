import { PlayerFace } from '../surfaces/faceCapabilities';
/**
 * The four top-level sections a property belongs to. This is the unified
 * grouping the Properties panel renders, replacing the older ad-hoc groups
 * (theme / background / typography / behavior / display / art).
 */
export type PropertyGroup = "content" | "appearance" | "playback" | "advanced";
/** A piece of visual media — image or video — used for backgrounds and artwork. */
export type MediaKind = "image" | "video";
/**
 * A unified media descriptor shared by every face. One shape serves both the
 * full-bleed background role and the artwork/cover role. Video is visual-only:
 * the player's `<audio>` engine remains the sole audio owner, so background
 * video is always muted.
 */
export interface MediaSource {
    kind: MediaKind;
    /** Image or video URL. */
    src: string;
    /** Poster frame shown before a video paints / while it loads. */
    poster?: string;
    /** Accessible description for image media. */
    alt?: string;
    /** Autoplay video (default true — visual ambient media). */
    autoPlay?: boolean;
    /** Mute video (forced true for background role; the engine owns audio). */
    muted?: boolean;
    /** Loop video (default true). */
    loop?: boolean;
    /** object-fit for the rendered element. Default "cover". */
    fit?: "cover" | "contain";
}
export type SelectOption = {
    value: string;
    label: string;
};
/**
 * The input a property is edited with. The panel maps each `kind` to a concrete
 * control; faces never read this — it is editor metadata only.
 */
export type PropertyControl = {
    kind: "color";
} | {
    kind: "text";
    placeholder?: string;
} | {
    kind: "media";
    role: "background" | "art";
} | {
    kind: "toggle";
} | {
    kind: "range";
    min: number;
    max: number;
    step?: number;
    unit?: string;
} | {
    kind: "select";
    options: readonly SelectOption[];
} | {
    kind: "font";
};
/**
 * A single editable property, declared once and reused across faces and the
 * panel. `propPath` is a dotted path into the settings/props object the value
 * lives at (e.g. `"theme.accentColor"`, `"titleFont"`, `"backgroundMedia"`).
 * `faces` lists which faces expose the property; omitted means every face.
 */
export interface PropertyDescriptor {
    id: string;
    label: string;
    description?: string;
    group: PropertyGroup;
    control: PropertyControl;
    propPath: string;
    default: unknown;
    faces?: readonly PlayerFace[];
}
//# sourceMappingURL=propertyTypes.d.ts.map