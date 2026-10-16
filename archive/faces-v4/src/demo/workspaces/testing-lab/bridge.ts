/* Messages between the Mix & Match Lab and its preview pages (<iframe>s on the
   same origin). Previews report what they can see from inside a real viewport;
   the lab coordinates playback across previews and asks them to run stress
   routines. Both sides check the origin and the message shape. */

export const FRAME_SOURCE = "sap-lab-frame"
export const PARENT_SOURCE = "sap-lab-parent"

export type StressAction = "toggle-storm" | "seek-storm" | "skip-storm" | "volume-sweep"

export const STRESS_LABELS: Record<StressAction, string> = {
    "toggle-storm": "Play/pause ×20",
    "seek-storm": "Seek ×30",
    "skip-storm": "Skip ×12",
    "volume-sweep": "Volume & mute sweep",
}

/** What a preview measures about itself. */
export interface FrameStatus {
    width: number
    height: number
    /** Pixels of content escaping the viewport horizontally (0 = none). */
    overflowPx: number
    /** A short description of the first element that escapes, if any. */
    overflowTarget: string | null
    /** In-page <audio> elements (one per engine). */
    engines: number
    /** How many of them are playing right now. */
    playing: number
    /** Visible error banners (role="alert"). */
    errors: number
}

/** The preview's shared session, when its context has one. */
export interface SessionStatus {
    title: string | null
    state: "playing" | "paused" | "buffering" | "error"
    position: string
    queue: string
    backend: string
}

export interface StressResult {
    action: StressAction
    passed: boolean
    checks: string[]
    durationMs: number
}

type Tone = "info" | "ok" | "warn" | "error"

export type FrameMessage = { source: typeof FRAME_SOURCE; fid: string } & (
    | { type: "status"; status: FrameStatus }
    | { type: "session"; session: SessionStatus | null }
    | { type: "playing" }
    | { type: "log"; text: string; tone?: Tone }
    | { type: "stress-result"; result: StressResult }
)

export type ParentMessage = { source: typeof PARENT_SOURCE } & (
    { type: "pause-all" } | { type: "stress"; action: StressAction }
)

type Distribute<T> = T extends unknown ? Omit<T, "source" | "fid"> : never
export type FrameMessageBody = Distribute<FrameMessage>
export type ParentMessageBody = Distribute<ParentMessage>

export function isFrameMessage(data: unknown): data is FrameMessage {
    return (
        typeof data === "object" &&
        data !== null &&
        (data as { source?: unknown }).source === FRAME_SOURCE &&
        typeof (data as { fid?: unknown }).fid === "string" &&
        typeof (data as { type?: unknown }).type === "string"
    )
}

export function isParentMessage(data: unknown): data is ParentMessage {
    return (
        typeof data === "object" &&
        data !== null &&
        (data as { source?: unknown }).source === PARENT_SOURCE &&
        typeof (data as { type?: unknown }).type === "string"
    )
}

/** Post from a preview page to the lab (no-op when opened on its own). */
export function postToLab(fid: string, body: FrameMessageBody): void {
    if (typeof window === "undefined" || window.parent === window) return
    window.parent.postMessage({ source: FRAME_SOURCE, fid, ...body }, window.location.origin)
}

/** Post from the lab to one preview page. */
export function postToFrame(frame: HTMLIFrameElement | null, body: ParentMessageBody): void {
    frame?.contentWindow?.postMessage({ source: PARENT_SOURCE, ...body }, window.location.origin)
}
