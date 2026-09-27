import { useState } from "react"
import { AudioSessionProvider, StickyBottomPlayer } from "../../../audio-player"
import type { WorkspaceRoute } from "../../../audio-player"
import { SEA_THEME, TRACK_SETS, TRACK_SET_OPTIONS, isTrackSetId } from "../../data"
import { useWorkspaceParam } from "../../workshop/routing"
import { Button, Note, Panel, SelectField, SplitLayout, StatusBadge } from "../../workshop/ui"
import { ROUTE_STATUS } from "../shared/routes"
import { SessionController, SessionReadout } from "../shared/session"

/* Agent Scout: the Agents arm's destinations. The browser decodes and measures
   the current track, then posts bounded evidence to the same-origin
   /api/agent-scout server, which holds the model key. Locally there is no such
   server, so the analysis step works and the AI step fails honestly. */

const AGENT_ROUTES: readonly { route: WorkspaceRoute; label: string }[] = [
    { route: "agent:demo-scout", label: "Demo Scout" },
    { route: "agent:studio-scout", label: "Studio Scout" },
    { route: "agent:memoir", label: "Memoir" },
    { route: "agent:queue-director", label: "Queue Director" },
]

function describeServer(status: number): string {
    switch (status) {
        case 400:
            return "Reachable — it rejected the empty test request, as expected."
        case 404:
            return "Not running here. The local dev server does not serve /api/agent-scout."
        case 403:
            return "Reachable, but it refused this origin."
        case 429:
            return "Reachable, but rate limited right now."
        case 503:
            return "Reachable, but not configured (missing key or rate limiter)."
        default:
            return `Answered with HTTP ${status}.`
    }
}

export function AgentScoutWorkspace() {
    const [trackSetParam, setTrackSet] = useWorkspaceParam("tracks", "automix")
    const trackSetId = isTrackSetId(trackSetParam) ? trackSetParam : "automix"
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    const [server, setServer] = useState<string>("Not checked yet")

    const checkServer = async () => {
        setServer("Checking…")
        try {
            const response = await fetch("/api/agent-scout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            })
            setServer(describeServer(response.status))
        } catch (error) {
            setServer(`Unreachable: ${(error as Error).message}`)
        }
    }

    return (
        <AudioSessionProvider key={trackSetId} initialQueue={TRACK_SETS[trackSetId].tracks}>
            <SplitLayout
                stage={
                    <>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">Track under review</p>
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </div>
                        <Panel
                            title="Agent destinations"
                            hint="Open each agent inside the controller, exactly where the Agents menu sends it."
                        >
                            <ul className="wk-inline-list">
                                {AGENT_ROUTES.map(({ route: candidate, label }) => (
                                    <li key={candidate} className="wk-inline-list__row">
                                        <span className="wk-inline-list__main">
                                            <span className="wk-inline-list__title">{label}</span>
                                            <span className="wk-inline-list__sub">
                                                {ROUTE_STATUS[candidate].note}
                                            </span>
                                        </span>
                                        <span className="wk-inline-list__actions">
                                            <StatusBadge status={ROUTE_STATUS[candidate].status} />
                                            <Button onClick={() => setRoute(candidate)}>
                                                Open
                                            </Button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                        <Note tone="placeholder">
                            In the controller, press Analyze: the browser decodes the track and
                            measures it (this works with the decodable sample tracks). The next step
                            asks the server for the AI review; without the deployed server it shows
                            an error instead of an answer.
                        </Note>
                        <SessionController
                            route={route}
                            onClose={() => setRoute(null)}
                            theme={SEA_THEME}
                        />
                    </>
                }
                controls={
                    <>
                        <Panel title="Track">
                            <SelectField
                                label="Tracks"
                                value={trackSetId}
                                options={TRACK_SET_OPTIONS}
                                onChange={setTrackSet}
                            />
                            <Note>{TRACK_SETS[trackSetId].note}</Note>
                            <SessionReadout />
                        </Panel>
                        <Panel
                            title="AI server"
                            hint="Sends one empty request to /api/agent-scout to see whether the server exists in this environment. It is rejected before any model call."
                        >
                            <Button onClick={() => void checkServer()}>Check server</Button>
                            <Note>{server}</Note>
                        </Panel>
                    </>
                }
            />
        </AudioSessionProvider>
    )
}
