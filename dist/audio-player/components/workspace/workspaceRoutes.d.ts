/**
 * Workspace routing model for the SAP Controller shell.
 *
 * The SAP Controller started life as a single "…" options sheet. It is now a
 * reusable workspace *shell*: the same portal, focus trap, escape handling and
 * body-scroll lock host either the legacy options surface (`"options"`) or a
 * focused configuration workspace selected from the radial action menu
 * (e.g. `"plugin-settings:lyrics"`).
 *
 * A route is a `category:target` string (the bare `"options"` route has no
 * target). Categories group routes by which workspace surface renders them.
 * Deliberately free of any engine/session/React imports so the routing model
 * can later be promoted into the seihouse-ui design system alongside the menu
 * data model.
 */
/** Every workspace route the shell knows how to render. */
export declare const WORKSPACE_ROUTES: readonly ["options", "library:playlists", "library:queue", "library:vault", "plugin-settings:lyrics", "plugin-settings:waveform", "playback:automix", "agent:queue-director", "agent:demo-scout", "agent:studio-scout", "agent:memoir", "visual:canvas", "visual:lyrics", "diagnostics:activity-log"];
/** A validated workspace destination. `"options"` is the legacy default. */
export type WorkspaceRoute = (typeof WORKSPACE_ROUTES)[number];
/** The top-level grouping of a route, taken from the part before the `:`. */
export type WorkspaceRouteCategory = "options" | "library" | "plugin-settings" | "playback" | "agent" | "visual" | "diagnostics";
/** A route broken into its category + target for the shell to dispatch on. */
export interface ParsedWorkspaceRoute {
    /** The full, validated route string. */
    route: WorkspaceRoute;
    /** The portion before the `:` (or `"options"` for the bare route). */
    category: WorkspaceRouteCategory;
    /** The portion after the `:`, or `null` for the bare `"options"` route. */
    target: string | null;
}
/** Whether an arbitrary string is a known workspace route. */
export declare function isWorkspaceRoute(value: string): value is WorkspaceRoute;
/**
 * Validate and categorize a route string. Returns `null` for any value that is
 * not a known route, so callers can fall back to `"options"` (or ignore an
 * unrecognized node) rather than render an empty shell.
 */
export declare function parseWorkspaceRoute(value: string | null | undefined): ParsedWorkspaceRoute | null;
//# sourceMappingURL=workspaceRoutes.d.ts.map