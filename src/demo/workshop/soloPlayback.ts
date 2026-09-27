/* One engine at a time — the Workshop's protection against demo engines
   playing over each other.

   Two layers keep audio from overlapping:

   1. Route changes unmount the previous workspace (see WorkshopApp), and the
      Testing Lab remounts its preview page whenever the scenario changes. An
      unmounted engine's <audio> element leaves the document, which stops it.
   2. Inside one page, this guard pauses every other in-page <audio> element the
      moment one starts playing. Pausing goes through the element, which each
      engine already treats like any outside pause (lock screen, headphones).

   What it deliberately leaves alone: work *inside* one engine. Automix's second
   deck, SceneMix decks, one-shots, and sprite layers use detached elements or
   Web Audio that never enter the document, so crossfades and narration layers
   keep playing together exactly as before. Muted background <video> elements
   are never touched. This lives in the demo only; the package is unchanged. */

export interface SoloPlaybackOptions {
    /** Called after an in-page <audio> element starts playing. */
    onPlay?: (element: HTMLAudioElement) => void
}

/** Pause every playing <audio> element in `doc` except `keep`. Returns how many were paused. */
export function pauseOtherAudio(doc: Document, keep?: HTMLAudioElement | null): number {
    let paused = 0
    doc.querySelectorAll("audio").forEach((element) => {
        if (element === keep || element.paused) return
        element.pause()
        paused += 1
    })
    return paused
}

/** Install the guard on a document. Returns an uninstall function. */
export function installSoloPlayback(
    doc: Document = document,
    { onPlay }: SoloPlaybackOptions = {}
): () => void {
    const view = doc.defaultView
    const AudioElement = view?.HTMLAudioElement
    const handlePlay = (event: Event) => {
        const target = event.target
        if (!AudioElement || !(target instanceof AudioElement)) return
        pauseOtherAudio(doc, target)
        onPlay?.(target)
    }
    // Media events don't bubble, so listen in the capture phase.
    doc.addEventListener("play", handlePlay, true)
    return () => doc.removeEventListener("play", handlePlay, true)
}
