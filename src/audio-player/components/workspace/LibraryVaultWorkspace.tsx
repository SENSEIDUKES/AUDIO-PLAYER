import { getAllVaultCategories } from "../../skins/vaultCategories"

/* The Vault "Add To" workspace: the SAP Controller destination the Vault arc's
   Add To leaf routes into. Lists the registered vault classifications so a track
   can be filed; the actual assignment flow lands with the vault library phase. */
export function LibraryVaultWorkspace() {
    const categories = getAllVaultCategories()
    return (
        <div className="sap-ctl__workspace-empty">
            <p className="sap-ctl__workspace-lead">Add to Vault</p>
            <p className="sap-ctl__workspace-sub">
                File this track under a vault classification.
            </p>
            {categories.length > 0 && (
                <ul className="sap-ctl__workspace-list" aria-label="Vault classifications">
                    {categories.map(([id, meta]) => (
                        <li key={id} className="sap-ctl__workspace-item">
                            <span
                                className="sap-ctl__workspace-swatch"
                                style={{ background: meta.color }}
                                aria-hidden="true"
                            />
                            {meta.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default LibraryVaultWorkspace
