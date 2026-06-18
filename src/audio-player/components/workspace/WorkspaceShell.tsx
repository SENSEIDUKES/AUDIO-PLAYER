import type { ReactNode } from "react"
import { CloseIcon } from "../../skins/icons"
import { parseWorkspaceRoute } from "./workspaceRoutes"
import type { WorkspaceRoute } from "./workspaceRoutes"
import { LibraryPlaylistsWorkspace } from "./LibraryPlaylistsWorkspace"
import { LibraryQueueWorkspace } from "./LibraryQueueWorkspace"
import { PluginSettingsWorkspace } from "./PluginSettingsWorkspace"
import { PlaybackAutomixWorkspace } from "./PlaybackAutomixWorkspace"
import { AgentQueueDirectorWorkspace } from "./AgentQueueDirectorWorkspace"
import { ActivityLogWorkspace } from "../../diagnostics/ActivityLogWorkspace"
import { ControllerPanelRenderer } from "../../visual-slots/ControllerPanelRenderer"
import { LYRIC_DISPLAY_ID } from "../../visual-slots/components/LyricDisplay"
import { VisualSlotPicker } from "../../visual-slots/VisualSlotPicker"
import { useVisualSlots } from "../../visual-slots/VisualSlotsContext"

/* The body of the SAP Controller when it is in a focused-workspace route rather
   than the legacy "options" sheet. SAPController still owns the portal, backdrop,
   focus trap, escape and scroll-lock; this only renders the route-specific header
   and content inside the existing sheet, reusing the sap-ctl__* classes so the
   shell looks identical regardless of route. */

export interface WorkspaceShellProps {
    /** The destination to render. Must not be `"options"` — that path stays on
     *  SAPController's original content. */
    route: WorkspaceRoute
    /** Closes the whole sheet (same handler SAPController uses elsewhere). */
    onClose: () => void
    /** Optional lyrics snapshot forwarded to the lyrics workspace. */
    lyrics?: string
}

/** Human title for the sheet header, keyed by route. */
function titleForRoute(route: WorkspaceRoute): string {
    switch (route) {
        case "library:playlists":
            return "Playlists"
        case "library:queue":
            return "Up Next"
        case "plugin-settings:lyrics":
        case "visual:lyrics":
            return "Lyrics"
        case "plugin-settings:waveform":
            return "Waveform"
        case "playback:automix":
            return "Automix"
        case "agent:queue-director":
            return "Queue Director"
        case "diagnostics:activity-log":
            return "Activity Log"
        case "visual:canvas":
            return "Canvas"
        default:
            return "Workspace"
    }
}

/**
 * The visual:canvas workspace content: a slot picker at the top and the active
 * visual's settings panel below it. Extracted as its own component because it
 * needs hooks (useVisualSlots) and `contentForRoute` is a plain function.
 */
function VisualCanvasWorkspace({ lyrics }: { lyrics?: string }) {
    const { getActive } = useVisualSlots()
    const activeId = getActive("seiCanvas")

    return (
        <>
            <VisualSlotPicker slot="seiCanvas" />
            {activeId ? (
                <ControllerPanelRenderer
                    componentId={activeId}
                    lyrics={lyrics}
                />
            ) : (
                <div className="sap-ctl__workspace-empty">
                    <p className="sap-ctl__workspace-lead">No Visual</p>
                    <p className="sap-ctl__workspace-sub">
                        Select a visual above to configure it.
                    </p>
                </div>
            )}
        </>
    )
}

/**
 * Pick the placeholder workspace surface for a route. Switches on the full route
 * string for known routes (parity with `titleForRoute`) so a future `library:*`
 * or `playback:*` route can't silently fall through to the wrong surface; the
 * `default` only parses for the genuinely dynamic `plugin-settings:<id>` case.
 */
function contentForRoute(route: WorkspaceRoute, lyrics?: string): ReactNode {
    switch (route) {
        case "library:playlists":
            return <LibraryPlaylistsWorkspace />
        case "library:queue":
            return <LibraryQueueWorkspace />
        case "plugin-settings:lyrics":
        case "visual:lyrics":
            // The lyric display is a seiCanvas visual that declares a settings
            // panel; the lyrics route surfaces that panel through the renderer so
            // edits flow straight back to the live canvas visual.
            return (
                <ControllerPanelRenderer
                    componentId={LYRIC_DISPLAY_ID}
                    lyrics={lyrics}
                />
            )
        case "playback:automix":
            return <PlaybackAutomixWorkspace />
        case "agent:queue-director":
            return <AgentQueueDirectorWorkspace />
        case "diagnostics:activity-log":
            return <ActivityLogWorkspace />
        case "visual:canvas":
            return <VisualCanvasWorkspace lyrics={lyrics} />
        default: {
            // Dynamic plugin settings: render the generic stub keyed by id.
            const parsed = parseWorkspaceRoute(route)
            if (parsed?.category === "plugin-settings" && parsed.target) {
                return <PluginSettingsWorkspace pluginId={parsed.target} />
            }
            return null
        }
    }
}

export function WorkspaceShell({ route, onClose, lyrics }: WorkspaceShellProps) {
    return (
        <>
            <header className="sap-ctl__header">
                <h2 className="sap-ctl__title">{titleForRoute(route)}</h2>
                <button
                    type="button"
                    className="sap-ctl__close ap-tap"
                    onClick={onClose}
                    aria-label="Close workspace"
                >
                    <CloseIcon />
                </button>
            </header>
            <div className="sap-ctl__workspace" data-route={route}>
                {contentForRoute(route, lyrics)}
            </div>
        </>
    )
}

export default WorkspaceShell
