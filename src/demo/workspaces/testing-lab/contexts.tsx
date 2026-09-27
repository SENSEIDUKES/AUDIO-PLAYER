import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Compass, Home, Library, Radio, Search, Vault } from "lucide-react"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    MiniSidebarPlayer,
    NarrativeFace,
    SeaCardPlayer,
    StickyBottomPlayer,
    VaultRowPlayer,
    buildVaultTrackArcActions,
    createAnalyticsPlugin,
    createAutoThemePlugin,
    createAutomixPlugin,
    createKeyboardShortcutPlugin,
    createLyricsPlugin,
    createSleepTimerPlugin,
    createWaveformPlugin,
    formatTime,
    useAudioSession,
    useAudioTime,
} from "../../../audio-player"
import type {
    ArcCommandHost,
    AudioPlayerPlugin,
    AudioPlayerTheme,
    Track,
    WorkspaceRoute,
} from "../../../audio-player"
import {
    BROKEN,
    NO_LUCK_ART,
    NO_LUCK_COVER,
    SAMPLE,
    SEA_ARTS,
    STAND_IN_SPRITE_PACK,
    TRACK_SETS,
    playlist,
} from "../../data"
import { ComposedFace } from "../shared/ComposedFace"
import { decodeFace } from "../shared/faceSpec"
import { SessionController } from "../shared/session"
import { themeFor } from "../shared/themes"
import { AppHeaderBar, AppShell, BottomNavigation } from "./AppShell"
import { postToLab } from "./bridge"
import type { SessionStatus, StressAction } from "./bridge"
import type { LabConfig, LabPluginId, LabThemeId, MainFace } from "./labConfig"
import { runStress } from "./stress"

/* Everything a Testing Lab preview page can render. A context is a realistic
   host situation (app shell, marketplace, vault, reader, phone, error board);
   the faces inside it share one AudioSessionProvider the way a real app would,
   except the portable player, which always brings its own engine. */

export function labTheme(id: LabThemeId): AudioPlayerTheme {
    return themeFor(id)
}

const TIMED_LYRICS = [
    "[00:00.00]Mix and match",
    "[00:05.00]Every face, one session",
    "[00:10.00]Real viewports, real layouts",
    "[00:15.00]Nothing plays twice",
].join("\n")

/** Fresh plugin instances — a plugin instance belongs to exactly one engine. */
export function createLabPlugins(ids: readonly LabPluginId[], fid: string): AudioPlayerPlugin[] {
    return ids.map((id) => {
        switch (id) {
            case "keyboard":
                return createKeyboardShortcutPlugin({
                    name: "registry-keyboard-shortcuts",
                    enablePlaylistKeys: true,
                })
            case "analytics":
                return createAnalyticsPlugin({
                    name: "registry-analytics",
                    includeTimeUpdates: false,
                    send: (event) =>
                        postToLab(fid, {
                            type: "log",
                            text: `analytics: ${event.type} · ${event.track?.title ?? "(none)"} @ ${event.position.toFixed(1)} s`,
                        }),
                })
            case "lyrics":
                return createLyricsPlugin({ name: "registry-lyrics", lyrics: TIMED_LYRICS })
            case "sleep":
                return createSleepTimerPlugin({ name: "registry-sleep-timer" })
            case "theme":
                return createAutoThemePlugin({ name: "registry-auto-theme" })
            case "waveform":
                return createWaveformPlugin({ name: "registry-waveform" })
            case "automix":
                return createAutomixPlugin({
                    name: "registry-automix",
                    onTransitionChange: (active) =>
                        postToLab(fid, {
                            type: "log",
                            text: active
                                ? "Automix crossfade started"
                                : "Automix crossfade finished",
                        }),
                })
        }
    })
}

/* ----------------------------- Session plumbing ----------------------------- */

const ControllerContext = createContext<(route: WorkspaceRoute) => void>(() => undefined)

/** Reports the shared session to the lab (throttled) and runs stress requests. */
function SessionProbe({ fid }: { fid: string }) {
    const s = useAudioSession()
    const { currentTime, duration } = useAudioTime()
    const latest = useRef(s)
    latest.current = s
    const timeRef = useRef({ currentTime, duration })
    timeRef.current = { currentTime, duration }
    const lastSent = useRef({ at: 0, key: "" })

    const state: SessionStatus["state"] = s.hasError
        ? "error"
        : s.isBuffering
          ? "buffering"
          : s.isPlaying
            ? "playing"
            : "paused"
    const key = `${state}:${s.currentTrack?.title}:${s.currentIndex}:${s.queue.length}`

    useEffect(() => {
        const now = Date.now()
        if (key === lastSent.current.key && now - lastSent.current.at < 500) return
        lastSent.current = { at: now, key }
        postToLab(fid, {
            type: "session",
            session: {
                title: s.currentTrack?.title ?? null,
                state,
                position: `${formatTime(currentTime)} / ${formatTime(duration)}`,
                queue: s.queue.length ? `${s.currentIndex + 1} of ${s.queue.length}` : "empty",
                backend: s.getBackendInfo().active,
            },
        })
    })

    useEffect(() => {
        let active = true
        const onStress = (event: Event) => {
            const action = (event as CustomEvent<StressAction>).detail
            postToLab(fid, { type: "log", text: `Stress: running ${action}…` })
            void runStress(action, {
                session: () => latest.current,
                time: () => timeRef.current,
            }).then((result) => {
                // The preview may have reloaded while the routine ran.
                if (active) postToLab(fid, { type: "stress-result", result })
            })
        }
        window.addEventListener("sap-lab:stress", onStress)
        return () => {
            active = false
            window.removeEventListener("sap-lab:stress", onStress)
        }
    }, [fid])

    return null
}

function LabSession({
    config,
    fid,
    children,
}: {
    config: LabConfig
    fid: string
    children: ReactNode
}) {
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    const plugins = useMemo(() => createLabPlugins(config.plugins, fid), [config.plugins, fid])
    const open = useCallback((next: WorkspaceRoute) => setRoute(next), [])
    return (
        <AudioSessionProvider
            initialQueue={TRACK_SETS[config.tracks].tracks}
            shuffle={config.shuffle}
            repeatMode={config.repeat}
            automix={config.automix}
            audioBackend={config.backend}
            trackErrorPolicy={config.policy}
            plugins={plugins}
        >
            <SessionProbe fid={fid} />
            <ControllerContext.Provider value={open}>{children}</ControllerContext.Provider>
            <SessionController
                route={route}
                onClose={() => setRoute(null)}
                theme={labTheme(config.theme)}
            />
        </AudioSessionProvider>
    )
}

function useQueueCommands(track: Track): ArcCommandHost["commands"] {
    const { playNext, enqueue } = useAudioSession()
    return useMemo(
        () => ({
            "queue.insertAfterCurrent": () => playNext(track),
            "queue.append": () => enqueue(track),
            "share.url": () => {
                void navigator.clipboard?.writeText(track.audioFile ?? "")
            },
        }),
        [playNext, enqueue, track]
    )
}

/* ----------------------------- Faces ----------------------------- */

function SeaCard({
    track,
    index,
    theme,
}: {
    track: Track
    index: number
    theme: AudioPlayerTheme
}) {
    const open = useContext(ControllerContext)
    const commands = useQueueCommands(track)
    return (
        <SeaCardPlayer
            track={track}
            art={index === 0 ? NO_LUCK_ART : SEA_ARTS[index % SEA_ARTS.length]}
            tag={index % 2 ? "$1.29" : "SEA"}
            commands={commands}
            onOpenWorkspace={open}
            {...theme}
        />
    )
}

function SeaGrid({ config }: { config: LabConfig }) {
    const theme = labTheme(config.theme)
    const tracks = TRACK_SETS[config.tracks].tracks.slice(0, 6)
    return (
        <div className="lab-sea-grid">
            {tracks.map((track, index) => (
                <SeaCard key={track.id ?? track.title} track={track} index={index} theme={theme} />
            ))}
        </div>
    )
}

const VAULT_CATEGORIES = ["demo", "beat", "mix", "master", "toFinish", "arcNote"]

function VaultRow({
    track,
    index,
    theme,
}: {
    track: Track
    index: number
    theme: AudioPlayerTheme
}) {
    const open = useContext(ControllerContext)
    const commands = useQueueCommands(track)
    const actions = useMemo(
        () => buildVaultTrackArcActions({ entitlements: { studioScout: false } }),
        []
    )
    return (
        <VaultRowPlayer
            track={{ ...track, vaultCategory: VAULT_CATEGORIES[index % VAULT_CATEGORIES.length] }}
            number={index + 1}
            actions={actions}
            commands={commands}
            onOpenWorkspace={open}
            {...theme}
        />
    )
}

function VaultList({ config }: { config: LabConfig }) {
    const theme = labTheme(config.theme)
    return (
        <div className="lab-vault-list">
            {TRACK_SETS[config.tracks].tracks.map((track, index) => (
                <VaultRow key={track.id ?? track.title} track={track} index={index} theme={theme} />
            ))}
        </div>
    )
}

function PortablePlayer({ config, fid }: { config: LabConfig; fid: string }) {
    const plugins = useMemo(() => createLabPlugins(config.plugins, fid), [config.plugins, fid])
    return (
        <AudioPlayer
            tracks={TRACK_SETS[config.tracks].tracks}
            showTracklist
            showWaveform={config.waveform}
            shuffle={config.shuffle}
            repeatMode={config.repeat}
            automix={config.automix}
            audioBackend={config.backend}
            plugins={plugins}
            backgroundImage={{ src: NO_LUCK_COVER }}
            darkenAmount={55}
            blurSize={22}
            {...labTheme(config.theme)}
        />
    )
}

function Narrative({ config, embedded }: { config: LabConfig; embedded: boolean }) {
    return (
        <NarrativeFace
            chapterId="lab-ch-1"
            sceneMood="Rain"
            ambientProfile="rain-loop"
            ambienceManifest={STAND_IN_SPRITE_PACK}
            intensity={0.7}
            embedded={embedded}
            {...labTheme(config.theme)}
        />
    )
}

/** A New Face composition, carried here in the preview's link. */
function CustomFace({ config, fid }: { config: LabConfig; fid: string }) {
    const open = useContext(ControllerContext)
    const spec = useMemo(() => decodeFace(config.face), [config.face])
    return (
        <ComposedFace
            spec={spec}
            art={config.tracks === "no-luck" ? NO_LUCK_ART : undefined}
            onOpenController={open}
            onInteraction={(text) => postToLab(fid, { type: "log", text: `New Face: ${text}` })}
            emptyMessage="This New Face is blank. Build one in Players › New Face, then place it here."
        />
    )
}

function MainFaceView({
    config,
    fid,
    face = config.main,
    embeddedNarrative = false,
}: {
    config: LabConfig
    fid: string
    face?: MainFace
    embeddedNarrative?: boolean
}) {
    switch (face) {
        case "full-card":
            return <FullCardPlayer art={NO_LUCK_ART} {...labTheme(config.theme)} />
        case "portable":
            return <PortablePlayer config={config} fid={fid} />
        case "sea-grid":
            return <SeaGrid config={config} />
        case "vault-list":
            return <VaultList config={config} />
        case "narrative":
            return <Narrative config={config} embedded={embeddedNarrative} />
        case "custom":
            return <CustomFace config={config} fid={fid} />
        default:
            return null
    }
}

function Bar({ config, fixed }: { config: LabConfig; fixed: boolean }) {
    if (!config.bar) return null
    return <StickyBottomPlayer fixed={fixed} {...labTheme(config.theme)} />
}

/* ----------------------------- Contexts ----------------------------- */

const NAV = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "discover", label: "Discover", icon: <Compass size={18} /> },
    { id: "vault", label: "Vault", icon: <Vault size={18} /> },
    { id: "radio", label: "Radio", icon: <Radio size={18} /> },
    { id: "library", label: "Library", icon: <Library size={18} /> },
]

function Header({ context }: { context: string }) {
    return (
        <AppHeaderBar
            branding="SEA"
            appName="SEA Portal"
            contextLabel={context}
            actions={
                <button type="button" className="sh-icon-btn" aria-label="Search">
                    <Search size={18} />
                </button>
            }
            profile={
                <span className="sh-avatar" aria-label="Signed in as SENSEI">
                    SE
                </span>
            }
        />
    )
}

function Sidebar({
    config,
    active,
    onSelect,
}: {
    config: LabConfig
    active: string
    onSelect: (id: string) => void
}) {
    return (
        <div className="sh-side">
            <div>
                <p className="sh-side__title">Browse</p>
                <nav className="sh-side__nav" aria-label="App navigation">
                    {NAV.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="sh-side__link"
                            aria-current={item.id === active ? "page" : undefined}
                            onClick={() => onSelect(item.id)}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>
            {config.sidebar && (
                <div>
                    <p className="sh-side__title">Now playing</p>
                    <MiniSidebarPlayer art={NO_LUCK_ART} {...labTheme(config.theme)} />
                </div>
            )}
        </div>
    )
}

function ShellFooter({
    config,
    active,
    onSelect,
}: {
    config: LabConfig
    active: string
    onSelect: (id: string) => void
}) {
    return (
        <>
            <Bar config={config} fixed={false} />
            <BottomNavigation
                label="App navigation"
                items={NAV.slice(0, 4).map((item) => ({ ...item, active: item.id === active }))}
                onSelect={onSelect}
            />
        </>
    )
}

function ShellContext({
    config,
    fid,
    vault = false,
}: {
    config: LabConfig
    fid: string
    vault?: boolean
}) {
    const [active, setActive] = useState(vault ? "vault" : "home")
    const tracks = TRACK_SETS[config.tracks].tracks
    return (
        <AppShell
            className="sh-theme"
            mainId="lab-main"
            header={<Header context={vault ? "Vault · Catalog" : "Release · No Luck"} />}
            sidebar={<Sidebar config={config} active={active} onSelect={setActive} />}
            footer={<ShellFooter config={config} active={active} onSelect={setActive} />}
        >
            <div className="lab-page">
                <header>
                    <p className="lab-page__eyebrow">{vault ? "The Vault" : "Featured release"}</p>
                    <h1 className="lab-page__title">{vault ? "Catalog" : "No Luck — SENSEI"}</h1>
                    <p className="lab-page__lede">
                        {vault
                            ? "Demos, beats, mixes, and masters, each row playing into the one session."
                            : "A release page inside the app shell. The sidebar hides on phones, where the bottom navigation takes over."}
                    </p>
                </header>
                <div className="lab-page__face">
                    <MainFaceView
                        config={config}
                        fid={fid}
                        face={vault ? "vault-list" : config.main}
                    />
                </div>
                <section aria-label="More from SENSEI">
                    <p className="lab-page__eyebrow">More from SENSEI</p>
                    <div className="lab-page__row">
                        {tracks.slice(0, 4).map((track, index) => (
                            <div key={track.id ?? track.title} className="lab-tile">
                                <div
                                    className="lab-tile__art"
                                    style={{
                                        backgroundImage:
                                            index === 0
                                                ? NO_LUCK_ART
                                                : SEA_ARTS[index % SEA_ARTS.length],
                                    }}
                                />
                                <p className="lab-tile__title">{track.title}</p>
                                <p className="lab-tile__sub">{track.artist}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </AppShell>
    )
}

const PRICES = ["$1.29", "$0.99", "$1.49", "Free", "$2.00", "$0.99"]

function MarketplaceContext({ config, fid }: { config: LabConfig; fid: string }) {
    const tracks = TRACK_SETS[config.tracks].tracks.slice(0, 4)
    const theme = labTheme(config.theme)
    return (
        <div className="sh-theme lab-market">
            <div className="lab-market__bar">
                <Header context="Marketplace" />
            </div>
            <div className="lab-page">
                <header>
                    <p className="lab-page__eyebrow">SEA drops</p>
                    <h1 className="lab-page__title">Marketplace</h1>
                </header>
                {config.main === "portable" ? (
                    <div className="lab-price-grid">
                        {tracks.map((track, index) => (
                            <article key={track.id ?? track.title} className="lab-price-card">
                                <div className="lab-price-card__head">
                                    <strong>{track.title}</strong>
                                    <span className="lab-price-card__price">{PRICES[index]}</span>
                                </div>
                                <AudioPlayer
                                    title={track.title}
                                    artist={track.artist}
                                    audioFile={track.audioFile}
                                    showVolume={false}
                                    audioBackend={config.backend}
                                    {...theme}
                                />
                            </article>
                        ))}
                    </div>
                ) : (
                    <MainFaceView config={config} fid={fid} face="sea-grid" />
                )}
            </div>
            <Bar config={config} fixed />
        </div>
    )
}

const CHAPTER = [
    "Rain found the archive windows long before the lamps were lit. The keeper counted the drops the way other people count prayers: without expecting an answer, but unwilling to stop.",
    "Somewhere below, a door that should have been locked stood open by the width of a hand. The draft that came through it smelled of old paper and older weather.",
    "She did not go down at once. There is a kind of patience that is really fear wearing better clothes, and she had learned to recognize it in herself.",
    "The ledger on the desk was open to a page she had never written. The ink was still wet. The handwriting was hers.",
    "Outside, the rain changed its mind about the wind and began to fall sideways, tapping the glass as if asking to be let in.",
    "She read the first line twice. It described the room exactly as it was, down to the crooked lamp and the draft from the open door below.",
    "The second line described the next thing she would do. She put the ledger down, which was the third line.",
    "By the time the lamps were lit, the page was full, and the archive had one more story than it had that morning.",
]

function ReaderContext({ config, fid }: { config: LabConfig; fid: string }) {
    return (
        <div className="sh-theme lab-reader">
            <article className="lab-reader__article">
                <p className="lab-page__eyebrow">Chapter 1</p>
                <h1>The Archive at Night</h1>
                {CHAPTER.slice(0, 3).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
                {config.main === "narrative" && (
                    <div className="lab-reader__inline">
                        {/* With the bottom bar on, keep the face inline so the two fixed
                            layers never stack; without it, float it like a reader app. */}
                        <MainFaceView
                            config={config}
                            fid={fid}
                            face="narrative"
                            embeddedNarrative={!config.bar}
                        />
                    </div>
                )}
                {CHAPTER.slice(3).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
                {CHAPTER.map((paragraph) => (
                    <p key={`again-${paragraph}`}>{paragraph}</p>
                ))}
            </article>
            <Bar config={config} fixed />
        </div>
    )
}

function PhoneContext({ config, fid }: { config: LabConfig; fid: string }) {
    return (
        <div className="sh-theme lab-now">
            <div
                className="lab-now__art"
                style={{ backgroundImage: NO_LUCK_ART }}
                aria-hidden="true"
            />
            <div className="lab-now__content">
                <div
                    className="lab-now__cover"
                    style={{ backgroundImage: NO_LUCK_ART }}
                    role="img"
                    aria-label="No Luck cover art"
                />
                <MainFaceView config={config} fid={fid} />
            </div>
        </div>
    )
}

function BareContext({ config, fid }: { config: LabConfig; fid: string }) {
    return (
        <div className="sh-theme lab-bare">
            <div className="lab-bare__inner">
                <MainFaceView config={config} fid={fid} />
                <Bar config={config} fixed={false} />
            </div>
        </div>
    )
}

/* The old Lab's state tests plus the recovery paths added since. Each panel is
   isolated: its own engine (or session), its own fixture. */
function StatePanel({
    title,
    tone,
    description,
    expect,
    children,
}: {
    title: string
    tone: "err" | "warn" | "ok"
    description: string
    expect: string
    children: ReactNode
}) {
    return (
        <section className="lab-state-panel" aria-label={title}>
            <h2 className={`lab-state-panel__title lab-state-panel__title--${tone}`}>{title}</h2>
            <p className="lab-state-panel__desc">{description}</p>
            {children}
            <p className="lab-state-panel__expect">expect: {expect}</p>
        </section>
    )
}

const SKIP_QUEUE: Track[] = [
    { id: "skip-dead", title: "Dead end", artist: "Every source fails", audioFile: BROKEN },
    { id: "skip-next", title: "Plays after the skip", artist: "Sample", audioFile: SAMPLE },
]

function StateBoard({ config }: { config: LabConfig }) {
    const theme = labTheme(config.theme)
    return (
        <div className="sh-theme lab-states-board">
            <StatePanel
                title="Broken audio URL"
                tone="err"
                description="Confirms the error banner, its message, and that Retry makes a fresh attempt."
                expect="red error banner + Retry · play disabled · progress empty"
            >
                <AudioPlayer
                    title="Network down"
                    artist="SEIHouse"
                    audioFile={BROKEN}
                    {...labTheme("red")}
                />
            </StatePanel>
            <StatePanel
                title="Empty audio source"
                tone="warn"
                description="An empty string shows the “Audio file missing” banner. Every transport control is disabled."
                expect="warning banner · no scrub · mute + skip disabled"
            >
                <AudioPlayer title="Placeholder" artist="SEIHouse" audioFile="" {...theme} />
            </StatePanel>
            <StatePanel
                title="Playlist with mixed validity"
                tone="ok"
                description="Switch to “Signal Lost”: the playlist keeps its state and shows the error for that source only."
                expect="switching tracks resets time · broken track shows error · EQ on active row"
            >
                <AudioPlayer tracks={playlist} showTracklist repeatMode="one" {...theme} />
            </StatePanel>
            <StatePanel
                title="Fallback recovery"
                tone="ok"
                description="The primary URL is broken; the engine moves to the fallback source and plays it."
                expect="plays the sample · no error banner"
            >
                <AudioPlayer
                    title="Fallback rescue"
                    artist="SEIHouse"
                    sources={[{ url: BROKEN }, { url: SAMPLE }]}
                    {...theme}
                />
            </StatePanel>
            <StatePanel
                title="Skip policy (shared session)"
                tone="ok"
                description="Press play on the dead track: with trackErrorPolicy “skip”, the session moves on by itself."
                expect="dead track fails · session advances to “Plays after the skip”"
            >
                <AudioSessionProvider initialQueue={SKIP_QUEUE} trackErrorPolicy="skip">
                    <StickyBottomPlayer fixed={false} {...theme} />
                </AudioSessionProvider>
            </StatePanel>
        </div>
    )
}

export function LabContextView({ config, fid }: { config: LabConfig; fid: string }) {
    if (config.context === "states") return <StateBoard config={config} />
    let body: ReactNode
    switch (config.context) {
        case "marketplace":
            body = <MarketplaceContext config={config} fid={fid} />
            break
        case "vault":
            body = <ShellContext config={config} fid={fid} vault />
            break
        case "reader":
            body = <ReaderContext config={config} fid={fid} />
            break
        case "phone":
            body = <PhoneContext config={config} fid={fid} />
            break
        case "bare":
            body = <BareContext config={config} fid={fid} />
            break
        default:
            body = <ShellContext config={config} fid={fid} />
    }
    return (
        <LabSession config={config} fid={fid}>
            {body}
        </LabSession>
    )
}
