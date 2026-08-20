import type { ReactElement } from "react"

export type DemoTab = "showcase" | "lab" | "workshop" | "surfaces"

export const TABS: { id: DemoTab; label: string }[] = [
    { id: "showcase", label: "Showcase" },
    { id: "lab", label: "Lab" },
    { id: "workshop", label: "Workshop" },
    { id: "surfaces", label: "Surfaces" },
]

export interface TabNavProps {
    tab: DemoTab
    onTabChange: (tab: DemoTab) => void
}

export function TabNav({ tab, onTabChange }: TabNavProps): ReactElement {
    return (
        <nav className="demo-mode" aria-label="App sections">
            <div className="demo-mode__meta">
                <p className="demo-mode__eyebrow">SEIHouse Audio Player Lab</p>
                <strong className="demo-mode__title">
                    Showcase, test, and customize player faces
                </strong>
            </div>
            <div className="demo-mode__actions" role="tablist" aria-label="Switch section">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        id={`tab-${t.id}`}
                        aria-controls={`panel-${t.id}`}
                        className={`demo-mode__button${tab === t.id ? " demo-mode__button--active" : ""}`}
                        onClick={() => onTabChange(t.id)}
                        aria-selected={tab === t.id}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </nav>
    )
}
