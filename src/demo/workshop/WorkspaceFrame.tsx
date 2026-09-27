import { Component, Suspense, useEffect, useState } from "react"
import type { ErrorInfo, ReactNode } from "react"
import { ArrowLeft, Check, Link2 } from "lucide-react"
import { getCategory } from "./catalog"
import type { WorkshopEntry } from "./catalog"
import { handleLinkClick, homeHref } from "./routing"
import { StatusBadge } from "./ui"

/* The chrome every workspace shares: a way back, where you are, how finished
   the piece is, and an honest list of what works and what is still a
   placeholder. The workspace itself renders below it. */

function CopyLinkButton() {
    const [copied, setCopied] = useState(false)
    useEffect(() => {
        if (!copied) return
        const timer = setTimeout(() => setCopied(false), 1600)
        return () => clearTimeout(timer)
    }, [copied])
    return (
        <button
            type="button"
            className="wk-bar__copy"
            onClick={() => {
                void navigator.clipboard
                    ?.writeText(window.location.href)
                    .then(() => setCopied(true))
                    .catch(() => {
                        // Clipboard can be blocked; the address bar has the link anyway.
                    })
            }}
            aria-label="Copy link to this workspace"
        >
            {copied ? <Check size={14} /> : <Link2 size={14} />}
            <span>{copied ? "Copied" : "Copy link"}</span>
        </button>
    )
}

class WorkspaceErrorBoundary extends Component<
    { children: ReactNode; backHref: string },
    { error: Error | null }
> {
    state: { error: Error | null } = { error: null }

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Workshop workspace crashed:", error, info)
    }

    render() {
        if (this.state.error) {
            return (
                <div className="wk-crash" role="alert">
                    <p className="wk-crash__title">This workspace hit an error.</p>
                    <p className="wk-crash__message">{this.state.error.message}</p>
                    <a
                        className="wk-btn wk-btn--primary"
                        href={this.props.backHref}
                        onClick={(event) => handleLinkClick(event, this.props.backHref)}
                    >
                        Back to the Workshop
                    </a>
                </div>
            )
        }
        return this.props.children
    }
}

export function WorkspaceFrame({ entry, children }: { entry: WorkshopEntry; children: ReactNode }) {
    const category = getCategory(entry.category)
    const backHref = homeHref(entry.category)

    useEffect(() => {
        document.title = `${entry.title} · Audio Player Workshop`
    }, [entry.title])

    return (
        <div className="wk-page">
            <header className="wk-bar">
                <a
                    className="wk-bar__back"
                    href={backHref}
                    onClick={(event) => handleLinkClick(event, backHref)}
                >
                    <ArrowLeft size={15} />
                    <span>Workshop</span>
                </a>
                <nav className="wk-bar__crumbs" aria-label="Breadcrumb">
                    <a href={backHref} onClick={(event) => handleLinkClick(event, backHref)}>
                        {category?.label}
                    </a>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{entry.title}</span>
                </nav>
                <div className="wk-bar__end">
                    <StatusBadge status={entry.status} />
                    <CopyLinkButton />
                </div>
            </header>

            <main className="wk-workspace" aria-labelledby="wk-workspace-title">
                <header className="wk-ws-head">
                    <div className="wk-ws-head__copy">
                        <p className="wk-kicker">{category?.label}</p>
                        <h1 className="wk-ws-head__title" id="wk-workspace-title">
                            {entry.title}
                        </h1>
                        <p className="wk-ws-head__summary">{entry.summary}</p>
                    </div>
                    <div className="wk-ws-head__facts">
                        {entry.working.length > 0 && (
                            <div className="wk-facts wk-facts--working">
                                <h2 className="wk-facts__title">Working here</h2>
                                <ul>
                                    {entry.working.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {entry.placeholders && entry.placeholders.length > 0 && (
                            <div className="wk-facts wk-facts--placeholder">
                                <h2 className="wk-facts__title">Placeholders &amp; limits</h2>
                                <ul>
                                    {entry.placeholders.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </header>

                <WorkspaceErrorBoundary backHref={backHref}>
                    <Suspense
                        fallback={
                            <div className="wk-loading" role="status">
                                Loading workspace…
                            </div>
                        }
                    >
                        {children}
                    </Suspense>
                </WorkspaceErrorBoundary>
            </main>
        </div>
    )
}

export function WorkspaceNotFound({ id }: { id: string }) {
    const href = homeHref()
    return (
        <div className="wk-page">
            <main className="wk-workspace wk-missing">
                <h1 className="wk-ws-head__title">No workspace called “{id}”</h1>
                <p className="wk-ws-head__summary">
                    The link may be from an older version of the Workshop.
                </p>
                <a
                    className="wk-btn wk-btn--primary"
                    href={href}
                    onClick={(event) => handleLinkClick(event, href)}
                >
                    Back to the Workshop
                </a>
            </main>
        </div>
    )
}
