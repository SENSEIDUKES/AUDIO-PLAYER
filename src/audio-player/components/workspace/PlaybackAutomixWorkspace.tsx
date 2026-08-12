/* Placeholder automix workspace. The automix engine itself is untouched — this
   surface will later expose its tuning controls (fade length, beat snapping,
   Pro analysis) without rewriting the engine. */
export function PlaybackAutomixWorkspace() {
    return (
        <div className="sap-ctl__workspace-empty">
            <p className="sap-ctl__workspace-lead">Automix settings coming soon</p>
            <p className="sap-ctl__workspace-sub">
                Crossfade length, beat snapping and transition tuning will live here.
            </p>
        </div>
    )
}

export default PlaybackAutomixWorkspace
