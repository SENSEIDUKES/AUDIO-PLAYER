import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { WorkshopApp } from "./workshop/WorkshopApp"
import "./audio-player-lab.css"
import "./workshop/workshop.css"
import "./reader-ui.css"

/* SEIHouse Audio Player Workshop — the demo's entry point.
   - The Workshop home groups every piece into Players, Systems, Customization,
     and Testing Lab; each card opens one linkable workspace (?workspace=<id>).
   - `?frame=lab` renders a Testing Lab preview page on its own. The Mix & Match
     Lab loads it inside an <iframe> so device sizes are real viewports. */
const rootEl = document.getElementById("root")

if (rootEl) {
    const root = createRoot(rootEl)
    const params = new URLSearchParams(window.location.search)
    if (params.get("frame") === "lab") {
        void import("./workspaces/testing-lab/LabFrameApp").then(({ LabFrameApp }) => {
            root.render(
                <StrictMode>
                    <LabFrameApp />
                </StrictMode>
            )
        })
    } else {
        root.render(
            <StrictMode>
                <WorkshopApp />
            </StrictMode>
        )
    }
}
