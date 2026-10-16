/**
 * @vitest-environment jsdom
 *
 * The menu-architecture contract, exercised through the real DOM on every music
 * face:
 *
 *  1. the "…" button opens the default (Options) controller,
 *  2. every radial settings action opens the correct controller workspace,
 *  3. no action opens an unrelated pop-out,
 *  4. no visible action is dead or unwired, and
 *  5. every music face gets the same canonical hierarchy after capability
 *     filtering.
 */
import "@testing-library/jest-dom/vitest"
import type { ReactElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useState } from "react"
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
import { buildCanonicalPlayerActions } from "../menu/canonicalActions"
import { pruneDeadArcActions } from "../menu/arcRouting"
import type { ArcAction, ArcCommandHost } from "../menu/arcRouting"
import { faceSupportsSEICanvas } from "../surfaces/faceCapabilities"
import type { PlayerFace } from "../surfaces/faceCapabilities"
import type { Track } from "../types"
import type { WorkspaceRoute } from "../components/workspace/workspaceRoutes"

const TRACKS: Track[] = [
    { id: "a", title: "Angel Numbers", artist: "SENSEI", audioFile: "a.mp3" },
    { id: "b", title: "No Luck", artist: "SENSEI", audioFile: "b.mp3" },
]

/** Plugins the fixtures activate so the Plugins arm is populated everywhere. */
const ACTIVE_PLUGINS = ["lyrics", "automix", "analytics"] as const

/**
 * The music faces under test. Card/row faces are host-composed — the host owns
 * the one shared controller for the list — so their fixture wires that
 * controller exactly the way the shipped demos do.
 */
interface FaceFixture {
    face: PlayerFace
    /** Vault-managed surfaces declare the `vault` capability. */
    vault: boolean
    /** Immediate commands this face genuinely wires. */
    commands: readonly string[]
    render: () => ReactElement
}

/** A host-composed face: its own controller instance, driven by the row's menu.
 *  Mirrors the shipped composition — one SAPController for the whole list. */
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

const FIXTURES: FaceFixture[] = [
    {
        face: "fullCard",
        vault: false,
        commands: ["track.previous", "track.next", "share.url"],
        render: () => <FullCardPlayer />,
    },
    {
        face: "portable",
        vault: false,
        commands: ["track.previous", "track.next", "share.url"],
        // The standalone player owns its own session, so it takes the plugins
        // directly rather than inheriting the test provider's.
        render: () => <AudioPlayer tracks={TRACKS} plugins={PLUGINS()} />,
    },
    {
        face: "stickyBottom",
        vault: false,
        commands: ["track.previous", "track.next", "share.url"],
        render: () => <StickyBottomPlayer />,
    },
    {
        face: "miniSidebar",
        vault: false,
        commands: ["track.previous", "track.next", "share.url"],
        render: () => <MiniSidebarPlayer />,
    },
    {
        face: "seaCard",
        vault: false,
        commands: [],
        render: () => (
            <HostComposed>
                {(open) => (
                    <SeaCardPlayer
                        track={TRACKS[0]}
                        activePluginIds={ACTIVE_PLUGINS}
                        onOpenWorkspace={open}
                    />
                )}
            </HostComposed>
        ),
    },
    {
        face: "vaultRow",
        vault: true,
        commands: ["queue.insertAfterCurrent", "queue.append"],
        render: () => (
            <HostComposed>
                {(open) => (
                    <VaultRowPlayer
                        track={TRACKS[0]}
                        activePluginIds={ACTIVE_PLUGINS}
                        onOpenWorkspace={open}
                    />
                )}
            </HostComposed>
        ),
    },
]

const PLUGINS = () => [createLyricsPlugin(), createAutomixPlugin(), createAnalyticsPlugin()]

function mount(fixture: FaceFixture) {
    return render(
        <AudioSessionProvider initialQueue={TRACKS} plugins={PLUGINS()}>
            {fixture.render()}
        </AudioSessionProvider>
    )
}

/* ------------------------------- menu driving ------------------------------- */

/** The radial trigger — the one button on a face that opens a menu overlay. */
function radialTrigger(): HTMLElement {
    const triggers = document.querySelectorAll<HTMLElement>('button[aria-haspopup="menu"]')
    expect(triggers, "expected exactly one radial trigger on the face").toHaveLength(1)
    return triggers[0]
}
const openRadial = () => fireEvent.click(radialTrigger())
const menuItems = () => screen.queryAllByRole("menuitem")
const isBranch = (el: HTMLElement) => el.getAttribute("aria-haspopup") === "menu"
const isInteractive = (el: HTMLElement) => el.getAttribute("aria-disabled") !== "true"
const labelOf = (el: HTMLElement) => el.querySelector(".sac__node-label")?.textContent?.trim() ?? ""
const goBack = () => fireEvent.click(screen.getByRole("button", { name: "Back" }))
const closeRadial = () => {
    const close = screen.queryByRole("button", { name: "Close menu" })
    if (close) fireEvent.click(close)
}

/** A label tree — the hierarchy exactly as a user would walk it. */
interface LabelTree {
    [label: string]: LabelTree | null
}

/** Walk the open radial menu depth-first, collecting labels level by level. */
function readOpenMenu(): LabelTree {
    const tree: LabelTree = {}
    const level = menuItems()
    const entries = level.map((el) => ({ label: labelOf(el), branch: isBranch(el) }))
    for (let i = 0; i < entries.length; i++) {
        const { label, branch } = entries[i]
        if (!branch) {
            tree[label] = null
            continue
        }
        // Re-query: the previous back-navigation replaced these nodes.
        fireEvent.click(menuItems()[i])
        tree[label] = readOpenMenu()
        goBack()
    }
    return tree
}

/** Open the radial menu on a mounted face and read its whole hierarchy. */
function readFaceMenu(): LabelTree {
    openRadial()
    const tree = readOpenMenu()
    closeRadial()
    return tree
}

/** Click a leaf by its path of labels (e.g. ["Playback", "Controls"]). */
function selectMenuPath(path: readonly string[]) {
    openRadial()
    for (const label of path) {
        const node = menuItems().find((el) => labelOf(el) === label)
        expect(node, `menu item "${label}" not found in ${path.join(" › ")}`).toBeDefined()
        fireEvent.click(node!)
    }
}

/** The canonical hierarchy as label tree, filtered for a given host. */
function expectedLabelTree(host: ArcCommandHost): LabelTree {
    const toLabels = (actions: ArcAction[]): LabelTree =>
        Object.fromEntries(
            actions.map((a) => [
                a.label,
                a.children && a.children.length > 0 ? toLabels(a.children) : null,
            ])
        )
    return toLabels(
        pruneDeadArcActions(buildCanonicalPlayerActions({ activePluginIds: ACTIVE_PLUGINS }), host)
    )
}

afterEach(cleanup)

/* --------------------------------- the tests -------------------------------- */

describe("the three-dot controller", () => {
    // Only the faces that own their own "…" button; card/row faces delegate to
    // the host's shared controller.
    const WITH_DOTS = ["fullCard", "portable", "stickyBottom"] as const

    for (const face of WITH_DOTS) {
        it(`${face}: the "…" button opens the default controller`, () => {
            mount(FIXTURES.find((f) => f.face === face)!)
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole("button", { name: "Player options" }))
            const dialog = screen.getByRole("dialog", { name: "Player options" })
            expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("Options")
        })
    }
})

describe("radial settings actions open the controller workspace", () => {
    /** Every settings destination reachable on a now-playing face. */
    const ROUTE_MATRIX: [path: string[], title: string][] = [
        [["Plugins", "Audio", "Automix"], "Automix"],
        [["Plugins", "Visual", "Lyrics"], "Lyrics"],
        [["Plugins", "Visual", "Canvas"], "Canvas"],
        [["Plugins", "Analytics", "Analytics"], "Analytics"],
        [["Playback", "Controls"], "Controls"],
        [["Playback", "Debug"], "Activity Log"],
        [["Queue", "Up Next"], "Up Next"],
        [["Queue", "Director"], "Queue Director"],
        [["Share", "Add to"], "Add to Vault"],
        [["Agents", "Scout"], "Demo Scout"],
        [["Agents", "Memoir"], "Memoir"],
    ]

    for (const [path, title] of ROUTE_MATRIX) {
        it(`${path.join(" › ")} opens the ${title} workspace inside the controller`, () => {
            mount(FIXTURES.find((f) => f.face === "fullCard")!)
            selectMenuPath(path)

            const dialog = screen.getByRole("dialog", { name: "Player workspace" })
            expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent(title)
            // The radial overlay closed behind it, and the workspace is the
            // controller's own content — not a second surface.
            expect(screen.queryByRole("menu")).not.toBeInTheDocument()
            expect(screen.getAllByRole("dialog")).toHaveLength(1)
        })
    }

    it("the Vault arm's destinations open in the same controller", () => {
        const vaultRoutes: [string[], string][] = [
            [["Vault", "Tag"], "Tag"],
            [["Vault", "Rename"], "Rename"],
            [["Vault", "Playlist"], "Playlists"],
            [["Vault", "Radio"], "Radio"],
        ]
        for (const [path, title] of vaultRoutes) {
            mount(FIXTURES.find((f) => f.face === "vaultRow")!)
            selectMenuPath(path)
            const dialog = screen.getByRole("dialog", { name: "Player workspace" })
            expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent(title)
            cleanup()
        }
    })

    it("a workspace can be left for Options without closing the controller", async () => {
        mount(FIXTURES.find((f) => f.face === "fullCard")!)
        selectMenuPath(["Playback", "Controls"])
        fireEvent.click(screen.getByRole("button", { name: "Back to player options" }))
        expect(screen.getByRole("dialog", { name: "Player options" })).toBeInTheDocument()
        // Focus follows the navigation into the new body, staying in the trap.
        await waitFor(() =>
            expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true)
        )
    })

    it("the controller's own Queue row navigates in place, not to a drawer", () => {
        mount(FIXTURES.find((f) => f.face === "fullCard")!)
        fireEvent.click(screen.getByRole("button", { name: "Player options" }))
        const dialog = screen.getByRole("dialog")
        fireEvent.click(within(dialog).getByText("Up Next"))
        expect(
            within(screen.getByRole("dialog")).getByRole("heading", { level: 2 })
        ).toHaveTextContent("Up Next")
        expect(screen.getAllByRole("dialog")).toHaveLength(1)
    })
})

describe("immediate commands are genuinely wired", () => {
    it("Playback › Next advances the shared session, in place", () => {
        mount(FIXTURES.find((f) => f.face === "fullCard")!)
        expect(screen.getByText("Angel Numbers")).toBeInTheDocument()
        selectMenuPath(["Playback", "Next"])
        expect(screen.getByText("No Luck")).toBeInTheDocument()
        // A command opens nothing: no workspace, no overlay, no pop-out.
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })

    it("dims transport leaves when there is nowhere to skip, instead of no-opping", () => {
        // A single-track queue: the face can skip in principle (so the actions
        // stay in the hierarchy) but there is nowhere to go right now.
        render(
            <AudioSessionProvider initialQueue={[TRACKS[0]]} plugins={PLUGINS()}>
                <FullCardPlayer />
            </AudioSessionProvider>
        )
        openRadial()
        fireEvent.click(menuItems().find((el) => labelOf(el) === "Playback")!)
        for (const label of ["Previous", "Next"]) {
            const leaf = menuItems().find((el) => labelOf(el) === label)!
            expect(leaf, label).toHaveAttribute("aria-disabled", "true")
            expect(leaf.className, label).toContain("sac__node--disabled")
        }
        // Dimmed, not removed: the settings leaves beside them are unaffected.
        expect(menuItems().find((el) => labelOf(el) === "Controls")).toHaveAttribute(
            "aria-disabled",
            "false"
        )
    })
})

describe("no action opens an unrelated pop-out", () => {
    for (const fixture of FIXTURES) {
        it(`${fixture.face}: every visible leaf lands in the controller or runs a command`, () => {
            mount(fixture)
            const tree = readFaceMenu()
            // Collect every leaf path in the face's own rendered hierarchy.
            const paths: string[][] = []
            const walk = (node: LabelTree, prefix: string[]) => {
                for (const [label, child] of Object.entries(node)) {
                    if (child) walk(child, [...prefix, label])
                    else paths.push([...prefix, label])
                }
            }
            walk(tree, [])
            expect(paths.length).toBeGreaterThan(0)

            for (const path of paths) {
                selectMenuPath(path.slice(0, -1))
                const leaf = menuItems().find((el) => labelOf(el) === path[path.length - 1])!
                // Nothing visible is dead: a leaf is either actionable, or
                // explicitly marked unavailable for the current queue position.
                if (!isInteractive(leaf)) {
                    expect(leaf.className).toContain("sac__node--disabled")
                    closeRadial()
                    continue
                }
                fireEvent.click(leaf)
                // Whatever the leaf did, it did not open a second overlay: the
                // queue drawer is gone from the faces entirely, and at most the
                // one controller dialog is up.
                expect(document.querySelector(".ap-q-overlay")).toBeNull()
                expect(screen.queryAllByRole("dialog").length).toBeLessThanOrEqual(1)
                // The radial overlay always closes on selection.
                expect(screen.queryByRole("menu")).not.toBeInTheDocument()
                const dialog = screen.queryByRole("dialog")
                if (dialog) {
                    // A settings leaf: it opened a workspace in the controller.
                    expect(dialog).toHaveAccessibleName("Player workspace")
                    fireEvent.click(within(dialog).getByRole("button", { name: /^Close/ }))
                }
            }
        })
    }
})

describe("every music face gets the canonical hierarchy after capability filtering", () => {
    for (const fixture of FIXTURES) {
        it(`${fixture.face}: renders exactly the canonical tree its capabilities allow`, () => {
            mount(fixture)
            const rendered = readFaceMenu()
            const expected = expectedLabelTree({
                openWorkspace: () => {},
                capabilities: {
                    canvas: faceSupportsSEICanvas(fixture.face),
                    vault: fixture.vault,
                },
                commands: Object.fromEntries(fixture.commands.map((id) => [id, () => {}])),
            })
            expect(rendered).toEqual(expected)
        })
    }

    it("differs between faces only where a capability genuinely differs", () => {
        const trees = new Map<PlayerFace, LabelTree>()
        for (const fixture of FIXTURES) {
            mount(fixture)
            trees.set(fixture.face, readFaceMenu())
            cleanup()
        }

        // Same arms everywhere, minus the arms a capability removes: the Vault
        // arm exists only on the vault-managed surface.
        for (const fixture of FIXTURES) {
            const arms = Object.keys(trees.get(fixture.face)!)
            expect(arms.includes("Vault"), fixture.face).toBe(fixture.vault)
            for (const shared of ["Plugins", "Playback", "Queue", "Agents"]) {
                expect(arms, fixture.face).toContain(shared)
            }
        }

        // The Canvas leaf is the one Plugins delta, and it tracks the declared
        // canvas capability rather than the face's family or styling.
        for (const fixture of FIXTURES) {
            const visual = trees.get(fixture.face)!["Plugins"]?.["Visual"] ?? {}
            expect(Object.keys(visual).includes("Canvas"), fixture.face).toBe(
                faceSupportsSEICanvas(fixture.face)
            )
        }

        // Identical destinations: every face's settings leaves carry the same
        // labels under the same arms once the capability deltas are set aside.
        const withoutDeltas = (tree: LabelTree): LabelTree => {
            const { Vault: _vault, ...rest } = tree
            const plugins = rest["Plugins"]
            if (plugins?.["Visual"]) {
                const { Canvas: _canvas, ...visual } = plugins["Visual"]
                return { ...rest, Plugins: { ...plugins, Visual: visual } }
            }
            return rest
        }
        const [first, ...others] = FIXTURES.map((f) => withoutDeltas(trees.get(f.face)!))
        for (const other of others) {
            // Arms and branch structure match; only leaves gated on immediate
            // commands the face doesn't wire may be absent.
            expect(Object.keys(other).sort()).toEqual(Object.keys(first).sort())
        }
    })
})
