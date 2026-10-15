/* The Workshop catalog: every card on the home screen, grouped into three tabs.

   Tabs are navigation only. Nothing here is a package, and nothing here changes
   what @seihouse/audio-player exports: every workspace consumes the package
   through its public entry (`src/audio-player/index.ts`), exactly as a host app
   would.

   Each entry opens one dedicated, directly linkable workspace
   (`?workspace=<id>`). Ids are kept from the earlier Workshop so old links to
   the pages that remain still open. The v4 player faces, the face builder, the
   customization pages and the Testing Lab are archived in archive/faces-v4. */

export type WorkshopCategoryId = "player" | "novels" | "engine"

export interface WorkshopCategory {
    id: WorkshopCategoryId
    label: string
    description: string
}

export const WORKSHOP_CATEGORIES: readonly WorkshopCategory[] = [
    {
        id: "player",
        label: "Player",
        description:
            "Where the player face is designed. The old faces are archived; the new one starts here, alongside the narrator face used for reading.",
    },
    {
        id: "novels",
        label: "Novels (SEN)",
        description:
            "The pieces the NovelExpanded reader uses: the reader mixer, scene music and sound effects, and story cues.",
    },
    {
        id: "engine",
        label: "Engine",
        description:
            "What runs underneath any face: playback, the sound engine, recovery from broken files, the up-next list, Automix, and the activity log. These pages use plain test controls, not a designed face.",
    },
]

export const DEFAULT_CATEGORY: WorkshopCategoryId = "player"

/** How much of a piece genuinely works in this repository today. */
export type EntryStatus = "live" | "partial" | "placeholder"

export const STATUS_LABELS: Record<EntryStatus, string> = {
    live: "Working",
    partial: "Partly working",
    placeholder: "Not built yet",
}

/** Where a card goes when opened. */
export interface WorkspaceTarget {
    workspace: string
    params?: Readonly<Record<string, string>>
}

export interface WorkshopEntry {
    /** Stable id; also the `?workspace=` value. */
    id: string
    category: WorkshopCategoryId
    title: string
    /** One plain sentence for the card. */
    summary: string
    status: EntryStatus
    /** What you can do on this page. */
    working: readonly string[]
    /** What is missing, or needs something this repository doesn't have. */
    placeholders?: readonly string[]
    /** Package source the workspace exercises (orientation for later work; not shown). */
    sources: readonly string[]
}

export const WORKSHOP_ENTRIES: readonly WorkshopEntry[] = [
    /* ------------------------------- Player ------------------------------- */
    {
        id: "new-player",
        category: "player",
        title: "New player",
        summary:
            "A blank stage for the one new player face, at phone, tablet and desktop widths, with the engine already running underneath.",
        status: "placeholder",
        working: [
            "The stage at real widths, from a 320px phone up to desktop",
            "The engine plays underneath, driven by plain test controls",
        ],
        placeholders: ["The new face hasn't been designed yet. It goes on this stage."],
        sources: ["src/demo/workspaces/players/NewPlayerWorkspace.tsx"],
    },
    {
        id: "narrative-face",
        category: "player",
        title: "Narrator face",
        summary:
            "The small reading face: narration with background ambience that dips under the voice and changes with the scene.",
        status: "partial",
        working: [
            "Narration plays through the engine",
            "Ambience dips under narration and crossfades between scene moods",
            "Voice and ambience levels, shown inline or as a bottom overlay",
            "Works with the Reader mixer when both are on the page",
        ],
        placeholders: [
            "There are no real ambience packs yet, so short clips from the sample track stand in.",
        ],
        sources: [
            "src/audio-player/skins/NarrativeFace.tsx",
            "src/audio-player/narrative/useNarrativeAudio.ts",
        ],
    },

    /* ----------------------------- Novels (SEN) ----------------------------- */
    {
        id: "reader-mixer",
        category: "novels",
        title: "Reader mixer",
        summary:
            "Music, atmosphere, sound effects and voice playing together, each with its own switch and volume, plus the mixer view from the reader's audio settings.",
        status: "live",
        working: [
            "All 43 SEN Soundscapes from Volume 1, with scene music that rests after two plays",
            "Atmosphere previews, and sound effects that play over the music without pausing it",
            "Presets (Default, Cinematic, Calm, Focus), sleep timers, idle pause and automatic loudness leveling",
            "A soundtrack master that leaves Voice on its own volume",
            "Pairs with the Narrator face: its voice and ambience controls share the mixer's levels",
        ],
        placeholders: [
            "iPhone behavior (silent switch, unlocking audio) needs a real device; this page can't prove it",
            "The voice files' current host blocks the Web Audio route, so iPhone voice volume can't be tested here",
        ],
        sources: [
            "src/audio-player/narrative/ReaderMixer.ts",
            "src/audio-player/narrative/ReaderMixerContext.tsx",
            "src/reader-ui/ReaderMixerPanel.tsx",
            "src/demo/workspaces/sen/ReaderMixerWorkspace.tsx",
            "src/demo/senSoundscapes.ts",
        ],
    },
    {
        id: "narrative-engines",
        category: "novels",
        title: "Scene music & sound effects",
        summary:
            "Crossfade scene music from one track to the next, and fire overlapping sound effects.",
        status: "live",
        working: [
            "Crossfade between scene scores mid-track, with live status",
            "Scene level, mute, fade length and stop",
            "Fire overlapping sound effects, with a cap on how many play at once",
        ],
        sources: [
            "src/audio-player/narrative/SceneMixEngine.ts",
            "src/audio-player/narrative/OneShotEngine.ts",
        ],
    },
    {
        id: "cues",
        category: "novels",
        title: "Story cues",
        summary:
            "A list of moments in a story (a time, a scene, a chapter) that trigger sounds or the Narrator face. Load one, play it, and watch each cue fire.",
        status: "live",
        working: [
            "Check a cue list and apply it",
            "Time cues fire during playback; story cues fire by scene, tension or chapter",
            "Cues drive a live Narrator face",
            "Sound-effect cues play from a stand-in sound pack (on the built site)",
        ],
        placeholders: [
            "The sound pack is a stand-in cut from the sample track; no real cue sound packs exist yet",
            "Known bug: on the local dev server, a cue list with a sound pack stops every cue. Built sites are not affected.",
        ],
        sources: [
            "src/audio-player/cues/CueManifestPlugin.ts",
            "src/audio-player/cues/cueRuntime.ts",
            "src/audio-player/cues/useNarrativeCueController.ts",
        ],
    },

    /* -------------------------------- Engine -------------------------------- */
    {
        id: "playback-session",
        category: "engine",
        title: "Playback",
        summary:
            "One shared engine and one list of tracks behind everything on the page. Watch it live, then save it and pick back up where you left off.",
        status: "live",
        working: [
            "Two sets of controls on one engine stay in sync",
            "Live state and a log of everything that happens",
            "Save the session and restore it at the same spot",
            "Memory use for loaded tracks, and how far ahead to preload",
        ],
        sources: [
            "src/audio-player/session/AudioSessionContext.tsx",
            "src/audio-player/session/sessionSerializer.ts",
        ],
    },
    {
        id: "audio-engine",
        category: "engine",
        title: "Sound engine",
        summary:
            "The two ways the browser can play audio (standard and Web Audio), plus speed, fades, volume and 3D positioning.",
        status: "live",
        working: [
            "Switch between the standard and Web Audio engines",
            "Speed from 0.5× to 4×, fades, volume, mute, retry and unload",
            "Which engine is actually running, including automatic fallback",
            "Left/right panning and 3D position (Web Audio only)",
        ],
        placeholders: ["3D audio works on the Web Audio engine only, and no face uses it yet."],
        sources: [
            "src/audio-player/useAudioPlayer.ts",
            "src/audio-player/core/audio/HTML5AudioBackend.ts",
            "src/audio-player/core/audio/WebAudioBackend.ts",
        ],
    },
    {
        id: "sources-recovery",
        category: "engine",
        title: "Broken files & recovery",
        summary:
            "What happens when a track's file is missing or blocked: backup files, stop or skip, and a check of what each link allows.",
        status: "live",
        working: [
            "A broken file falls through to its backup",
            "When nothing plays: stop, or skip to the next track that does",
            "Links that are looked up just before playing (like signed links)",
            "A per-link check: reachable, allowed across sites, file type and format support",
        ],
        sources: [
            "src/audio-player/utils/sources.ts",
            "src/audio-player/utils/validateTrackSource.ts",
            "src/audio-player/utils/checkCodecSupport.ts",
        ],
    },
    {
        id: "queue",
        category: "engine",
        title: "Up next",
        summary: "Play now, next or later. Reorder, remove and clear the list of what plays next.",
        status: "live",
        working: [
            "Play Now, Play Next and Play Later",
            "Reorder and remove, including drag-and-drop",
            "Shuffle and repeat",
        ],
        placeholders: ["Playlists and the AI Queue Director open “coming soon” screens"],
        sources: [
            "src/audio-player/session/AudioSessionContext.tsx",
            "src/audio-player/components/QueueDrawer.tsx",
            "src/audio-player/surfaces/QueueSurface.tsx",
        ],
    },
    {
        id: "automix",
        category: "engine",
        title: "Automix",
        summary:
            "Smooth crossfades between songs: a simple version that trims silence, and a beat-aware version that lines up the tempo.",
        status: "live",
        working: [
            "Automix Lite and the beat-aware Automix Pro",
            "Live analysis of each track: tempo, energy, beats and where to blend",
            "The planned blend for the current pair of songs",
            "Jump near the end of a song to hear the blend right away",
        ],
        placeholders: [
            "Analysis needs audio the browser is allowed to read across sites. The No Luck host doesn't allow that, so this page uses the sample tracks.",
        ],
        sources: [
            "src/audio-player/plugins/AutomixPlugin.ts",
            "src/audio-player/automix/trackAnalysis.ts",
            "src/audio-player/automix/transitionPlanner.ts",
        ],
    },
    {
        id: "agent-scout",
        category: "engine",
        title: "Agent Scout",
        summary:
            "Measures a track in the browser (loudness, dynamics, stereo, rhythm), then sends it to an AI reviewer.",
        status: "partial",
        working: [
            "Measures the track in the browser",
            "Demo Scout, Studio Scout (locked unless unlocked) and Memoir",
        ],
        placeholders: [
            "The AI answer needs the deployed server and its key. The local dev server doesn't run it, so the request fails here.",
        ],
        sources: [
            "src/audio-player/components/workspace/AgentScoutWorkspace.tsx",
            "src/server/agentScout.ts",
            "api/agent-scout.ts",
        ],
    },
    {
        id: "activity-log",
        category: "engine",
        title: "Activity log",
        summary:
            "A running record of what the player did (play, pause, track changes, errors), which you can filter and export.",
        status: "live",
        working: [
            "Records play, pause, track changes, errors and setting changes automatically",
            "Filter, copy or export the log",
            "Add your own entries",
        ],
        sources: ["src/audio-player/diagnostics/"],
    },
]

export function getCategory(id: string | null | undefined): WorkshopCategory | undefined {
    return WORKSHOP_CATEGORIES.find((category) => category.id === id)
}

export function getEntry(id: string | null | undefined): WorkshopEntry | undefined {
    return WORKSHOP_ENTRIES.find((entry) => entry.id === id)
}

export function entriesForCategory(category: WorkshopCategoryId): WorkshopEntry[] {
    return WORKSHOP_ENTRIES.filter((entry) => entry.category === category)
}

/** Where a card goes. */
export function entryTarget(entry: WorkshopEntry): WorkspaceTarget {
    return { workspace: entry.id }
}

/** Entries that own a workspace (all of them, now). */
export function workspaceEntries(): WorkshopEntry[] {
    return [...WORKSHOP_ENTRIES]
}
