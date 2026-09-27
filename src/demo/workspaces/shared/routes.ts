import { WORKSPACE_ROUTES } from "../../../audio-player"
import type { WorkspaceRoute } from "../../../audio-player"
import type { EntryStatus } from "../../workshop/catalog"

/* What each SAP Controller destination actually renders today, checked against
   components/workspace/WorkspaceShell.tsx. Kept in the Workshop (not the
   package) because it is an honest status report, not an API. */

export interface RouteStatus {
    status: EntryStatus
    note: string
}

export const ROUTE_STATUS: Readonly<Record<WorkspaceRoute, RouteStatus>> = {
    options: { status: "live", note: "The controller's own options sheet" },
    "library:playlists": { status: "placeholder", note: "“Playlists coming soon”" },
    "library:queue": { status: "live", note: "Up Next: jump to and remove tracks" },
    "library:vault": {
        status: "partial",
        note: "Lists the vault categories; cannot file a track yet",
    },
    "plugin-settings:lyrics": { status: "live", note: "Lyric Display settings panel" },
    "plugin-settings:waveform": { status: "placeholder", note: "Generic settings stub" },
    "plugin-settings:analytics": { status: "placeholder", note: "Generic settings stub" },
    "plugin-settings:sleep-timer": { status: "placeholder", note: "Generic settings stub" },
    "plugin-settings:auto-theme": { status: "placeholder", note: "Generic settings stub" },
    "playback:automix": { status: "placeholder", note: "“Automix settings coming soon”" },
    "playback:controls": { status: "live", note: "Shuffle, repeat, and Automix switches" },
    "agent:queue-director": { status: "placeholder", note: "“AI queue director coming soon”" },
    "agent:demo-scout": {
        status: "partial",
        note: "Measures audio locally; the AI answer needs the deployed server",
    },
    "agent:studio-scout": {
        status: "partial",
        note: "Measures audio locally; the AI answer needs the deployed server",
    },
    "agent:memoir": {
        status: "partial",
        note: "Measures audio locally; the AI answer needs the deployed server",
    },
    "visual:canvas": { status: "live", note: "Visual picker plus the active visual's settings" },
    "vault:details": { status: "placeholder", note: "“Workspace unavailable”; no menu opens it" },
    "vault:route": { status: "placeholder", note: "“Workspace unavailable”; no menu opens it" },
    "vault:tag": { status: "placeholder", note: "Copy-only screen" },
    "vault:rename": { status: "placeholder", note: "Copy-only screen" },
    "vault:radio": { status: "placeholder", note: "Copy-only screen" },
    "diagnostics:activity-log": {
        status: "live",
        note: "Activity Log panel (empty unless the host mounts ActivityLogProvider)",
    },
}

export const ALL_ROUTES: readonly WorkspaceRoute[] = WORKSPACE_ROUTES
