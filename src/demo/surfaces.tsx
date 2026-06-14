import {
    AudioSessionProvider,
    FullCardPlayer,
    MiniSidebarPlayer,
} from "../audio-player"
import { noLuckTracks, NO_LUCK_ART, SEA_THEME } from "./data"

/* Surfaces — Phase 1 UI infrastructure demo.
   A deliberately simple page that demonstrates the new render zones on real
   faces: the expanded FullCardPlayer (SEICanvas + hero collapse + in-region
   queue) and the compact MiniSidebarPlayer (compact ScrubberCanvas + queue, no
   canvas). Both share one session so playback stays in sync. */
export function SurfacesDemo() {
    return (
        <main className="surfaces-demo" aria-labelledby="surfaces-title">
            <header className="surfaces-demo__head">
                <p className="surfaces-demo__eyebrow">Phase 1 · Render zones</p>
                <h1 id="surfaces-title" className="surfaces-demo__title">
                    SEICanvas &amp; ScrubberCanvas surfaces
                </h1>
                <p className="surfaces-demo__lede">
                    Placeholder infrastructure only. Use the two surface buttons
                    under the controls: the left opens the SEICanvas (the hero
                    collapses), the right opens the in-region “Up Next” queue.
                    One surface is open at a time. Compact faces never show the
                    canvas button.
                </p>
            </header>

            <AudioSessionProvider initialQueue={noLuckTracks}>
                <div className="surfaces-demo__grid">
                    <section className="surfaces-demo__face">
                        <h2>Expanded — FullCardPlayer</h2>
                        <p className="surfaces-demo__note">
                            Supports SEICanvas + hero collapse. Tap the canvas
                            button to open the placeholder canvas; tap the queue
                            button for the in-region “Up Next”.
                        </p>
                        <FullCardPlayer {...SEA_THEME} />
                    </section>

                    <section className="surfaces-demo__face">
                        <h2>Compact — MiniSidebarPlayer</h2>
                        <p className="surfaces-demo__note">
                            No SEICanvas (no canvas button). Shows a compact
                            ScrubberCanvas and the queue surface behind the
                            right button.
                        </p>
                        <MiniSidebarPlayer art={NO_LUCK_ART} {...SEA_THEME} />
                    </section>
                </div>
            </AudioSessionProvider>
        </main>
    )
}

export default SurfacesDemo
