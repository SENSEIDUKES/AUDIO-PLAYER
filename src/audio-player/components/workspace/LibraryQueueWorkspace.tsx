/* Placeholder queue workspace — the in-shell alternative to the standalone
   QueueSurface / QueueDrawer. For now it only describes itself; wiring it to the
   live session queue is deferred to a later prompt so the router stays scoped. */
export function LibraryQueueWorkspace() {
    return (
        <div className="sap-ctl__workspace-empty">
            <p className="sap-ctl__workspace-lead">Up Next</p>
            <p className="sap-ctl__workspace-sub">
                An in-workspace view of the play queue is on the way. Use the queue drawer for now.
            </p>
        </div>
    )
}

export default LibraryQueueWorkspace
