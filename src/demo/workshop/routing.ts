import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { MouseEvent } from "react"
import { DEFAULT_CATEGORY, getCategory } from "./catalog"
import type { WorkshopCategoryId, WorkspaceTarget } from "./catalog"

/* Query-string routing for the Workshop.

   `?category=<id>` selects a home tab and `?workspace=<id>` opens one workspace.
   Query strings (rather than paths) keep every link working on any static host
   and under `vite preview` without rewrite rules, the same convention the
   development repo's Workshop uses (`?preview=<id>`).

   Only one route renders at a time. Changing route unmounts the previous
   workspace, which is what stops its audio engines. */

export type WorkshopRoute =
    | { kind: "home"; category: WorkshopCategoryId }
    | { kind: "workspace"; id: string; params: URLSearchParams }

const NAVIGATE_EVENT = "sap-workshop:navigate"

export function parseRoute(search: string): WorkshopRoute {
    const params = new URLSearchParams(search)
    const workspace = params.get("workspace")
    if (workspace) {
        params.delete("workspace")
        return { kind: "workspace", id: workspace, params }
    }
    const category = getCategory(params.get("category"))?.id ?? DEFAULT_CATEGORY
    return { kind: "home", category }
}

export function homeHref(category: WorkshopCategoryId = DEFAULT_CATEGORY): string {
    return `?category=${category}`
}

export function workspaceHref(target: WorkspaceTarget): string {
    const params = new URLSearchParams({ workspace: target.workspace })
    for (const [key, value] of Object.entries(target.params ?? {})) params.set(key, value)
    return `?${params.toString()}`
}

function subscribe(onChange: () => void): () => void {
    window.addEventListener("popstate", onChange)
    window.addEventListener(NAVIGATE_EVENT, onChange)
    return () => {
        window.removeEventListener("popstate", onChange)
        window.removeEventListener(NAVIGATE_EVENT, onChange)
    }
}

function readSearch(): string {
    return window.location.search
}

/** Push (or replace) a Workshop URL and re-render every route subscriber. */
export function navigate(href: string, { replace = false }: { replace?: boolean } = {}): void {
    const url = new URL(href, window.location.href)
    if (url.search === window.location.search && url.pathname === window.location.pathname) return
    if (replace) window.history.replaceState(null, "", url)
    else window.history.pushState(null, "", url)
    window.dispatchEvent(new Event(NAVIGATE_EVENT))
    if (!replace && typeof window.scrollTo === "function") {
        try {
            window.scrollTo({ top: 0 })
        } catch {
            // Non-browser environments may not implement scrolling.
        }
    }
}

/** The current route, kept in sync with pushState, replaceState, and back/forward. */
export function useWorkshopRoute(): WorkshopRoute {
    const search = useSyncExternalStore(subscribe, readSearch, () => "")
    return useMemo(() => parseRoute(search), [search])
}

/**
 * Workspace-local URL state. Values equal to `defaults` are dropped so shared
 * links stay short; updates replace the history entry instead of stacking one
 * per control change.
 */
export function useWorkspaceParam(
    key: string,
    fallback: string
): [value: string, setValue: (next: string) => void] {
    const search = useSyncExternalStore(subscribe, readSearch, () => "")
    const value = useMemo(
        () => new URLSearchParams(search).get(key) ?? fallback,
        [search, key, fallback]
    )
    const setValue = useCallback(
        (next: string) => {
            const params = new URLSearchParams(window.location.search)
            if (next === fallback) params.delete(key)
            else params.set(key, next)
            navigate(`?${params.toString()}`, { replace: true })
        },
        [key, fallback]
    )
    return [value, setValue]
}

/**
 * Click handler for in-app links: keeps normal browser behavior (new tab,
 * middle click, modifier keys) and otherwise navigates without a reload.
 */
export function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string): void {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.currentTarget.target === "_blank"
    ) {
        return
    }
    event.preventDefault()
    navigate(href)
}
