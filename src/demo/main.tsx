import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { WorkshopApp } from "./workshop/WorkshopApp"
import "./audio-player-lab.css"
import "./workshop/workshop.css"
import "./reader-ui.css"

/* SEIHouse Audio Player Workshop — the demo's entry point. The home groups
   every page into Player, Novels (SEN), and Engine; each card opens one
   linkable workspace (?workspace=<id>). */
const rootEl = document.getElementById("root")

if (rootEl) {
    createRoot(rootEl).render(
        <StrictMode>
            <WorkshopApp />
        </StrictMode>
    )
}
