import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { Showcase } from "./showcase"
import { Lab } from "./lab"
import { Workshop } from "./workshop"
import { SurfacesDemo } from "./surfaces"
import { TabNav } from "./TabNav"
import type { DemoTab } from "./TabNav"
import "./audio-player-lab.css"

/* SEIHouse Audio Player Lab — showcase, test, and customize player faces.
   - Showcase: clean working example of every player face.
   - Lab: QA, broken states, backends, plugins, stress tests.
   - Workshop: restyle a face, toggle plugins, save local presets. */
function DemoApp() {
    const [tab, setTab] = useState<DemoTab>("showcase")

    return (
        <>
            <TabNav tab={tab} onTabChange={setTab} />
            {/* Conditional render (not hidden) on purpose: switching tabs
                unmounts the engines so audio from one tab never bleeds into
                another. */}
            {tab === "showcase" ? (
                <Showcase />
            ) : tab === "lab" ? (
                <Lab />
            ) : tab === "workshop" ? (
                <Workshop />
            ) : (
                <SurfacesDemo />
            )}
        </>
    )
}

const rootEl = document.getElementById("root")
if (rootEl) {
    createRoot(rootEl).render(
        <StrictMode>
            <DemoApp />
        </StrictMode>
    )
}

export { DemoApp }
