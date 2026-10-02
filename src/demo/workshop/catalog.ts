/* The Workshop catalog: every card on the home screen, grouped into five
   navigation categories.

   Categories are navigation only. Nothing here is a package, and nothing here
   changes what @seihouse/audio-player exports: every workspace consumes the
   package through its public entry (`src/audio-player/index.ts`), exactly as a
   host app would.

   Each entry opens one dedicated, directly linkable workspace
   (`?workspace=<id>`). Testing Lab scenario cards open the Mix & Match Lab with
   a preset. Roadmap records are listed honestly but have nothing to open. */

export type WorkshopCategoryId = "players" | "systems" | "customization" | "testing-lab" | "sen"

export interface WorkshopCategory {
    id: WorkshopCategoryId
    label: string
    description: string
}

export const WORKSHOP_CATEGORIES: readonly WorkshopCategory[] = [
    {
        id: "players",
        label: "Players",
        description:
            "Every player face on its own, plus New Face: a blank surface for building your own. Each workspace runs the real components with a real track set.",
    },
    {
        id: "systems",
        label: "Systems",
        description:
            "The behavior underneath the faces: playback, the shared session, menus, queue, Automix, cues, and the engines that power them.",
    },
    {
        id: "customization",
        label: "Customization",
        description:
            "The interchangeable pieces: plugins, themes, presets, scrubbers, waveforms, visuals, artwork, and typography.",
    },
    {
        id: "testing-lab",
        label: "Testing Lab",
        description:
            "Mix and match players inside a realistic app shell at real device sizes, then run the mobile, error, stress, and playback checks.",
    },
    {
        id: "sen",
        label: "SEN",
        description:
            "SEIHouse Expanded Novels: the pieces the NovelExpanded reader uses, built and pressure-tested here before they reach SEA.",
    },
]

export const DEFAULT_CATEGORY: WorkshopCategoryId = "players"

/** How much of a piece genuinely works in this repository today. */
export type EntryStatus = "live" | "partial" | "placeholder" | "roadmap"

export const STATUS_LABELS: Record<EntryStatus, string> = {
    live: "Live",
    partial: "Partial",
    placeholder: "Placeholder",
    roadmap: "Not built",
}

/** Where a card goes when opened. `null` means there is nothing to open. */
export interface WorkspaceTarget {
    workspace: string
    params?: Readonly<Record<string, string>>
}

export interface WorkshopEntry {
    /** Stable id; also the `?workspace=` value when the entry owns a workspace. */
    id: string
    category: WorkshopCategoryId
    title: string
    /** One line for the card. */
    summary: string
    status: EntryStatus
    tags: readonly string[]
    /** What genuinely works in this workspace. */
    working: readonly string[]
    /** Honest list of placeholders, or pieces that need something not present locally. */
    placeholders?: readonly string[]
    /** Package source the workspace exercises (orientation for later work). */
    sources: readonly string[]
    /**
     * Opens another workspace instead of owning one (Testing Lab scenario
     * presets). Omitted for entries that own a workspace.
     */
    opens?: WorkspaceTarget
}

export const WORKSHOP_ENTRIES: readonly WorkshopEntry[] = [
    /* ------------------------------ Players ------------------------------ */
    {
        id: "new-face",
        category: "players",
        title: "New Face",
        summary:
            "Start from a blank surface. Add, remove, and reorder the package's building blocks, try different gestures, then place the result in the Testing Lab's app shell.",
        status: "live",
        tags: ["Blank surface", "Build your own", "Testing Lab"],
        working: [
            "Opens blank, with 15 pieces to add, remove, reorder, and adjust",
            "Stack, row, or grid arrangement, plus spacing, padding, corners, background, and theme",
            "Tap, double-tap, swipe, long-press, keyboard, and reveal-on-hover interactions, with a live log",
            "Every piece reads the shared session, so the face plays like a bundled one",
            "The face lives in the link; one click places it in the Testing Lab's app shell or on a phone screen",
            "Your last face is kept as a local draft",
        ],
        placeholders: [
            "Pieces follow the arrangement; there is no free-form drag-and-drop placement yet",
            "A composed face lives in the Workshop and the Testing Lab; exporting it as a package face component is not built",
            "SEI Canvas visuals and the canvas button are not available as pieces yet",
        ],
        sources: [
            "src/demo/workspaces/players/NewFaceWorkspace.tsx",
            "src/demo/workspaces/shared/ComposedFace.tsx",
            "src/demo/workspaces/shared/faceSpec.ts",
        ],
    },
    {
        id: "portable-player",
        category: "players",
        title: "Portable AudioPlayer",
        summary:
            "The standalone release player with its own engine: playlist, lyrics, background art, and an optional waveform in one component.",
        status: "live",
        tags: ["Primary family", "Own engine", "Waveform"],
        working: [
            "Plays a playlist or a single track on its own engine, no session needed",
            "Every shared property: colors, background media, blur, typography, playback toggles",
            "Tracklist, lyrics, share, and the … controller",
            "Optional waveform scrubber",
        ],
        sources: ["src/audio-player/AudioPlayer.tsx", "src/audio-player/useAudioPlayer.ts"],
    },
    {
        id: "full-card",
        category: "players",
        title: "FullCardPlayer",
        summary:
            "The flagship now-playing card: hero artwork, SEI Canvas visuals, the waveform scrubber, and the radial action menu.",
        status: "live",
        tags: ["Primary family", "Shared session", "SEI Canvas"],
        working: [
            "Plays through the shared session",
            "SEI Canvas opens with the hero collapsing (Lyric Display by default)",
            "Radial action menu and the … controller",
            "Background and cover media, typography, and volume",
        ],
        sources: ["src/audio-player/skins/FullCardPlayer.tsx"],
    },
    {
        id: "sea-card",
        category: "players",
        title: "SeaCardPlayer",
        summary:
            "Marketplace and album cards that each play their track into the shared session. Swipeable on phones.",
        status: "live",
        tags: ["Primary family", "Shared session", "Cards"],
        working: [
            "Each card plays its own track into the shared session",
            "Overlay waveform canvas behind a small trigger",
            "Play Next, Play Later, and Copy link from each card's menu",
            "Cover art (image or video), tag chip, and typography",
        ],
        sources: ["src/audio-player/skins/SeaCardPlayer.tsx"],
    },
    {
        id: "sticky-bottom",
        category: "players",
        title: "StickyBottomPlayer",
        summary:
            "The persistent bottom bar. It is the compact family's master transport and owns the one shared scrubber.",
        status: "live",
        tags: ["Compact family", "Shared session", "Master scrubber"],
        working: [
            "Owns the shared scrubber the compact faces seek through",
            "Pins to the bottom of the window, or previews inline",
            "Radial action menu and the … controller",
            "Volume slider on desktop, mute everywhere",
        ],
        sources: ["src/audio-player/skins/StickyBottomPlayer.tsx"],
    },
    {
        id: "mini-sidebar",
        category: "players",
        title: "MiniSidebarPlayer",
        summary:
            "A condensed sidebar widget: artwork, track details, and play. Skip lives in its action menu.",
        status: "live",
        tags: ["Compact family", "Shared session", "Widget"],
        working: [
            "Plays through the shared session",
            "Artwork block (image, gradient, or video)",
            "Radial action menu and the … controller",
            "Holds its layout down to narrow sidebar widths: nothing spills out",
        ],
        placeholders: [
            "In a 16rem app-shell sidebar (about 230px of card) the title and artist shrink to a few characters beside the play and menu buttons",
        ],
        sources: ["src/audio-player/skins/MiniSidebarPlayer.tsx"],
    },
    {
        id: "vault-row",
        category: "players",
        title: "VaultRowPlayer",
        summary:
            "Catalog rows with full-row classification colors and the Vault app's own menu, all playing into one session.",
        status: "partial",
        tags: ["Compact family", "Shared session", "Host-owned menu"],
        working: [
            "Each row plays into the shared session",
            "Classification colors, including categories you register here",
            "The Vault app's own four-arm menu (Vault, Playback, Share, Agents) or SAP's canonical menu",
            "Play Next, Play Later, and Copy link commands",
        ],
        placeholders: [
            "Vault › Tag, Rename, and Radio open copy-only screens",
            "Vault › Playlist says “coming soon”",
            "Share › Add to lists the categories but cannot file a track yet",
        ],
        sources: [
            "src/audio-player/skins/VaultRowPlayer.tsx",
            "src/audio-player/skins/vaultCategories.ts",
            "src/audio-player/menu/compatActions.ts",
        ],
    },
    {
        id: "narrative-face",
        category: "players",
        title: "NarrativeFace",
        summary:
            "The faceless story surface for reader apps: narration on the session, ambience that ducks under it, and scene crossfades.",
        status: "partial",
        tags: ["Narrative family", "SEN", "Ambience"],
        working: [
            "Narration plays on the shared session (SEN Library Help lines)",
            "Ambience ducks under narration and crossfades between scene moods",
            "Ambience, narration, intensity, duck, and crossfade controls",
            "Inline block or embedded bottom overlay",
            "Pairs with the Reader Mixer: inside a ReaderMixerProvider it ducks the mixer's music and atmosphere under narration (see SEN → Reader Mixer)",
        ],
        placeholders: [
            "No real ambience packs exist yet. The workshop loops short clips cut from the sample track as stand-in ambience.",
        ],
        sources: [
            "src/audio-player/skins/NarrativeFace.tsx",
            "src/audio-player/narrative/useNarrativeAudio.ts",
        ],
    },
    {
        id: "queue-row",
        category: "players",
        title: "QueueRowPlayer",
        summary:
            "A compact queue-list row planned for the compact family. It appears in the design notes; no component exists yet.",
        status: "roadmap",
        tags: ["Compact family", "Planned"],
        working: [],
        placeholders: ["Not built. There is no QueueRowPlayer component in the package."],
        sources: ["src/audio-player/surfaces/faceCapabilities.ts"],
    },
    {
        id: "canvas-mode",
        category: "players",
        title: "Canvas / Mobile Mode",
        summary:
            "A full-screen SEI Canvas mode for the primary family. Planned in the capability model; no component exists yet.",
        status: "roadmap",
        tags: ["Primary family", "Planned"],
        working: [],
        placeholders: ["Not built. There is no full-screen canvas face in the package."],
        sources: ["src/audio-player/surfaces/faceCapabilities.ts"],
    },

    /* ------------------------------ Systems ------------------------------ */
    {
        id: "playback-session",
        category: "systems",
        title: "Playback Session",
        summary:
            "One shared engine and queue behind many faces. Watch its live state and events, then save and restore it.",
        status: "live",
        tags: ["AudioSessionProvider", "Events", "Save & restore"],
        working: [
            "One audio element and one queue shared by every face on the page",
            "Live state readout and event log",
            "Save the session and restore it with its position",
            "Decoded-buffer cache stats and pruning",
            "Preload strategy: none, next, or aggressive",
        ],
        sources: [
            "src/audio-player/session/AudioSessionContext.tsx",
            "src/audio-player/session/sessionSerializer.ts",
        ],
    },
    {
        id: "audio-engine",
        category: "systems",
        title: "Audio Engine & Backends",
        summary:
            "The core engine on the HTML5 or Web Audio backend: speed, fades, volume, retry, backend details, and spatial panning.",
        status: "live",
        tags: ["useAudioPlayer", "HTML5 / Web Audio", "Spatial"],
        working: [
            "Switch the shared session between the HTML5 and Web Audio backends",
            "Playback speed 0.5×–4×, fades, volume, mute, retry, and unload",
            "Live backend details, including any automatic fallback",
            "Stereo pan and 3D position on a raw Web Audio backend",
        ],
        placeholders: [
            "Spatial audio lives on the Web Audio backend only. No player or session exposes it yet.",
        ],
        sources: [
            "src/audio-player/useAudioPlayer.ts",
            "src/audio-player/core/audio/HTML5AudioBackend.ts",
            "src/audio-player/core/audio/WebAudioBackend.ts",
        ],
    },
    {
        id: "sources-recovery",
        category: "systems",
        title: "Sources & Error Recovery",
        summary:
            "Fallback sources, async source resolvers, the stop or skip error policy, and a live check of what each URL allows.",
        status: "live",
        tags: ["Fallbacks", "Error policy", "Source check"],
        working: [
            "A broken primary source falls through to its fallback",
            "Track error policy: stop, or skip to the next playable track",
            "Async source resolver (simulated signed URL)",
            "Per-URL check: reachable, cross-origin allowed, type, and codec support",
        ],
        sources: [
            "src/audio-player/utils/sources.ts",
            "src/audio-player/utils/validateTrackSource.ts",
            "src/audio-player/utils/checkCodecSupport.ts",
        ],
    },
    {
        id: "menus-controller",
        category: "systems",
        title: "Menus & SAP Controller",
        summary:
            "One action hierarchy shared by every face, composed by the host, and routed into one controller sheet.",
        status: "partial",
        tags: ["Radial menu", "Controller", "Routing"],
        working: [
            "Canonical menu, host-chosen categories and order, extra host arms, or a fully host-owned menu",
            "Capability pruning and the Studio Scout entitlement lock",
            "Route table for every menu leaf",
            "Open any controller destination directly",
        ],
        placeholders: [
            "Playlists, Automix settings, and Queue Director say “coming soon”",
            "Analytics, Sleep Timer, Auto Theme, and Waveform settings screens are stubs",
            "Vault Tag, Rename, and Radio are copy-only; Details and Route To are not connected, and no menu opens them yet",
        ],
        sources: [
            "src/audio-player/menu/canonicalActions.ts",
            "src/audio-player/menu/menuProfile.ts",
            "src/audio-player/components/SAPController.tsx",
            "src/audio-player/components/workspace/WorkspaceShell.tsx",
        ],
    },
    {
        id: "queue",
        category: "systems",
        title: "Queue",
        summary:
            "Play now, next, or later. Reorder, remove, and clear. The shared queue and every Up Next surface that reads it.",
        status: "live",
        tags: ["Play Next", "Queue Drawer", "Up Next"],
        working: [
            "Play Now, Play Next, and Play Later into the shared session",
            "Reorder and remove, including the drag-and-drop Queue Drawer",
            "Inline Up Next surface and the controller's Up Next workspace",
            "Shuffle and repeat, with track-change and queue-end events",
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
        category: "systems",
        title: "Automix",
        summary:
            "Crossfades between tracks: Automix Lite's silence trims and the beat-aware Pro plugin, with automatic fallback.",
        status: "live",
        tags: ["Crossfade", "Beat analysis", "Plugin"],
        working: [
            "Automix Lite (the session switch) and the Automix Pro plugin",
            "Live per-track analysis: BPM, confidence, energy, beats, and transition points",
            "The planned transition for the current pair",
            "Jump near the end of a track to hear the transition right away",
        ],
        placeholders: [
            "The controller's Automix settings screen says “coming soon”",
            "Analysis needs audio the browser may decode across sites. The No Luck WAV host does not allow that, so this workspace uses the sample tracks.",
        ],
        sources: [
            "src/audio-player/plugins/AutomixPlugin.ts",
            "src/audio-player/automix/trackAnalysis.ts",
            "src/audio-player/automix/transitionPlanner.ts",
        ],
    },
    {
        id: "cues",
        category: "systems",
        title: "Cues",
        summary:
            "Time- and story-triggered cue manifests. Validate one, play it, and watch each cue fire into a live NarrativeFace.",
        status: "live",
        tags: ["Cue Manifest v1", "Story triggers", "SEN"],
        working: [
            "Validate and apply a cue manifest",
            "Time cues fire during playback, with replayable and fire-on-seek rules",
            "Story cues fire by trigger (scene, tension, chapter …)",
            "Narrative cues drive a live NarrativeFace through the cue controller hook",
            "Sprite cues play clips from a stand-in sprite pack (built site)",
        ],
        placeholders: [
            "The sprite pack is a stand-in cut from the sample track; no real cue sound packs exist yet",
            "Known package bug: on the local dev server, a manifest with a sprite pack stops every cue, because the plugin sound layer does not survive React's development double-mount. Built sites are not affected.",
        ],
        sources: [
            "src/audio-player/cues/CueManifestPlugin.ts",
            "src/audio-player/cues/cueRuntime.ts",
            "src/audio-player/cues/useNarrativeCueController.ts",
        ],
    },
    {
        id: "narrative-engines",
        category: "systems",
        title: "Scene Mix & One-Shots",
        summary:
            "The headless narrative engines: a two-deck scene-score crossfader and a pooled one-shot player for cues and FX.",
        status: "live",
        tags: ["SceneMixEngine", "OneShotEngine", "SEN"],
        working: [
            "Crossfade between scene scores mid-track, with live status snapshots",
            "Scene level, mute, fade length, and stop",
            "Fire overlapping one-shots from a pooled player with a concurrency cap",
        ],
        sources: [
            "src/audio-player/narrative/SceneMixEngine.ts",
            "src/audio-player/narrative/OneShotEngine.ts",
        ],
    },
    {
        id: "agent-scout",
        category: "systems",
        title: "Agent Scout",
        summary:
            "Demo Scout, Studio Scout, and Memoir: the track is measured in the browser, then sent to an AI reviewer.",
        status: "partial",
        tags: ["Agents", "Audio analysis", "Server"],
        working: [
            "Decodes and measures the track in the browser: level, dynamics, stereo, and rhythm",
            "Studio Scout entitlement gating",
            "Opens inside the … controller like every other destination",
        ],
        placeholders: [
            "The AI answer needs the deployed /api/agent-scout server and its API key. The local dev server does not run it, so the request fails here.",
            "AI Queue Director is a “coming soon” screen",
        ],
        sources: [
            "src/audio-player/components/workspace/AgentScoutWorkspace.tsx",
            "src/server/agentScout.ts",
            "api/agent-scout.ts",
        ],
    },
    {
        id: "activity-log",
        category: "systems",
        title: "Activity Log",
        summary:
            "Diagnostics: record the player's lifecycle events as they happen, filter them, and export the log.",
        status: "live",
        tags: ["Diagnostics", "Export"],
        working: [
            "Automatic recording of play, pause, track changes, errors, and settings changes",
            "Filter by area and status; copy or export the log",
            "Record your own events from the workshop",
            "The same log inside the … controller",
        ],
        sources: ["src/audio-player/diagnostics/"],
    },
    {
        id: "headless",
        category: "systems",
        title: "Headless Controls",
        summary:
            "Build your own transport from prop getters over the same session, plus lock-screen Media Session wiring.",
        status: "live",
        tags: ["Prop getters", "Media Session"],
        working: [
            "Unstyled buttons and a progress bar driven by useSAPPropGetters",
            "Custom click handlers run before the player's own, and can cancel it",
            "Lock-screen and OS media controls through useMediaSessionObserver",
        ],
        sources: [
            "src/audio-player/headless/useSAPPropGetters.ts",
            "src/audio-player/headless/useMediaSessionObserver.ts",
        ],
    },

    /* --------------------------- Customization --------------------------- */
    {
        id: "plugins",
        category: "customization",
        title: "Plugins",
        summary:
            "Install and toggle the built-in plugins on a live player, stack them, and prove a crashing plugin cannot stop playback.",
        status: "live",
        tags: ["Registry", "Lifecycle", "Isolation"],
        working: [
            "Plugin registry: install, activate, deactivate, and uninstall",
            "Ready-made stacks with 0, 1, and 4 plugins",
            "Live analytics event feed and synced lyric line",
            "A deliberately failing plugin is contained while playback continues",
            "Where each plugin's interface lives: settings, canvas, or headless",
        ],
        placeholders: ["Per-plugin settings screens in the controller are stubs, except Lyrics"],
        sources: [
            "src/audio-player/plugins/registry/",
            "src/audio-player/core/plugins/PluginManager.ts",
            "src/audio-player/plugins/surfaces/defaultPluginSurfaces.ts",
        ],
    },
    {
        id: "themes",
        category: "customization",
        title: "Themes",
        summary:
            "One theme across several faces at once, one-tap presets, and Auto Theme colors taken from the artwork.",
        status: "live",
        tags: ["Colors", "Presets", "Auto Theme"],
        working: [
            "Button, icon, text, progress, track, background, and glow colors",
            "Theme presets applied to every face at once",
            "Auto Theme derives the colors from the artwork",
            "Copy the theme as props",
        ],
        placeholders: [
            "Auto Theme reads the artwork's pixels, so the image host must allow it. The No Luck cover host does not, so Auto Theme uses the sample artwork.",
        ],
        sources: [
            "src/audio-player/skins/themeVars.ts",
            "src/audio-player/plugins/AutoThemePlugin.ts",
        ],
    },
    {
        id: "face-presets",
        category: "customization",
        title: "Face Presets",
        summary:
            "Style any face with the shared property panel, toggle its plugins, and save named presets in this browser.",
        status: "live",
        tags: ["Property registry", "Presets", "Local"],
        working: [
            "Every face, driven by the shared property registry",
            "Plugin choices saved with the preset",
            "Save, load, and delete presets (this browser only)",
            "Copy the portable player's props as JSX",
        ],
        sources: ["src/audio-player/properties/propertyRegistry.ts", "src/demo/workshopPresets.ts"],
    },
    {
        id: "scrubbers",
        category: "customization",
        title: "Scrubbers",
        summary:
            "Progress bars and waveform scrubbers at each face's density, all seeking the same session.",
        status: "partial",
        tags: ["Progress bar", "Density", "ScrubberCanvas"],
        working: [
            "The standalone progress bar wired to the session",
            "Compact, standard, and expanded scrubber densities side by side",
            "Click, drag, and keyboard seeking (←/→, Shift for 30 s)",
        ],
        placeholders: [
            "The ScrubberCanvas visual slot has no components yet, so every face shows its built-in scrubber",
        ],
        sources: [
            "src/audio-player/components/ProgressBar.tsx",
            "src/audio-player/surfaces/ScrubberCanvasHost.tsx",
            "src/audio-player/visual-slots/ScrubberCanvasRenderer.tsx",
        ],
    },
    {
        id: "waveforms",
        category: "customization",
        title: "Waveforms",
        summary:
            "Waveform scrubbers on both backends, precomputed peaks for instant drawing, and the Waveform plugin.",
        status: "live",
        tags: ["wavesurfer.js", "Peaks", "Plugin"],
        working: [
            "Waveform scrubber on the HTML5 and Web Audio backends",
            "Precomputed peaks that draw instantly",
            "The Waveform plugin with its Show Waveform switch",
            "Waveform height",
        ],
        placeholders: [
            "On the HTML5 backend the peaks need audio the browser may decode across sites. No Luck WAVs fall back to the plain progress bar.",
        ],
        sources: [
            "src/audio-player/components/WaveformProgress.tsx",
            "src/audio-player/components/WaveformAdapter.tsx",
            "src/audio-player/core/waveform/peaks.ts",
        ],
    },
    {
        id: "visuals",
        category: "customization",
        title: "SEI Canvas Visuals",
        summary:
            "Swap the visual mounted in the SEI Canvas and tune its settings live, exactly as the controller does.",
        status: "partial",
        tags: ["Visual slots", "Lyric Display", "Skins"],
        working: [
            "Lyric Display: a synced lyric visual with a full settings panel",
            "The visual picker and settings panel the controller uses",
            "Registry view of every visual slot",
        ],
        placeholders: [
            "Sample Skin is an imported scaffold. Its settings panel is still a TODO.",
            "No components ship for the ScrubberCanvas or Controller Panel slots",
        ],
        sources: [
            "src/audio-player/visual-slots/",
            "src/audio-player/visual-slots/components/imported/sample-skin/",
        ],
    },
    {
        id: "artwork-media",
        category: "customization",
        title: "Artwork & Backgrounds",
        summary:
            "Image or video artwork and full-bleed backgrounds with blur and darken, across every face that shows them.",
        status: "live",
        tags: ["Image", "Video", "Backgrounds"],
        working: [
            "Cover art as an image, a gradient, or a muted looping video",
            "Full-bleed background image or video with blur and darken",
            "The same media across the faces that support it",
        ],
        sources: [
            "src/audio-player/components/BackgroundMedia.tsx",
            "src/audio-player/properties/propertyTypes.ts",
        ],
    },
    {
        id: "typography-metadata",
        category: "customization",
        title: "Typography & Metadata",
        summary:
            "Title, artist, featured artists, versions, explicit badges, and marquee scrolling in every density.",
        status: "live",
        tags: ["TrackMetadata", "Marquee", "Fonts"],
        working: [
            "The shared metadata block in hero, compact, bar, and row densities",
            "Featured artists, version labels, album and release lines, explicit badge",
            "Marquee scrolling for long titles, off when reduced motion is on",
            "Title and artist fonts on the faces that take them",
        ],
        sources: [
            "src/audio-player/components/TrackMetadata.tsx",
            "src/audio-player/components/TextMarquee.tsx",
            "src/audio-player/utils/formatMetadata.ts",
        ],
    },

    /* ---------------------------- Testing Lab ---------------------------- */
    {
        id: "testing-lab",
        category: "testing-lab",
        title: "Mix & Match Lab",
        summary:
            "Place players in a realistic app shell, switch device sizes, combine features, and run the checks.",
        status: "live",
        tags: ["App shell", "Viewports", "Checks"],
        working: [
            "App shell brought over from the UI repo: header, sidebar, main area, footer, and phone navigation",
            "Real device sizes. Each preview is its own page, so phone layouts and pinned bars behave for real.",
            "Choose the context, faces, tracks, plugins, backend, and playback options",
            "Automatic overflow, engine, and error readouts from inside the preview",
            "Stress runs that hammer the shared session and then verify its state",
        ],
        sources: ["src/demo/workspaces/testing-lab/"],
    },
    {
        id: "lab-mobile",
        category: "testing-lab",
        title: "Mobile checks",
        summary:
            "Phone viewports from 320 to 430 wide, including the four-width matrix with extra-long titles.",
        status: "live",
        tags: ["320–430", "Overflow", "Controller sheet"],
        working: [],
        sources: [],
        opens: { workspace: "testing-lab", params: { scenario: "mobile" } },
    },
    {
        id: "lab-errors",
        category: "testing-lab",
        title: "Error states",
        summary:
            "Broken URLs, missing audio, mixed playlists, fallback recovery, and the skip policy side by side.",
        status: "live",
        tags: ["Broken URL", "Fallback", "Skip policy"],
        working: [],
        sources: [],
        opens: { workspace: "testing-lab", params: { scenario: "errors" } },
    },
    {
        id: "lab-stress",
        category: "testing-lab",
        title: "Stress test",
        summary:
            "Rapid play/pause, seek, skip, and volume storms against the shared session, followed by a consistency check.",
        status: "live",
        tags: ["Rapid input", "Consistency"],
        working: [],
        sources: [],
        opens: { workspace: "testing-lab", params: { scenario: "stress" } },
    },
    {
        id: "lab-playback",
        category: "testing-lab",
        title: "Playback checks",
        summary:
            "The full app shell on the real release, with plugin, backend, and Automix switches to combine.",
        status: "live",
        tags: ["No Luck", "Backends", "Plugins"],
        working: [],
        sources: [],
        opens: { workspace: "testing-lab", params: { scenario: "playback" } },
    },
    {
        id: "showcase-fixture",
        category: "testing-lab",
        title: "Showcase fixture",
        summary:
            "The original No Luck showcase and the render-zones demo, kept intact for regression checks.",
        status: "live",
        tags: ["No Luck", "Fixture", "Regression"],
        working: [
            "The original showcase page, unchanged: featured release, both families, specs",
            "The original render-zones demo: SEI Canvas and queue surfaces on two faces",
        ],
        sources: ["src/demo/fixtures/showcase.tsx", "src/demo/fixtures/surfaces.tsx"],
    },
    /* -------------------------------- SEN -------------------------------- */
    {
        id: "reader-mixer",
        category: "sen",
        title: "Reader Mixer",
        summary:
            "Music, atmosphere and sound cues playing together, each with its own switch and volume, plus the inline mixer view for the reader's Settings › Audio.",
        status: "live",
        tags: ["ReaderMixer", "ReaderMixerPanel", "Three layers"],
        working: [
            "All 43 SEN Soundscapes (Volume 1) by category; any score crossfades in per chapter or mid-chapter, and repeat requests do nothing",
            "A reader-chosen atmosphere loops under everything; Off fades it out",
            "Sound cues overlap over both loops without pausing them",
            "Master, per-layer switches and sliders, with settings saved in this browser",
            "Presets (Default, Cinematic, Calm, Focus); new readers start on Default: 25 / 30 / 75 with gentle rain",
            "Auto, Element or Web Audio routing; SEIHouse files play on all three, and the iPhone on/off fallback is shown in the view",
            "Both loops pause while the page is hidden",
            "NarrativeFace as companion: narration ducks the music and atmosphere, its Ambience slider is the Atmosphere level, and its … button opens the mixer view",
        ],
        placeholders: [
            "iPhone behavior (silent switch, per-element unlock) needs a real device; this page cannot prove it",
        ],
        sources: [
            "src/audio-player/narrative/ReaderMixer.ts",
            "src/audio-player/narrative/ReaderMixerContext.tsx",
            "src/audio-player/components/ReaderMixerPanel.tsx",
            "src/demo/workspaces/sen/ReaderMixerWorkspace.tsx",
            "src/demo/senSoundscapes.ts",
        ],
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

/** Where a card goes, or `null` for roadmap records with nothing to open. */
export function entryTarget(entry: WorkshopEntry): WorkspaceTarget | null {
    if (entry.status === "roadmap") return null
    return entry.opens ?? { workspace: entry.id }
}

/** Entries that own a workspace (not roadmap records, not scenario links). */
export function workspaceEntries(): WorkshopEntry[] {
    return WORKSHOP_ENTRIES.filter((entry) => entry.status !== "roadmap" && !entry.opens)
}
