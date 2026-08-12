/* Placeholder library workspace. The full playlist engine is intentionally out
   of scope for the workspace-router phase — this is the shell surface that a
   later prompt fills in. */
export function LibraryPlaylistsWorkspace() {
    return (
        <div className="sap-ctl__workspace-empty">
            <p className="sap-ctl__workspace-lead">Playlists coming soon</p>
            <p className="sap-ctl__workspace-sub">Browse, build and reorder playlists from here.</p>
        </div>
    )
}

export default LibraryPlaylistsWorkspace
