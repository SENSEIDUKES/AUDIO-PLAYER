import { lazy } from "react"
import type { ComponentType, LazyExoticComponent } from "react"

/* Workspace id → component. One line per workspace; each loads on demand so
   the Workshop home stays light and a workspace's engines only exist while it
   is open. Every id here has exactly one catalog entry (see catalog.ts); the
   workshop tests enforce that both lists agree. */

type Workspace = LazyExoticComponent<ComponentType>

function load<M>(importer: () => Promise<M>, pick: (module: M) => ComponentType): Workspace {
    return lazy(() => importer().then((module) => ({ default: pick(module) })))
}

const players = () => import("../workspaces/players/FaceWorkspace")

export const WORKSPACES: Readonly<Record<string, Workspace>> = {
    /* Players */
    "new-face": load(
        () => import("../workspaces/players/NewFaceWorkspace"),
        (m) => m.NewFaceWorkspace
    ),
    "portable-player": load(players, (m) => m.PortablePlayerWorkspace),
    "full-card": load(players, (m) => m.FullCardWorkspace),
    "sea-card": load(players, (m) => m.SeaCardWorkspace),
    "sticky-bottom": load(players, (m) => m.StickyBottomWorkspace),
    "mini-sidebar": load(players, (m) => m.MiniSidebarWorkspace),
    "vault-row": load(
        () => import("../workspaces/players/VaultRowWorkspace"),
        (m) => m.VaultRowWorkspace
    ),
    "narrative-face": load(
        () => import("../workspaces/players/NarrativeFaceWorkspace"),
        (m) => m.NarrativeFaceWorkspace
    ),

    /* Systems */
    "playback-session": load(
        () => import("../workspaces/systems/PlaybackSessionWorkspace"),
        (m) => m.PlaybackSessionWorkspace
    ),
    "audio-engine": load(
        () => import("../workspaces/systems/AudioEngineWorkspace"),
        (m) => m.AudioEngineWorkspace
    ),
    "sources-recovery": load(
        () => import("../workspaces/systems/SourcesRecoveryWorkspace"),
        (m) => m.SourcesRecoveryWorkspace
    ),
    "menus-controller": load(
        () => import("../workspaces/systems/MenusControllerWorkspace"),
        (m) => m.MenusControllerWorkspace
    ),
    queue: load(
        () => import("../workspaces/systems/QueueWorkspace"),
        (m) => m.QueueWorkspace
    ),
    automix: load(
        () => import("../workspaces/systems/AutomixWorkspace"),
        (m) => m.AutomixWorkspace
    ),
    cues: load(
        () => import("../workspaces/systems/CuesWorkspace"),
        (m) => m.CuesWorkspace
    ),
    "narrative-engines": load(
        () => import("../workspaces/systems/NarrativeEnginesWorkspace"),
        (m) => m.NarrativeEnginesWorkspace
    ),
    "agent-scout": load(
        () => import("../workspaces/systems/AgentScoutWorkspace"),
        (m) => m.AgentScoutWorkspace
    ),
    "activity-log": load(
        () => import("../workspaces/systems/ActivityLogWorkspace"),
        (m) => m.ActivityLogWorkspace
    ),
    headless: load(
        () => import("../workspaces/systems/HeadlessWorkspace"),
        (m) => m.HeadlessWorkspace
    ),

    /* Customization */
    plugins: load(
        () => import("../workspaces/customization/PluginsWorkspace"),
        (m) => m.PluginsWorkspace
    ),
    themes: load(
        () => import("../workspaces/customization/ThemesWorkspace"),
        (m) => m.ThemesWorkspace
    ),
    "face-presets": load(
        () => import("../workspaces/customization/FacePresetsWorkspace"),
        (m) => m.FacePresetsWorkspace
    ),
    scrubbers: load(
        () => import("../workspaces/customization/ScrubbersWorkspace"),
        (m) => m.ScrubbersWorkspace
    ),
    waveforms: load(
        () => import("../workspaces/customization/WaveformsWorkspace"),
        (m) => m.WaveformsWorkspace
    ),
    visuals: load(
        () => import("../workspaces/customization/VisualsWorkspace"),
        (m) => m.VisualsWorkspace
    ),
    "artwork-media": load(
        () => import("../workspaces/customization/ArtworkWorkspace"),
        (m) => m.ArtworkWorkspace
    ),
    "typography-metadata": load(
        () => import("../workspaces/customization/TypographyWorkspace"),
        (m) => m.TypographyWorkspace
    ),

    /* Testing Lab */
    "testing-lab": load(
        () => import("../workspaces/testing-lab/TestingLabWorkspace"),
        (m) => m.TestingLabWorkspace
    ),
    "showcase-fixture": load(
        () => import("../workspaces/fixtures/ShowcaseFixtureWorkspace"),
        (m) => m.ShowcaseFixtureWorkspace
    ),
}
