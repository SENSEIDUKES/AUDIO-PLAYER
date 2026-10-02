import { useEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import { CardArt } from "./CardArt"
import { WORKSHOP_CATEGORIES, entriesForCategory, entryTarget } from "./catalog"
import type { WorkshopCategoryId, WorkshopEntry } from "./catalog"
import { handleLinkClick, homeHref, navigate, workspaceHref } from "./routing"
import { StatusBadge } from "./ui"

/* The Workshop entry point: five navigation categories, each a grid of cards.
   A card opens one dedicated workspace; roadmap records stay visible but open
   nothing. Tabs write `?category=` so every category is linkable. */

function EntryCard({ entry }: { entry: WorkshopEntry }) {
    const target = entryTarget(entry)
    const body = (
        <>
            <CardArt id={entry.id} category={entry.category} />
            <div className="wk-card__body">
                <div className="wk-card__meta">
                    <StatusBadge status={entry.status} />
                    {entry.opens && <span className="wk-card__via">Opens in Mix &amp; Match</span>}
                </div>
                <h2 className="wk-card__title">{entry.title}</h2>
                <p className="wk-card__summary">{entry.summary}</p>
                <ul className="wk-tags" aria-label="Tags">
                    {entry.tags.map((tag) => (
                        <li key={tag} className="wk-tag">
                            {tag}
                        </li>
                    ))}
                </ul>
                <span className="wk-card__open" aria-hidden="true">
                    {target ? "Open workspace →" : "Nothing to open yet"}
                </span>
            </div>
        </>
    )

    if (!target) {
        return (
            <article className="wk-card wk-card--roadmap" aria-label={`${entry.title} (not built)`}>
                {body}
            </article>
        )
    }

    const href = workspaceHref(target)
    return (
        <a
            className={`wk-card wk-card--${entry.status}`}
            href={href}
            onClick={(event) => handleLinkClick(event, href)}
        >
            {body}
        </a>
    )
}

export function WorkshopHome({ category }: { category: WorkshopCategoryId }) {
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
    const active = WORKSHOP_CATEGORIES.find((c) => c.id === category) ?? WORKSHOP_CATEGORIES[0]
    const entries = entriesForCategory(active.id)

    useEffect(() => {
        document.title = `${active.label} · Audio Player Workshop`
    }, [active.label])

    const select = (id: WorkshopCategoryId) => navigate(homeHref(id))

    const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const count = WORKSHOP_CATEGORIES.length
        let next: number
        switch (event.key) {
            case "ArrowRight":
                next = (index + 1) % count
                break
            case "ArrowLeft":
                next = (index - 1 + count) % count
                break
            case "Home":
                next = 0
                break
            case "End":
                next = count - 1
                break
            default:
                return
        }
        event.preventDefault()
        select(WORKSHOP_CATEGORIES[next].id)
        tabRefs.current[next]?.focus()
    }

    return (
        <div className="wk-home">
            <header className="wk-topbar">
                <div className="wk-brand">
                    <span className="wk-brand__mark">SEIHOUSE</span>
                    <span className="wk-brand__name">Audio Player Workshop</span>
                    <span className="wk-pill" title="Every workspace runs this package source">
                        @seihouse/audio-player v{__SAP_VERSION__}
                    </span>
                </div>
                <div className="wk-tabs" role="tablist" aria-label="Workshop categories">
                    {WORKSHOP_CATEGORIES.map((tab, index) => {
                        const selected = tab.id === active.id
                        return (
                            <button
                                key={tab.id}
                                ref={(element) => {
                                    tabRefs.current[index] = element
                                }}
                                type="button"
                                role="tab"
                                id={`wk-tab-${tab.id}`}
                                aria-selected={selected}
                                aria-controls={`wk-panel-${tab.id}`}
                                tabIndex={selected ? 0 : -1}
                                className={`wk-tab${selected ? " wk-tab--active" : ""}`}
                                onClick={() => select(tab.id)}
                                onKeyDown={(event) => onTabKeyDown(event, index)}
                            >
                                {tab.label}
                                <span className="wk-tab__count">
                                    {entriesForCategory(tab.id).length}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </header>

            <section
                className="wk-home__panel"
                role="tabpanel"
                id={`wk-panel-${active.id}`}
                aria-labelledby={`wk-tab-${active.id}`}
            >
                <header className="wk-home__head">
                    <p className="wk-kicker">Audio Player Workshop</p>
                    <h1 className="wk-home__title">{active.label}</h1>
                    <p className="wk-home__description">{active.description}</p>
                </header>
                <div className="wk-grid">
                    {entries.map((entry) => (
                        <EntryCard key={entry.id} entry={entry} />
                    ))}
                </div>
            </section>

            <footer className="wk-footer">
                <p>
                    Every workspace runs the real package source through its public entry. Leaving a
                    workspace stops its audio, and inside a page, starting one player pauses the
                    others.
                </p>
            </footer>
        </div>
    )
}
