import { useEffect } from "react"
import { getEntry } from "./catalog"
import { WORKSPACES } from "./registry"
import { navigate, useWorkshopRoute, workspaceHref } from "./routing"
import { installSoloPlayback } from "./soloPlayback"
import { WorkshopHome } from "./WorkshopHome"
import { WorkspaceFrame, WorkspaceNotFound } from "./WorkspaceFrame"

/** Scenario cards open a Mix & Match Lab preset; a link to the card id itself goes there too. */
function Redirect({ href }: { href: string }) {
    useEffect(() => navigate(href, { replace: true }), [href])
    return null
}

/* The Workshop is the demo's entry point. Exactly one route renders at a time:
   the home, or one workspace keyed by its id. Changing route unmounts the
   previous tree (conditional render, never `hidden`), so an engine left playing
   in one workspace stops when you leave it. */
export function WorkshopApp() {
    const route = useWorkshopRoute()

    useEffect(() => installSoloPlayback(document), [])

    if (route.kind === "home") return <WorkshopHome category={route.category} />

    const entry = getEntry(route.id)
    if (entry?.opens) return <Redirect href={workspaceHref(entry.opens)} />
    const Workspace = entry ? WORKSPACES[entry.id] : undefined
    if (!entry || !Workspace) return <WorkspaceNotFound id={route.id} />

    return (
        <WorkspaceFrame key={entry.id} entry={entry}>
            <Workspace />
        </WorkspaceFrame>
    )
}
