/**
 * Receives one media element's composed gain (0..1) in place of
 * `HTMLMediaElement.volume`. A host routes the element through Web Audio
 * (element → MediaElementAudioSourceNode → GainNode) and returns this sink so
 * an engine's fades and levels keep working on browsers that ignore element
 * volume writes (iOS Safari).
 */
export interface MediaGainSink {
    /** Apply the element's composed gain, 0..1. Called often during fades. */
    setGain(value: number): void
    /** Disconnect the element's nodes. Called once when the element is released. */
    dispose(): void
}

/**
 * Builds a gain sink for an element an engine has just created, before its
 * `src` is assigned. Return `null` to keep the plain element-volume path for
 * that element (for example when the AudioContext cannot route it).
 */
export type MediaGainSinkFactory = (element: HTMLAudioElement) => MediaGainSink | null

/**
 * Spare `Audio` elements prepared inside a user gesture.
 *
 * Some browsers (WebKit on iOS) unlock audible playback per media element:
 * an element that was loaded or played during a user gesture may later play
 * from lifecycle code, while a brand-new element may not. Engines take their
 * next element from this pool, so a scene change or a cue reached while the
 * reader scrolls can start without a fresh tap. Elsewhere the pool is inert:
 * a spare is just an ordinary `Audio` element.
 */
export class UnlockedAudioPool {
    private spares: HTMLAudioElement[] = []

    constructor(private readonly size: number) {}

    /** Top the pool up. Call only from inside a user-gesture handler. */
    prime(): void {
        if (typeof Audio === "undefined") return
        while (this.spares.length < this.size) {
            let el: HTMLAudioElement
            try {
                el = new Audio()
            } catch {
                return
            }
            try {
                // WebKit lifts the element's gesture restriction when load()
                // runs during a user gesture; there is nothing to fetch yet.
                el.load()
            } catch {
                // Still usable as an ordinary element.
            }
            this.spares.push(el)
        }
    }

    /** A primed spare when one is ready, otherwise a fresh element. */
    take(): HTMLAudioElement {
        return this.spares.pop() ?? new Audio()
    }

    clear(): void {
        this.spares = []
    }
}
