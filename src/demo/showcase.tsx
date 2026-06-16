import type { ReactNode } from "react"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    VaultRowPlayer,
    StickyBottomPlayer,
    MiniSidebarPlayer,
    SeaCardPlayer,
} from "../audio-player"
import type { Track, VaultCategory } from "../audio-player"
import { noLuckTracks, NO_LUCK_COVER, NO_LUCK_ART, SEA_THEME } from "./data"

/* Showcase-only Vault fixture: the same No Luck tracks (ids preserved so they
   still play into the shared session queue) tagged with vaultCategory values so
   VaultRowPlayer can demonstrate per-category color identity from PR #42. */
const VAULT_SHOWCASE_CATEGORIES: VaultCategory[] = [
    "demo",
    "beat",
    "mix",
    "master",
    "memo",
    "toFinish",
]
const vaultShowcaseTracks: Track[] = noLuckTracks.map((track, i) => ({
    ...track,
    vaultCategory: VAULT_SHOWCASE_CATEGORIES[i % VAULT_SHOWCASE_CATEGORIES.length],
}))

/* Simple demo handler so the VaultRow action button actually renders here. */
const handleVaultAction = (track: Track) =>
    console.log("Vault action", track.title)

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
            className="showcase-families-section"
            aria-labelledby="showcase-families-title"
        >
            <header className="showcase-gallery-head">
                <h2 id="showcase-families-title">Two player families</h2>
                <p>
                    Every SEIHouse player face belongs to one of two families.
                    Same shared engine — different jobs.
                </p>
            </header>
            <div className="showcase-families">
                <article className="showcase-family showcase-family--primary">
                    <span className="showcase-family__badge">PrimaryPlayer</span>
                    <p className="showcase-family__role">
                        Full release experiences — rich artwork, metadata,
                        SEICanvas, and waveform.
                    </p>
                    <ul className="showcase-family__list">
                        <li>
                            FullCard <span>flagship</span>
                        </li>
                        <li>SeaCard / Marketplace</li>
                        <li>Portable full player</li>
                        <li className="is-future">
                            Canvas / mobile mode <span>soon</span>
                        </li>
                    </ul>
                </article>
                <article className="showcase-family showcase-family--compact">
                    <span className="showcase-family__badge">CompactPlayer</span>
                    <p className="showcase-family__role">
                        Utility playback surfaces — minimal and fast, synced to
                        the StickyBottom master transport.
                    </p>
                    <ul className="showcase-family__list">
                        <li>MiniSidebar</li>
                        <li>
                            StickyBottom <span>shared scrubber</span>
                        </li>
                        <li>VaultRow</li>
                        <li className="is-future">
                            QueueRow <span>soon</span>
                        </li>
                    </ul>
                </article>
            </div>
        </section>
    )
}

/* ----------------------------- Showcase page ----------------------------- */
/* The clean gallery: the two player families, all playing the "No Luck"
   release. No broken URLs, debug panels, or stress tests here — that material
   lives in the Lab tab. */
export function Showcase() {
    return (
        <main className="product-preview" aria-labelledby="showcase-title">
            <section className="product-preview__hero">
                <div className="product-preview__copy">
                    <div className="product-preview__pill">Featured release · Portable AudioPlayer</div>
                    <h1 id="showcase-title" className="product-preview__title">
                        One playback layer, two player families.
                    </h1>
                    <p className="product-preview__lede">
                        The same SEIHouse player engine powers the Vault, SEA
                        cards, album worlds, artist pages, and Vault Radio.
                        This page shows both families working cleanly — the
                        portable full player below, then the PrimaryPlayer and
                        CompactPlayer galleries all playing{" "}
                        <strong>No Luck</strong> by SENSEI.
                    </p>
                    <div className="product-preview__metrics" aria-label="Release highlights">
                        <span><strong>6</strong> tracks</span>
                        <span><strong>2025</strong> release</span>
                        <span><strong>SENSEI</strong> · No Luck</span>
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
                    className="showcase-gallery-section"
                    aria-labelledby="showcase-primary-title"
                >
                    <header className="showcase-gallery-head">
                        <h2 id="showcase-primary-title">PrimaryPlayer family</h2>
                        <p>
                            Rich, full release surfaces. They carry artwork,
                            metadata, the SEICanvas, and the interactive waveform
                            scrubber. The portable full player is the release
                            player in the hero above.
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
                            surface="Marketplace / card variant — embeddable SEA drop cards built on the primary contract."
                            tags={["SEICanvas", "Waveform / ScrubberCanvas", "Action button"]}
                        >
                            <div className="showcase-face__sea">
                                {noLuckTracks.slice(0, 4).map((t) => (
                                    <SeaCardPlayer
                                        key={t.id ?? t.title}
                                        track={t}
                                        art={NO_LUCK_ART}
                                        tag="SEA"
                                        {...SEA_THEME}
                                    />
                                ))}
                            </div>
                        </FaceCard>
                    </div>
                </section>

                <section
                    className="showcase-gallery-section"
                    aria-labelledby="showcase-compact-title"
                >
                    <header className="showcase-gallery-head">
                        <h2 id="showcase-compact-title">CompactPlayer family</h2>
                        <p>
                            Small utility surfaces. They stay minimal — no
                            per-face scrubbers. StickyBottom is the shared
                            compact master transport that owns the scrubber for
                            the whole family.
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
                            surface="List / data / action row — Vault-category color identity, an action button, and no per-row scrubber."
                            tags={["Vault category color", "Action button", "No per-row scrubber"]}
                            wide
                        >
                            <div className="showcase-face__vault">
                                {vaultShowcaseTracks.map((t, i) => (
                                    <VaultRowPlayer
                                        key={t.id ?? t.title}
                                        track={t}
                                        number={i + 1}
                                        onAction={handleVaultAction}
                                        {...SEA_THEME}
                                    />
                                ))}
                            </div>
                        </FaceCard>
                    </div>
                </section>
            </AudioSessionProvider>

            <section className="product-preview__details" aria-label="Showcase notes">
                <article>
                    <span>01</span>
                    <h2>Two families, one engine</h2>
                    <p>PrimaryPlayer carries the full release experience; CompactPlayer stays minimal. Both are the production components that ship to SEIHouse surfaces.</p>
                </article>
                <article>
                    <span>02</span>
                    <h2>One shared session</h2>
                    <p>Both galleries run on a single AudioSessionProvider, so the SEA cards, mini sidebar, Vault rows, and the StickyBottom master all mirror one queue.</p>
                </article>
                <article>
                    <span>03</span>
                    <h2>Test &amp; customize</h2>
                    <p>Switch to Lab for QA, broken states, backends, and plugin coverage — or to Workshop to restyle a face and save presets.</p>
                </article>
            </section>
        </main>
    )
}
