/* The Vault arm's dedicated "…" menu sections. The Vault face's arc replaces
   Plugins with a Vault arm (Tag / Rename / Playlist / Radio); Tag, Rename and
   Radio land here (Playlist reuses the shared playlists workspace). One surface
   parameterized by variant — the same pattern as AgentScoutWorkspace — so each
   is a real SAP Controller destination the vault app can grow into. */

export type VaultActionVariant = "tag" | "rename" | "radio"

const VAULT_ACTION_COPY: Record<VaultActionVariant, { lead: string; sub: string }> =
    {
        tag: {
            lead: "Tag",
            sub: "File this track under a vault classification and add custom tags.",
        },
        rename: {
            lead: "Rename",
            sub: "Rename this track and manage its version label.",
        },
        radio: {
            lead: "Radio",
            sub: "Start a Vault Radio station seeded from this track.",
        },
    }

export function VaultActionWorkspace({ variant }: { variant: VaultActionVariant }) {
    const copy = VAULT_ACTION_COPY[variant]
    // Unknown variants can only arrive from untyped (plain JS) hosts; render
    // nothing rather than crash the whole controller sheet.
    if (!copy) return null
    return (
        <div className="sap-ctl__workspace-empty" data-vault-action={variant}>
            <p className="sap-ctl__workspace-lead">{copy.lead}</p>
            <p className="sap-ctl__workspace-sub">{copy.sub}</p>
        </div>
    )
}

export default VaultActionWorkspace
