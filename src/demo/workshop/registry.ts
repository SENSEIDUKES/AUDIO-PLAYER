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

export const WORKSPACES: Readonly<Record<string, Workspace>> = {
    /* Player */
    "new-player": load(
        () => import("../workspaces/players/NewPlayerWorkspace"),
        (m) => m.NewPlayerWorkspace
    ),
    "narrative-face": load(
        () => import("../workspaces/players/NarrativeFaceWorkspace"),
        (m) => m.NarrativeFaceWorkspace
    ),

    /* Novels (SEN) */
    "reader-mixer": load(
        () => import("../workspaces/sen/ReaderMixerWorkspace"),
        (m) => m.ReaderMixerWorkspace
    ),
    "narrative-engines": load(
        () => import("../workspaces/systems/NarrativeEnginesWorkspace"),
        (m) => m.NarrativeEnginesWorkspace
    ),
    cues: load(
        () => import("../workspaces/systems/CuesWorkspace"),
        (m) => m.CuesWorkspace
    ),

    /* Engine */
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
    queue: load(
        () => import("../workspaces/systems/QueueWorkspace"),
        (m) => m.QueueWorkspace
    ),
    automix: load(
        () => import("../workspaces/systems/AutomixWorkspace"),
        (m) => m.AutomixWorkspace
    ),
    "agent-scout": load(
        () => import("../workspaces/systems/AgentScoutWorkspace"),
        (m) => m.AgentScoutWorkspace
    ),
    "activity-log": load(
        () => import("../workspaces/systems/ActivityLogWorkspace"),
        (m) => m.ActivityLogWorkspace
    ),
}
