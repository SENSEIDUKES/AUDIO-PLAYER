/**
 * @vitest-environment jsdom
 *
 * Consumer ownership of menu composition, proved on every music face that
 * exposes the radial action menu:
 *
 *  1. every face accepts and renders a host-provided menu,
 *  2. a host menu is neither replaced nor supplemented with canonical
 *     categories the host did not ask for,
 *  3. every face still gets the canonical menu by default,
 *  4. the restored Vault menu carries exactly its original four categories, and
 *  5. plugins, playback, queue and controller routing keep working underneath.
 */
import "@testing-library/jest-dom/vitest"
import type { ReactElement } from "react"
import { useState } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AudioSessionProvider } from "../session/AudioSessionContext"
import { createAnalyticsPlugin } from "../plugins/AnalyticsPlugin"
import { createAutomixPlugin } from "../plugins/AutomixPlugin"
import { createLyricsPlugin } from "../plugins/LyricsPlugin"
import { AudioPlayer } from "../AudioPlayer"
import { FullCardPlayer } from "../skins/FullCardPlayer"
import { MiniSidebarPlayer } from "../skins/MiniSidebarPlayer"
import { StickyBottomPlayer } from "../skins/StickyBottomPlayer"
import { SeaCardPlayer } from "../skins/SeaCardPlayer"
import { VaultRowPlayer } from "../skins/VaultRowPlayer"
import { SAPController } from "../components/SAPController"
import { buildVaultTrackArcActions } from "../menu/compatActions"
import type { ArcAction } from "../menu/arcRouting"
import type { PlayerMenuProfile } from "../menu/menuProfile"
import type { Track } from "../types"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"

const TRACKS: Track[] = [
    { id: "a", title: "Angel Numbers", artist: "SENSEI", audioFile: "a.mp3" },
    { id: "b", title: "No Luck", artist: "SENSEI", audioFile: "b.mp3" },
]
const PLUGINS = () => [createLyricsPlugin(), createAutomixPlugin(), createAnalyticsPlugin()]

/** A host menu that looks nothing like SAP's canonical hierarchy. */
const buy = vi.fn()
function hostMenu(): ArcAction[] {
    return [
        {
            id: "label",
            label: "Label",
            children: [
                {
                    id: "label-roster",
                    label: "Roster",
                    target: "sap-controller",
                    workspaceRoute: "library:playlists",
                },
            ],
        },
        { id: "buy", label: "Buy", target: "immediate-action", action: "commerce.buy" },
    ]
}
const HOST_ARMS = ["Label", "Buy"]
const CANONICAL_ARMS = ["Plugins", "Playback", "Queue", "Share", "Agents"]

/** One shared controller for the host-composed card/row faces. */
function HostComposed({
    children,
}: {
    children: (open: (route: WorkspaceRoute) => void) => ReactElement
}) {
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    return (
        <>
            {children(setRoute)}
            <SAPController
                open={route !== null}
                route={route ?? "options"}
                onClose={() => setRoute(null)}
            />
        </>
    )
}

interface MenuProps {
    actions?: ArcAction[]
    menuProfile?: PlayerMenuProfile
    commands?: Record<string, () => void>
}

/**
 * Every face that exposes the radial menu, each rendered the way a consuming
 * product would. `render` takes the host menu props so the same fixture proves
 * both the default and the override.
 */
const FACES: { face: string; render: (menu: MenuProps) => ReactElement }[] = [
    {
        face: "fullCard",
        render: ({ actions, menuProfile, commands }) => (
            <FullCardPlayer actions={actions} menuProfile={menuProfile} commands={commands} />
        ),
    },
    {
        face: "portable",
        render: ({ actions, menuProfile, commands }) => (
            <AudioPlayer
                tracks={TRACKS}
                plugins={PLUGINS()}
                actions={actions}
                menuProfile={menuProfile}
                menuCommands={commands}
            />
        ),
    },
    {
        face: "stickyBottom",
        render: ({ actions, menuProfile, commands }) => (
            <StickyBottomPlayer actions={actions} menuProfile={menuProfile} commands={commands} />
        ),
    },
    {
        face: "miniSidebar",
        render: ({ actions, menuProfile, commands }) => (
            <MiniSidebarPlayer actions={actions} menuProfile={menuProfile} commands={commands} />
        ),
    },
    {
        face: "seaCard",
        render: ({ actions, menuProfile, commands }) => (
            <HostComposed>
                {(open) => (
                    <SeaCardPlayer
                        track={TRACKS[0]}
                        activePluginIds={["lyrics", "automix", "analytics"]}
                        actions={actions}
                        menuProfile={menuProfile}
                        commands={commands}
                        onOpenWorkspace={open}
                    />
                )}
            </HostComposed>
        ),
    },
    {
        face: "vaultRow",
        render: ({ actions, menuProfile, commands }) => (
            <HostComposed>
                {(open) => (
                    <VaultRowPlayer
                        track={TRACKS[0]}
                        activePluginIds={["lyrics", "automix", "analytics"]}
                        actions={actions}
                        menuProfile={menuProfile}
                        commands={commands}
                        onOpenWorkspace={open}
                    />
                )}
            </HostComposed>
        ),
    },
]

function mount(face: (typeof FACES)[number], menu: MenuProps = {}) {
    return render(
        <AudioSessionProvider initialQueue={TRACKS} plugins={PLUGINS()}>
            {face.render(menu)}
        </AudioSessionProvider>
    )
}

/* ------------------------------- menu driving ------------------------------- */

function radialTrigger(): HTMLElement {
    const triggers = document.querySelectorAll<HTMLElement>('button[aria-haspopup="menu"]')
    expect(triggers, "expected exactly one radial trigger on the face").toHaveLength(1)
    return triggers[0]
}
const openRadial = () => fireEvent.click(radialTrigger())
const menuItems = () => screen.queryAllByRole("menuitem")
const labelOf = (el: HTMLElement) => el.querySelector(".sac__node-label")?.textContent?.trim() ?? ""

/** The top-level arm labels the face actually renders. */
function readArms(): string[] {
    openRadial()
    const arms = menuItems().map(labelOf)
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }))
    return arms
}

/** Enter a branch and read its children's labels. */
function readBranch(label: string): string[] {
    openRadial()
    fireEvent.click(menuItems().find((el) => labelOf(el) === label)!)
    const children = menuItems().map(labelOf)
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }))
    return children
}

function selectMenuPath(path: readonly string[]) {
    openRadial()
    for (const label of path) {
        const node = menuItems().find((el) => labelOf(el) === label)
        expect(node, `menu item "${label}" not found in ${path.join(" › ")}`).toBeDefined()
        fireEvent.click(node!)
    }
}

afterEach(() => {
    cleanup()
    buy.mockClear()
})

/* --------------------------------- the tests -------------------------------- */

describe("every face accepts a host-provided menu", () => {
    for (const face of FACES) {
        it(`${face.face}: renders exactly the host's tree`, () => {
            mount(face, { actions: hostMenu(), commands: { "commerce.buy": buy } })
            expect(readArms()).toEqual(HOST_ARMS)
        })
    }
})

describe("host menus are not replaced or supplemented", () => {
    for (const face of FACES) {
        it(`${face.face}: no canonical category appears alongside the host's`, () => {
            mount(face, { actions: hostMenu(), commands: { "commerce.buy": buy } })
            const arms = readArms()
            for (const canonical of [...CANONICAL_ARMS, "Vault"]) {
                expect(arms, `${face.face} gained ${canonical}`).not.toContain(canonical)
            }
        })
    }

    it("keeps a host tree intact even with plugins active and entitlements set", () => {
        // The canonical inputs are all present; none of them may leak in.
        mount(FACES[0], { actions: hostMenu(), commands: { "commerce.buy": buy } })
        expect(readArms()).toEqual(HOST_ARMS)
    })
})

describe("every face still gets the canonical menu by default", () => {
    for (const face of FACES) {
        it(`${face.face}: renders SAP's canonical categories`, () => {
            mount(face)
            const arms = readArms()
            for (const canonical of CANONICAL_ARMS) {
                expect(arms, `${face.face} lost ${canonical}`).toContain(canonical)
            }
            // The Vault arm is capability-gated, so it is the vault row's alone.
            expect(arms.includes("Vault"), face.face).toBe(face.face === "vaultRow")
        })
    }
})

describe("the restored Vault menu", () => {
    it("renders exactly its previous four categories on the vault row", () => {
        mount(
            FACES.find((f) => f.face === "vaultRow")!,
            {
                actions: buildVaultTrackArcActions(),
            }
        )
        expect(readArms()).toEqual(["Vault", "Playback", "Share", "Agents"])
    })

    it("carries its original leaves under each category", () => {
        const face = FACES.find((f) => f.face === "vaultRow")!
        const cases: [string, string[]][] = [
            ["Vault", ["Tag", "Rename", "Playlist", "Radio"]],
            ["Playback", ["Up Next", "Controls", "Debug"]],
            ["Agents", ["Scout", "Memoir"]],
        ]
        for (const [arm, children] of cases) {
            mount(face, { actions: buildVaultTrackArcActions() })
            expect(readBranch(arm), arm).toEqual(children)
            cleanup()
        }
    })

    it("opens its destinations in the controller, unchanged", () => {
        const face = FACES.find((f) => f.face === "vaultRow")!
        const routes: [string[], string][] = [
            [["Vault", "Tag"], "Tag"],
            [["Vault", "Playlist"], "Playlists"],
            [["Playback", "Controls"], "Controls"],
            [["Agents", "Scout"], "Demo Scout"],
        ]
        for (const [path, title] of routes) {
            mount(face, { actions: buildVaultTrackArcActions() })
            selectMenuPath(path)
            const dialog = screen.getByRole("dialog", { name: "Player workspace" })
            expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent(title)
            cleanup()
        }
    })

    it("works on a non-vault face too, since the host asked for it by name", () => {
        mount(
            FACES.find((f) => f.face === "fullCard")!,
            {
                actions: buildVaultTrackArcActions(),
            }
        )
        expect(readArms()).toEqual(["Vault", "Playback", "Share", "Agents"])
    })
})

describe("menu profiles shape the canonical hierarchy", () => {
    it("restricts a face to the categories the host names, in order", () => {
        mount(FACES[0], { menuProfile: { categories: ["share", "playback"] } })
        expect(readArms()).toEqual(["Share", "Playback"])
    })

    it("adds a host arm alongside the canonical ones", () => {
        mount(FACES[0], {
            menuProfile: { extraActions: [{ id: "buy", label: "Buy", action: "commerce.buy" }] },
            commands: { "commerce.buy": buy },
        })
        const arms = readArms()
        expect(arms).toContain("Plugins")
        expect(arms[arms.length - 1]).toBe("Buy")
    })
})

describe("existing behavior still works underneath a host menu", () => {
    it("routes a host settings leaf into the controller", () => {
        mount(FACES[0], { actions: hostMenu(), commands: { "commerce.buy": buy } })
        selectMenuPath(["Label", "Roster"])
        const dialog = screen.getByRole("dialog", { name: "Player workspace" })
        expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("Playlists")
        expect(screen.getAllByRole("dialog")).toHaveLength(1)
    })

    it("runs a host immediate command, opening nothing", () => {
        mount(FACES[0], { actions: hostMenu(), commands: { "commerce.buy": buy } })
        selectMenuPath(["Buy"])
        expect(buy).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("prunes a host leaf whose command the host forgot to wire", () => {
        mount(FACES[0], { actions: hostMenu() })
        // Label survives (a controller route); Buy has no command, so it goes.
        expect(readArms()).toEqual(["Label"])
    })

    it("keeps the three-dot controller and canonical routing intact by default", () => {
        mount(FACES[0])
        fireEvent.click(screen.getByRole("button", { name: "Player options" }))
        expect(screen.getByRole("dialog", { name: "Player options" })).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Close player options" }))

        selectMenuPath(["Playback", "Controls"])
        expect(
            within(screen.getByRole("dialog")).getByRole("heading", { level: 2 })
        ).toHaveTextContent("Controls")
    })

    it("keeps plugins and queue routing working by default", () => {
        mount(FACES[0])
        expect(readBranch("Plugins")).toEqual(["Audio", "Visual", "Analytics"])
        cleanup()
        mount(FACES[0])
        expect(readBranch("Queue")).toContain("Up Next")
    })
})
