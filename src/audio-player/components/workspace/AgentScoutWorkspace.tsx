/* The agent workspaces the Vault arc's Agent branch routes into. Each variant is
   a real SAP Controller destination (the arc never routes anywhere else), sharing
   one surface parameterized by agent so adding an agent is a data change here. */

export type AgentScoutVariant = "demo-scout" | "studio-scout" | "memoir"

const AGENT_COPY: Record<AgentScoutVariant, { lead: string; sub: string }> = {
    "demo-scout": {
        lead: "Demo Scout",
        sub: "Scans your demos and surfaces the ones worth finishing next.",
    },
    "studio-scout": {
        lead: "Studio Scout",
        sub: "Pro session analysis for studio-ready tracks. Requires the Studio entitlement.",
    },
    memoir: {
        lead: "Memoir",
        sub: "Builds a narrated history of a track from its vault versions.",
    },
}

export function AgentScoutWorkspace({ variant }: { variant: AgentScoutVariant }) {
    const copy = AGENT_COPY[variant]
    // Unknown variants can only arrive from untyped (plain JS) hosts; render
    // nothing rather than crash the whole controller sheet.
    if (!copy) return null
    return (
        <div className="sap-ctl__workspace-empty" data-agent={variant}>
            <p className="sap-ctl__workspace-lead">{copy.lead}</p>
            <p className="sap-ctl__workspace-sub">{copy.sub}</p>
        </div>
    )
}

export default AgentScoutWorkspace
