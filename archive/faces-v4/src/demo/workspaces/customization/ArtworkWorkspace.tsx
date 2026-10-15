import { useState } from "react"
import {
    AudioPlayer,
    AudioSessionProvider,
    FullCardPlayer,
    MiniSidebarPlayer,
    SeaCardPlayer,
} from "../../../audio-player"
import type { MediaSource } from "../../../audio-player"
import { NO_LUCK_ART, NO_LUCK_COVER, SEA_ARTS, SEA_THEME, noLuckTracks } from "../../data"
import { MediaPicker } from "../../panel/MediaPicker"
import { Note, Panel, RangeField, Segmented, SplitLayout } from "../../workshop/ui"

/* Artwork and backgrounds: the unified media props. Images and muted looping
   videos go behind the player (background) or in its artwork block (art); the
   audio engine stays the only source of sound. */

type ArtFallback = "cover" | "gradient"

export function ArtworkWorkspace() {
    const [backgroundMedia, setBackgroundMedia] = useState<MediaSource | null>({
        kind: "image",
        src: NO_LUCK_COVER,
    })
    const [artMedia, setArtMedia] = useState<MediaSource | null>(null)
    const [blurSize, setBlurSize] = useState(20)
    const [darkenAmount, setDarkenAmount] = useState(45)
    const [fallback, setFallback] = useState<ArtFallback>("cover")
    const art = fallback === "cover" ? NO_LUCK_ART : SEA_ARTS[0]

    return (
        <SplitLayout
            stage={
                <>
                    <AudioSessionProvider initialQueue={noLuckTracks}>
                        <div className="wk-stage-card">
                            <p className="wk-stage-card__title">
                                FullCardPlayer · background + cover
                            </p>
                            <FullCardPlayer
                                backgroundMedia={backgroundMedia}
                                blurSize={blurSize}
                                darkenAmount={darkenAmount}
                                artMedia={artMedia}
                                art={art}
                                {...SEA_THEME}
                            />
                        </div>
                        <div className="wk-stage-grid">
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">SeaCardPlayer · cover</p>
                                <SeaCardPlayer
                                    track={noLuckTracks[0]}
                                    art={art}
                                    artMedia={artMedia}
                                    tag="SEA"
                                    {...SEA_THEME}
                                />
                            </div>
                            <div className="wk-stage-card">
                                <p className="wk-stage-card__title">MiniSidebarPlayer · cover</p>
                                <MiniSidebarPlayer art={art} artMedia={artMedia} {...SEA_THEME} />
                            </div>
                        </div>
                    </AudioSessionProvider>
                    <div className="wk-stage-card">
                        <p className="wk-stage-card__title">Portable AudioPlayer · background</p>
                        <AudioPlayer
                            tracks={noLuckTracks.slice(0, 3)}
                            backgroundMedia={backgroundMedia}
                            blurSize={blurSize}
                            darkenAmount={darkenAmount}
                            {...SEA_THEME}
                        />
                    </div>
                </>
            }
            controls={
                <>
                    <Panel
                        title="Background"
                        hint="Full-bleed behind the portable player and FullCardPlayer."
                    >
                        <MediaPicker
                            label="Background"
                            description="Image or muted looping video."
                            value={backgroundMedia}
                            onChange={setBackgroundMedia}
                        />
                        <RangeField
                            label="Blur"
                            value={blurSize}
                            min={0}
                            max={40}
                            unit="px"
                            onChange={setBlurSize}
                        />
                        <RangeField
                            label="Darken"
                            value={darkenAmount}
                            min={0}
                            max={100}
                            unit="%"
                            onChange={setDarkenAmount}
                        />
                    </Panel>
                    <Panel
                        title="Cover art"
                        hint="The artwork block on FullCard (collapsed hero), SEA cards, and the mini player."
                    >
                        <MediaPicker
                            label="Cover Art"
                            description="Supersedes the CSS art below when set."
                            value={artMedia}
                            onChange={setArtMedia}
                        />
                        <Segmented
                            label="CSS art fallback"
                            value={fallback}
                            options={[
                                { value: "cover", label: "No Luck cover" },
                                { value: "gradient", label: "Gradient" },
                            ]}
                            onChange={setFallback}
                        />
                    </Panel>
                    <Note>
                        Video is visual only: it plays muted and looped, and never competes with the
                        audio engine.
                    </Note>
                </>
            }
        />
    )
}
