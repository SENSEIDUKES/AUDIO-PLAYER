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
import { noLuckTracks, NO_LUCK_COVER, NO_LUCK_ART, SEA_THEME } from "./data"

/* Captioned gallery card: every face example gets a name and a one-line
   description of the surface it is built for. */
function FaceCard({
    name,
    surface,
    children,
    wide = false,
}: {
    name: string
    surface: string
    children: ReactNode
    wide?: boolean
}) {
    return (
        <article className={`showcase-face${wide ? " showcase-face--wide" : ""}`}>
            <div className="showcase-face__head">
                <h3 className="showcase-face__name">{name}</h3>
                <p className="showcase-face__desc">{surface}</p>
            </div>
            <div className="showcase-face__body">{children}</div>
        </article>
    )
}

/* ----------------------------- Showcase page ----------------------------- */
/* The clean gallery: one working example of every player face, all playing the
   "No Luck" release. No broken URLs, debug panels, or stress tests here —
   that material lives in the Lab tab. */
export function Showcase() {
    return (
        <main className="product-preview" aria-labelledby="showcase-title">
            <section className="product-preview__hero">
                <div className="product-preview__copy">
                    <div className="product-preview__pill">Featured release · Main AudioPlayer</div>
                    <h1 id="showcase-title" className="product-preview__title">
                        One playback layer, every SEIHouse surface.
                    </h1>
                    <p className="product-preview__lede">
                        The same SEIHouse player engine powers the Vault, SEA
                        cards, album worlds, artist pages, and Vault Radio.
                        This page shows each player face working cleanly — the
                        release player below and the gallery of faces beneath
                        it all play <strong>No Luck</strong> by SENSEI.
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
                            <span>Featured release</span>
                            <strong>No Luck — SENSEI</strong>
                        </div>
                        <AudioPlayer
                            tracks={noLuckTracks}
                            showTracklist
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

            <section className="showcase-gallery-section" aria-labelledby="showcase-gallery-title">
                <header className="showcase-gallery-head">
                    <h2 id="showcase-gallery-title">Player faces</h2>
                    <p>
                        Every face below reads from one shared session — one{" "}
                        <code>&lt;audio&gt;</code> element, one queue. Press
                        play anywhere and every face stays in sync.
                    </p>
                </header>
                <AudioSessionProvider initialQueue={noLuckTracks}>
                    <div className="showcase-gallery">
                        <FaceCard
                            name="FullCardPlayer"
                            surface="Rich now-playing card for album worlds and artist pages."
                        >
                            <FullCardPlayer {...SEA_THEME} />
                        </FaceCard>
                        <FaceCard
                            name="MiniSidebarPlayer"
                            surface="Condensed widget for sidebars and dashboards."
                        >
                            <MiniSidebarPlayer art={NO_LUCK_ART} {...SEA_THEME} />
                        </FaceCard>
                        <FaceCard
                            name="VaultRowPlayer"
                            surface="Slim list rows for the Vault — each row plays into the shared queue."
                        >
                            <div className="showcase-face__vault">
                                {noLuckTracks.map((t, i) => (
                                    <VaultRowPlayer
                                        key={t.id ?? t.title}
                                        track={t}
                                        number={i + 1}
                                        {...SEA_THEME}
                                    />
                                ))}
                            </div>
                        </FaceCard>
                        <FaceCard
                            name="SeaCardPlayer"
                            surface="Embeddable marketplace cards for SEA drops."
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
                        <FaceCard
                            name="StickyBottomPlayer"
                            surface="Persistent playback bar — pinned to the viewport in production, shown inline here."
                            wide
                        >
                            <StickyBottomPlayer fixed={false} {...SEA_THEME} />
                        </FaceCard>
                    </div>
                </AudioSessionProvider>
            </section>

            <section className="product-preview__details" aria-label="Showcase notes">
                <article>
                    <span>01</span>
                    <h2>Real components</h2>
                    <p>Every face on this page is the production component — the same engine, session system, and skins that ship to SEIHouse surfaces.</p>
                </article>
                <article>
                    <span>02</span>
                    <h2>One shared session</h2>
                    <p>The gallery runs on a single AudioSessionProvider, so the Vault rows, SEA cards, and playback bar all mirror one queue.</p>
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
