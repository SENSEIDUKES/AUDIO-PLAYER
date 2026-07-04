import { describe, expect, it, vi } from "vitest"
import {
    isArcActionLive,
    pruneDeadArcActions,
    resolveArcActionState,
    routeArcAction,
} from "../arcRouting"
import type { ArcAction, ArcCommandHost } from "../arcRouting"

const NOOP_HOST: ArcCommandHost = {}

describe("resolveArcActionState", () => {
    it("derives locked from a locked-entitlement target", () => {
        expect(
            resolveArcActionState({ id: "x", label: "X", target: "locked-entitlement" })
        ).toBe("locked")
    })

    it("defaults to available and lets an explicit state win", () => {
        expect(resolveArcActionState({ id: "x", label: "X" })).toBe("available")
        expect(
            resolveArcActionState({
                id: "x",
                label: "X",
                target: "locked-entitlement",
                state: "disabled",
            })
        ).toBe("disabled")
    })
})

describe("routeArcAction", () => {
    it("runs an immediate command from the host's command map", () => {
        const run = vi.fn()
        const action: ArcAction = {
            id: "play-next",
            label: "Play Next",
            target: "immediate-action",
            action: "queue.insertAfterCurrent",
        }
        expect(
            routeArcAction(action, { commands: { "queue.insertAfterCurrent": run } })
        ).toBe(true)
        expect(run).toHaveBeenCalledTimes(1)
    })

    it("falls back to an inline onSelect when the command id has no host implementation", () => {
        const onSelect = vi.fn()
        const action: ArcAction = {
            id: "play-next",
            label: "Play Next",
            target: "immediate-action",
            action: "queue.insertAfterCurrent",
            onSelect,
        }
        expect(routeArcAction(action, { commands: {} })).toBe(true)
        expect(onSelect).toHaveBeenCalledWith("play-next")
    })

    it("routes sei-canvas leaves to openCanvas", () => {
        const openCanvas = vi.fn()
        const action: ArcAction = { id: "c", label: "Canvas", target: "sei-canvas" }
        expect(routeArcAction(action, { openCanvas })).toBe(true)
        expect(openCanvas).toHaveBeenCalledTimes(1)
        expect(routeArcAction(action, NOOP_HOST)).toBe(false)
    })

    it("routes sap-controller leaves to openWorkspace with their route", () => {
        const openWorkspace = vi.fn()
        const action: ArcAction = {
            id: "v",
            label: "Playlist",
            target: "sap-controller",
            workspaceRoute: "library:playlists",
        }
        expect(routeArcAction(action, { openWorkspace })).toBe(true)
        expect(openWorkspace).toHaveBeenCalledWith("library:playlists")
    })

    it("never routes a locked-entitlement leaf", () => {
        const openWorkspace = vi.fn()
        const action: ArcAction = {
            id: "studio",
            label: "Studio Scout",
            target: "locked-entitlement",
            workspaceRoute: "agent:studio-scout",
        }
        expect(routeArcAction(action, { openWorkspace })).toBe(false)
        expect(openWorkspace).not.toHaveBeenCalled()
    })

    it("treats a targetless onSelect leaf as an immediate action (legacy API)", () => {
        const onSelect = vi.fn()
        expect(routeArcAction({ id: "a", label: "A", onSelect }, NOOP_HOST)).toBe(true)
        expect(onSelect).toHaveBeenCalledWith("a")
    })
})

describe("pruneDeadArcActions", () => {
    const tree: ArcAction[] = [
        {
            id: "add-to-queue",
            label: "Add to Queue",
            children: [
                {
                    id: "play-next",
                    label: "Play Next",
                    target: "immediate-action",
                    action: "queue.insertAfterCurrent",
                },
            ],
        },
        {
            id: "vault",
            label: "Vault",
            children: [
                {
                    id: "vault-playlist",
                    label: "Playlist",
                    target: "sap-controller",
                    workspaceRoute: "library:playlists",
                },
            ],
        },
        { id: "canvas", label: "Canvas", target: "sei-canvas" },
        { id: "studio", label: "Studio Scout", target: "locked-entitlement" },
        { id: "dead", label: "Dead", target: "immediate-action", action: "no.impl" },
    ]

    it("drops leaves the host can't resolve and branches left empty", () => {
        const pruned = pruneDeadArcActions(tree, {
            commands: { "queue.insertAfterCurrent": () => {} },
        })
        expect(pruned.map((a) => a.id)).toEqual(["add-to-queue", "studio"])
    })

    it("keeps everything when the host wires all destinations", () => {
        const host: ArcCommandHost = {
            commands: { "queue.insertAfterCurrent": () => {}, "no.impl": () => {} },
            openCanvas: () => {},
            openWorkspace: () => {},
        }
        const pruned = pruneDeadArcActions(tree, host)
        expect(pruned.map((a) => a.id)).toEqual([
            "add-to-queue",
            "vault",
            "canvas",
            "studio",
            "dead",
        ])
    })

    it("keeps locked leaves visible — the lock is the honest behavior", () => {
        expect(isArcActionLive({ id: "s", label: "S", target: "locked-entitlement" }, NOOP_HOST)).toBe(true)
    })

    it("marks a sap-controller leaf without a route as dead", () => {
        expect(
            isArcActionLive(
                { id: "x", label: "X", target: "sap-controller" },
                { openWorkspace: () => {} }
            )
        ).toBe(false)
    })
})
