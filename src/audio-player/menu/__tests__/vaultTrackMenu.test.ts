import { describe, expect, it } from "vitest"
import { buildVaultTrackArcActions } from "../vaultTrackMenu"
import { isWorkspaceRoute } from "../../components/workspace/workspaceRoutes"
import { pruneDeadArcActions, resolveArcActionState } from "../arcRouting"
import type { ArcAction } from "../arcRouting"

function collectLeaves(actions: ArcAction[], out: ArcAction[] = []): ArcAction[] {
    for (const a of actions) {
        if (a.children && a.children.length > 0) collectLeaves(a.children, out)
        else out.push(a)
    }
    return out
}

describe("buildVaultTrackArcActions", () => {
    it("matches the Vault-face command wheel spec (root + submenus)", () => {
        const tree = buildVaultTrackArcActions()
        expect(tree.map((a) => a.label)).toEqual([
            "Add to Queue",
            "Share",
            "Vault",
            "Agent",
        ])
        const byLabel = Object.fromEntries(
            tree.map((a) => [a.label, a.children!.map((c) => c.label)])
        )
        expect(byLabel["Add to Queue"]).toEqual(["Play Next", "Play Later"])
        expect(byLabel["Share"]).toEqual(["Email", "URL"])
        expect(byLabel["Vault"]).toEqual(["Add To", "Playlist"])
        expect(byLabel["Agent"]).toEqual(["Demo Scout", "Studio Scout", "Memoir"])
    })

    it("gives every leaf an explicit routing target with a resolvable destination", () => {
        for (const leaf of collectLeaves(buildVaultTrackArcActions())) {
            expect(leaf.target, leaf.id).toBeDefined()
            if (leaf.target === "immediate-action") {
                expect(leaf.action, leaf.id).toBeDefined()
            }
            if (leaf.target === "sap-controller") {
                expect(leaf.workspaceRoute, leaf.id).toBeDefined()
                expect(isWorkspaceRoute(leaf.workspaceRoute!)).toBe(true)
            }
        }
    })

    it("binds Play Next to insert-after-current and Play Later to append", () => {
        const leaves = collectLeaves(buildVaultTrackArcActions())
        const playNext = leaves.find((l) => l.id === "play-next")!
        const playLater = leaves.find((l) => l.id === "play-later")!
        expect(playNext.action).toBe("queue.insertAfterCurrent")
        expect(playLater.action).toBe("queue.append")
    })

    it("locks Studio Scout when the entitlement is missing, routes it when present", () => {
        const locked = collectLeaves(buildVaultTrackArcActions()).find(
            (l) => l.id === "agent-studio-scout"
        )!
        expect(locked.target).toBe("locked-entitlement")
        expect(resolveArcActionState(locked)).toBe("locked")

        const unlocked = collectLeaves(
            buildVaultTrackArcActions({ entitlements: { studioScout: true } })
        ).find((l) => l.id === "agent-studio-scout")!
        expect(unlocked.target).toBe("sap-controller")
        expect(unlocked.workspaceRoute).toBe("agent:studio-scout")
    })

    it("prunes Vault/Agent branches (except the locked leaf's honesty) on a host without SAP routing", () => {
        const pruned = pruneDeadArcActions(buildVaultTrackArcActions(), {
            commands: {
                "queue.insertAfterCurrent": () => {},
                "queue.append": () => {},
            },
        })
        // Share dies (no share commands wired), Vault dies (no workspace
        // routing), Agent keeps only the locked Studio Scout leaf.
        expect(pruned.map((a) => a.id)).toEqual(["add-to-queue", "agent"])
        expect(pruned[1].children!.map((c) => c.id)).toEqual(["agent-studio-scout"])
    })

    it("keeps the full wheel on a fully wired host", () => {
        const pruned = pruneDeadArcActions(buildVaultTrackArcActions(), {
            commands: {
                "queue.insertAfterCurrent": () => {},
                "queue.append": () => {},
                "share.email": () => {},
                "share.url": () => {},
            },
            openWorkspace: () => {},
        })
        expect(pruned).toHaveLength(4)
        expect(collectLeaves(pruned)).toHaveLength(9)
    })
})
