import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { Showcase } from "./showcase"
import { Lab } from "./lab"
import { Workshop } from "./workshop"
import "./audio-player-lab.css"

/* SEIHouse Audio Player Lab — showcase, test, and customize player faces.
   - Showcase: clean working example of every player face.
   - Lab: QA, broken states, backends, plugins, stress tests.
   - Workshop: restyle a face, toggle plugins, save local presets. */
type DemoTab = "showcase" | "lab" | "workshop"

const TABS: { id: DemoTab; label: string }[] = [
    { id: "showcase", label: "Showcase" },
    { id: "lab", label: "Lab" },
    { id: "workshop", label: "Workshop" },
]

function TabNav({ tab, onTabChange }: { tab: DemoTab; onTabChange: (tab: DemoTab) => void }) {
    return (
        <nav className="demo-mode" aria-label="App sections">
            <div>
                <p className="demo-mode__eyebrow">SEIHouse Audio Player Lab</p>
                <strong className="demo-mode__title">Showcase, test, and customize player faces</strong>
            </div>
            <div className="demo-mode__actions" role="group" aria-label="Switch section">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`demo-mode__button${tab === t.id ? " demo-mode__button--active" : ""}`}
                        onClick={() => onTabChange(t.id)}
                        aria-pressed={tab === t.id}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </nav>
    )
}

function DemoApp() {
    const [tab, setTab] = useState<DemoTab>("showcase")

    return (
        <>
            <TabNav tab={tab} onTabChange={setTab} />
            {/* Conditional render (not hidden) on purpose: switching tabs
                unmounts the engines so audio from one tab never bleeds into
                another. */}
            {tab === "showcase" ? <Showcase /> : tab === "lab" ? <Lab /> : <Workshop />}
        </>
    )
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <DemoApp />
    </StrictMode>
)
