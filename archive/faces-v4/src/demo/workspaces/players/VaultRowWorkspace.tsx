import { useId, useMemo, useState } from "react"
import { getAllVaultCategories, registerVaultCategory } from "../../../audio-player"
import type { VaultCategoryMeta } from "../../../audio-player"
import { Button, Note, Segmented, Switch, TextField } from "../../workshop/ui"
import { FaceWorkspaceBase } from "./FaceWorkspace"

/* VaultRowPlayer: the Vault's catalog row. Beyond the shared properties it
   tests the two things only this face has — classification colors (including
   host-registered categories) and a host-owned menu. */

function slug(label: string): string {
    const base = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    return `custom-${base || "category"}`
}

export function VaultRowWorkspace() {
    const colorId = useId()
    const [vaultMenu, setVaultMenu] = useState<"vault" | "canonical">("vault")
    const [studioScout, setStudioScout] = useState(false)
    const [label, setLabel] = useState("Live Take")
    const [color, setColor] = useState("#e879f9")
    const [registered, setRegistered] = useState<Array<[string, VaultCategoryMeta]>>([])

    // Rows rotate through the categories registered here first (so a new one
    // shows up on row 1 immediately), then every built-in.
    const rotation = useMemo(
        () => [
            ...registered.map(([id]) => id),
            ...getAllVaultCategories()
                .map(([id]) => id)
                .filter((id) => !registered.some(([own]) => own === id)),
        ],
        [registered]
    )

    const register = () => {
        const name = label.trim()
        if (!name) return
        const id = slug(name)
        const meta = { label: name, color }
        registerVaultCategory(id, meta)
        setRegistered((prev) => [[id, meta], ...prev.filter(([existing]) => existing !== id)])
    }

    return (
        <FaceWorkspaceBase
            faceId="vault-row"
            options={{ vaultMenu, studioScout, vaultCategories: rotation }}
            extraControls={
                <>
                    <Segmented
                        label="Row menu"
                        value={vaultMenu}
                        options={[
                            { value: "vault", label: "Vault app's menu" },
                            { value: "canonical", label: "SAP canonical" },
                        ]}
                        onChange={setVaultMenu}
                    />
                    <Switch
                        label="Studio Scout entitlement"
                        hint="Off routes Agents › Scout to the free Demo Scout"
                        checked={studioScout}
                        onChange={setStudioScout}
                    />
                    <div className="wk-field">
                        <span className="wk-field__label">Register a custom category</span>
                        <TextField label="Label" value={label} onChange={setLabel} />
                        <div className="wk-field__row">
                            <label className="wk-field__label" htmlFor={colorId}>
                                Color
                            </label>
                            <input
                                id={colorId}
                                type="color"
                                value={color}
                                onChange={(event) => setColor(event.target.value)}
                            />
                        </div>
                        <Button onClick={register} variant="primary" disabled={!label.trim()}>
                            Register category
                        </Button>
                    </div>
                    {registered.length > 0 && (
                        <ul className="wk-chip-list" aria-label="Categories registered here">
                            {registered.map(([id, meta]) => (
                                <li key={id} className="wk-tag">
                                    <span className="wk-dot" style={{ background: meta.color }} />
                                    {meta.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            }
            stageNote={
                <Note tone="placeholder">
                    Open a row's radial menu or “…” button: Vault › Tag, Rename, and Radio are
                    copy-only screens, Vault › Playlist says “coming soon”, and Share › Add to lists
                    categories without filing the track. Registered categories last until this tab
                    reloads.
                </Note>
            }
        />
    )
}
