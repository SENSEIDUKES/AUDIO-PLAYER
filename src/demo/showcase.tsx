import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { SectionNav } from "./SectionNav"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    VaultRowPlayer,
    StickyBottomPlayer,
    MiniSidebarPlayer,
    SeaCardPlayer,
    SAPController,
    buildVaultTrackArcActions,
    buildStandardTrackArcActions,
    registerVaultCategory,
    useAudioSession,
} from "../audio-player"
import type {
    ArcAction,
    ArcCommandHost,
    Track,
    VaultCategory,
    WorkspaceRoute,
} from "../audio-player"
import { NextIcon, QueueIcon } from "../audio-player/skins/icons"
import { noLuckTracks, NO_LUCK_COVER, NO_LUCK_ART, SEA_THEME } from "./data"

/* Demonstrate a host-registered CUSTOM classification (beyond the built-ins) —
   it picks up the full accent system (rail, chip, hover/active) automatically. */
registerVaultCategory("liveTake", { label: "Live Take", color: "#E879F9" })

/* Showcase-only Vault fixture: the same No Luck tracks (ids preserved so they
   still play into the shared session queue) tagged with vaultCategory values so
   VaultRowPlayer can demonstrate per-category color identity. The last entry is
   the custom category registered above. */
const VAULT_SHOWCASE_CATEGORIES: (VaultCategory | string)[] = [
    "demo",
    "beat",
    "mix",
    "master",
    "toFinish",
    "liveTake",
]
const vaultShowcaseTracks: Track[] = noLuckTracks.map((track, i) => ({
    ...track,
    vaultCategory: VAULT_SHOWCASE_CATEGORIES[i % VAULT_SHOWCASE_CATEGORIES.length],
}))

/* Real immediate commands for a track's arc: Link copies the track URL,
   Favorite is a demo-level acknowledgment. These back the standardized arc's
   Share › Link / Favorite leaves. */
function trackCommands(track: Track): ArcCommandHost["commands"] {
    const url = track.audioFile ?? ""
    return {
        "share.url": () => {
            void navigator.clipboard?.writeText(url)
        },
        "track.favorite": () => {
            console.info(`Favorited: ${track.title}`)
        },
    }
}

/* The Vault rows with the standardized command wheel — the Vault face swaps
   the Plugins arm for its dedicated Vault arm (Tag / Rename / Playlist /
   Radio). Share leaves use the commands above; every workspace leaf routes
   into the one SAP Controller instance owned here. */
function ShowcaseVaultRows() {
    const s = useAudioSession()
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    // Studio Scout entitlement is deliberately absent here, so Agents › Scout
    // routes to its free Demo tier.
    const arcActions = useMemo(
        () => buildVaultTrackArcActions({ entitlements: { studioScout: false } }),
        []
    )
    return (
        <div className="showcase-face__vault">
            {vaultShowcaseTracks.map((t, i) => (
                <VaultRowPlayer
                    key={t.id ?? t.title}
                    track={t}
                    number={i + 1}
                    actions={arcActions}
                    commands={trackCommands(t)}
                    onOpenWorkspace={setRoute}
                    {...SEA_THEME}
                />
            ))}
            <SAPController
                open={route !== null}
                route={route ?? "options"}
                onClose={() => setRoute(null)}
                // Live session playback state so the arc's Playback › Controls
                // section shows real switches, not the empty placeholder.
                playback={{
                    shuffle: s.shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode: s.repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix: s.automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                {...SEA_THEME}
            />
        </div>
    )
}

/* SEA cards carry the standardized wheel (Plugins | Playback | Share | Agents)
   plus two lean queue immediates wired straight to the shared session, and
   route workspace leaves into a shared SAP Controller owned here. */
function ShowcaseSeaCards() {
    const s = useAudioSession()
    const [route, setRoute] = useState<WorkspaceRoute | null>(null)
    const cardActions = (track: Track): ArcAction[] => [
        {
            id: "play-next",
            label: "Play Next",
            icon: NextIcon,
            target: "immediate-action",
            onSelect: () => s.playNext(track),
        },
        {
            id: "play-later",
            label: "Play Later",
            icon: QueueIcon,
            target: "immediate-action",
            onSelect: () => s.enqueue(track),
        },
        ...buildStandardTrackArcActions({ activePluginIds: s.pluginNames }),
    ]
    return (
        <div className="showcase-face__sea">
            {noLuckTracks.slice(0, 4).map((t) => (
                <SeaCardPlayer
                    key={t.id ?? t.title}
                    track={t}
                    art={NO_LUCK_ART}
                    tag="SEA"
                    actions={cardActions(t)}
                    commands={trackCommands(t)}
                    onOpenWorkspace={setRoute}
                    {...SEA_THEME}
                />
            ))}
            <SAPController
                open={route !== null}
                route={route ?? "options"}
                onClose={() => setRoute(null)}
                // Live session playback state so the arc's Playback › Controls
                // section shows real switches, not the empty placeholder.
                playback={{
                    shuffle: s.shuffle,
                    onToggleShuffle: s.toggleShuffle,
                    repeatMode: s.repeatMode,
                    onCycleRepeat: s.cycleRepeat,
                    automix: s.automix,
                    onToggleAutomix: s.toggleAutomix,
                }}
                {...SEA_THEME}
            />
        </div>
    )
}

/* Captioned gallery card: every face example gets a name, a one-line
   description, and small capability tags so the family rules read at a glance. */
function FaceCard({
    name,
    surface,
    tags,
    children,
    wide = false,
}: {
    name: string
    surface: string
    tags?: string[]
    children: ReactNode
    wide?: boolean
}) {
    return (
        <article className={`showcase-face${wide ? " showcase-face--wide" : ""}`}>
            <div className="showcase-face__head">
                <h3 className="showcase-face__name">{name}</h3>
                <p className="showcase-face__desc">{surface}</p>
                {tags && tags.length > 0 && (
                    <ul className="showcase-tags" aria-label="Capabilities">
                        {tags.map((tag) => (
                            <li key={tag} className="showcase-tag">
                                {tag}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="showcase-face__body">{children}</div>
        </article>
    )
}

/* Top-of-page explainer: the two families and what each is for. */
function FamilyExplainer() {
    return (
        <section
            id="showcase-families"
            className="showcase-families-section"
            aria-labelledby="showcase-families-title"
        >
            <header className="showcase-gallery-head">
                <div className="showcase-section-kicker">Architecture · 2 Systems</div>
                <h2 id="showcase-families-title">Two player families</h2>
                <p>
                    Single shared audio engine tuned for different surface demands.
                </p>
            </header>
            <div className="showcase-families">
                <article className="showcase-family showcase-family--primary">
                    <div className="showcase-family__header">
                        <div className="showcase-family__badge-wrap">
                            <span className="showcase-family__dot showcase-family__dot--primary" />
                            <span className="showcase-family__badge">PrimaryPlayer</span>
                        </div>
                        <span className="showcase-family__role-badge">Release Faces</span>
                    </div>
                    <p className="showcase-family__role">
                        Full release experiences with rich artwork, metadata, SEICanvas visualizer, and waveform scrubbing.
                    </p>
                    <ul className="showcase-family__list">
                        <li className="showcase-family__item">
                            <span className="showcase-family__item-name">FullCardPlayer</span>
                            <span className="showcase-family__item-tag showcase-family__item-tag--featured">Flagship</span>
                        </li>
                        <li className="showcase-family__item">
                            <span className="showcase-family__item-name">SeaCardPlayer</span>
                            <span className="showcase-family__item-tag">Marketplace</span>
                        </li>
                        <li className="showcase-family__item">
                            <span className="showcase-family__item-name">Portable Full Player</span>
                            <span className="showcase-family__item-tag">Zero-Dep</span>
                        </li>
                        <li className="showcase-family__item is-future">
                            <span className="showcase-family__item-name">Canvas / Mobile Mode</span>
                            <span className="showcase-family__item-tag showcase-family__item-tag--future">Roadmap</span>
                        </li>
                    </ul>
                </article>
                <article className="showcase-family showcase-family--compact">
                    <div className="showcase-family__header">
                        <div className="showcase-family__badge-wrap">
                            <span className="showcase-family__dot showcase-family__dot--compact" />
                            <span className="showcase-family__badge">CompactPlayer</span>
                        </div>
                        <span className="showcase-family__role-badge">Utility Faces</span>
                    </div>
                    <p className="showcase-family__role">
                        Lightweight utility surfaces synced to the master StickyBottom transport.
                    </p>
                    <ul className="showcase-family__list">
                        <li className="showcase-family__item">
                            <span className="showcase-family__item-name">MiniSidebarPlayer</span>
                            <span className="showcase-family__item-tag">Sidebar</span>
                        </li>
                        <li className="showcase-family__item">
                            <span className="showcase-family__item-name">StickyBottomPlayer</span>
                            <span className="showcase-family__item-tag showcase-family__item-tag--featured">Master Scrubber</span>
                        </li>
                        <li className="showcase-family__item">
                            <span className="showcase-family__item-name">VaultRowPlayer</span>
                            <span className="showcase-family__item-tag">Catalog Row</span>
                        </li>
                        <li className="showcase-family__item is-future">
                            <span className="showcase-family__item-name">QueueRowPlayer</span>
                            <span className="showcase-family__item-tag showcase-family__item-tag--future">Roadmap</span>
                        </li>
                    </ul>
                </article>
            </div>
        </section>
    )
}

/* ----------------------------- Showcase page ----------------------------- */
const SHOWCASE_SECTIONS = [
    { id: "showcase-hero", label: "Featured", number: "01", category: "Release" },
    { id: "showcase-families", label: "Families", number: "02", category: "Design" },
    { id: "showcase-primary", label: "Primary", number: "03", category: "Playback" },
    { id: "showcase-compact", label: "Compact", number: "04", category: "Surfaces" },
    { id: "showcase-notes", label: "Specs", number: "05", category: "Engine" },
] as const

/* The clean gallery: the two player families, all playing the "No Luck"
   release. No broken URLs, debug panels, or stress tests here — that material
   lives in the Lab tab. */
export function Showcase() {
    return (
        <main className="product-preview" aria-labelledby="showcase-title">
            <SectionNav
                sections={SHOWCASE_SECTIONS}
                defaultSectionId="showcase-hero"
                ariaLabel="Showcase quick navigation"
            />

            <section id="showcase-hero" className="product-preview__hero">
                <div className="product-preview__copy">
                    <div className="product-preview__pill">
                        <span className="product-preview__pill-dot" aria-hidden="true" />
                        Featured Release · Portable Core
                    </div>
                    <h1 id="showcase-title" className="product-preview__title">
                        One playback layer, two player families.
                    </h1>
                    <p className="product-preview__lede">
                        Unified audio engine powering flagship release surfaces and compact utility players.
                    </p>
                    <div className="product-preview__actions">
                        <button
                            type="button"
                            className="product-preview__btn product-preview__btn--primary"
                            onClick={() => {
                                const el = document.getElementById("showcase-primary")
                                el?.scrollIntoView({ behavior: "smooth" })
                            }}
                        >
                            Explore Faces
                        </button>
                        <button
                            type="button"
                            className="product-preview__btn product-preview__btn--secondary"
                            onClick={() => {
                                const el = document.getElementById("showcase-families")
                                el?.scrollIntoView({ behavior: "smooth" })
                            }}
                        >
                            Architecture
                        </button>
                    </div>
                    <div className="product-preview__metrics" aria-label="Release highlights">
                        <span>
                            <strong>6</strong> tracks
                        </span>
                        <span>
                            <strong>2025</strong> release
                        </span>
                        <span>
                            <strong>SENSEI</strong> · No Luck
                        </span>
                    </div>
                </div>

                <div className="product-preview__stage">
                    <div className="product-preview__art" aria-hidden="true">
                        <div className="product-preview__orb product-preview__orb--one" />
                        <div className="product-preview__orb product-preview__orb--two" />
                        <div className="product-preview__vinyl" />
                    </div>
                    <div className="product-preview__player-card">
                        <div className="product-preview__release-meta">
                            <span>Featured release · PrimaryPlayer · portable</span>
                            <strong>No Luck — SENSEI</strong>
                        </div>
                        <AudioPlayer
                            tracks={noLuckTracks}
                            showTracklist
                            showWaveform
                            repeatMode="all"
                            accentColor="#22D3A6"
                            progressColor="#22D3A6"
                            trackColor="rgba(34,211,166,0.22)"
                            playIconColor="#07100d"
                            textColor="#FFFFFF"
                            backgroundColor="rgba(9, 12, 18, 0.68)"
                            backgroundImage={{ src: NO_LUCK_COVER }}
                            darkenAmount={58}
                            blurSize={24}
                        />
                    </div>
                </div>
            </section>

            <FamilyExplainer />

            <AudioSessionProvider initialQueue={noLuckTracks}>
                <section
                    id="showcase-primary"
                    className="showcase-gallery-section"
                    aria-labelledby="showcase-primary-title"
                >
                    <header className="showcase-gallery-head">
                        <div className="showcase-section-kicker">Primary Family · Flagship</div>
                        <h2 id="showcase-primary-title">PrimaryPlayer family</h2>
                        <p>
                            Rich release surfaces with interactive waveform scrubbers, SEICanvas slots, and action wheels.
                        </p>
                    </header>
                    <div className="showcase-gallery">
                        <FaceCard
                            name="FullCardPlayer"
                            surface="Flagship / foundation — the rich now-playing card for album worlds and artist pages."
                            tags={["SEICanvas", "Waveform / ScrubberCanvas", "Action button"]}
                            wide
                        >
                            <FullCardPlayer {...SEA_THEME} />
                        </FaceCard>
                        <FaceCard
                            name="SeaCardPlayer"
                            surface="Marketplace / card variant — embeddable SEA drop cards built on the primary contract. Swipeable on mobile."
                            tags={["SEICanvas", "Waveform / ScrubberCanvas", "Action button"]}
                        >
                            <ShowcaseSeaCards />
                        </FaceCard>
                    </div>
                </section>

                <section
                    id="showcase-compact"
                    className="showcase-gallery-section"
                    aria-labelledby="showcase-compact-title"
                >
                    <header className="showcase-gallery-head">
                        <div className="showcase-section-kicker">Compact Family · Utility</div>
                        <h2 id="showcase-compact-title">CompactPlayer family</h2>
                        <p>
                            Minimal utility surfaces synchronized to the shared StickyBottom master transport.
                        </p>
                    </header>
                    <div className="showcase-gallery">
                        <FaceCard
                            name="MiniSidebarPlayer"
                            surface="Minimal compact widget — no inline scrubber, no inline Next button (skip/next moved into the action menu)."
                            tags={["Action button", "No inline scrubber"]}
                        >
                            <MiniSidebarPlayer art={NO_LUCK_ART} {...SEA_THEME} />
                        </FaceCard>
                        <FaceCard
                            name="StickyBottomPlayer"
                            surface="Shared compact master transport — owns the one scrubber the compact family seeks through. Pinned to the viewport in production, inline here."
                            tags={["Master scrubber", "Action button"]}
                            wide
                        >
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </FaceCard>
                        <FaceCard
                            name="VaultRowPlayer"
                            surface="List / data / action row — full-row classification color, an Arc action button, and no per-row scrubber."
                            tags={["Classification color", "Arc actions", "No per-row scrubber"]}
                            wide
                        >
                            <ShowcaseVaultRows />
                        </FaceCard>
                    </div>
                </section>
            </AudioSessionProvider>

            <section
                id="showcase-notes"
                className="product-preview__details"
                aria-label="Showcase notes"
            >
                <article>
                    <span>01</span>
                    <h2>Two families, one engine</h2>
                    <p>
                        PrimaryPlayer carries the full release experience; CompactPlayer stays
                        minimal. Both share the unified core engine.
                    </p>
                </article>
                <article>
                    <span>02</span>
                    <h2>One shared session</h2>
                    <p>
                        Both galleries run on a single AudioSessionProvider, keeping all surfaces synchronized across one queue.
                    </p>
                </article>
                <article>
                    <span>03</span>
                    <h2>Test &amp; customize</h2>
                    <p>
                        Switch to Lab for QA, broken states, backends, and plugins — or Workshop to customize faces and presets.
                    </p>
                </article>
            </section>
        </main>
    )
}
