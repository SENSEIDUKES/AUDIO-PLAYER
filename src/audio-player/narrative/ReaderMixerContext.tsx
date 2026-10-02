import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react"
import type { ReactNode } from "react"
import { createReaderMixer } from "./ReaderMixer"
import type { ReaderMixer, ReaderMixerOptions, ReaderMixerState } from "./ReaderMixer"

const ReaderMixerContext = createContext<ReaderMixer | null>(null)

export interface ReaderMixerProviderProps {
    /**
     * An existing mixer to share. The provider never disposes a mixer it was
     * given; omit it to let the provider create and own one.
     */
    mixer?: ReaderMixer
    /**
     * Options for the mixer the provider creates. Read once, when the mixer is
     * created; later changes are ignored (use the mixer's methods instead).
     */
    options?: ReaderMixerOptions
    children?: ReactNode
}

/**
 * Shares one {@link ReaderMixer} with everything under it, so the reader's
 * audio button, its Settings menu and the chapter view all drive the same
 * three layers. Place it high enough to outlive chapter changes.
 */
export function ReaderMixerProvider({ mixer, options, children }: ReaderMixerProviderProps) {
    const optionsRef = useRef(options)
    const [owned, setOwned] = useState<ReaderMixer | null>(null)

    useEffect(() => {
        if (mixer) return
        const created = createReaderMixer(optionsRef.current)
        setOwned(created)
        return () => created.dispose()
    }, [mixer])

    const value = mixer ?? owned
    return (
        <ReaderMixerContext.Provider value={value}>
            {value ? children : null}
        </ReaderMixerContext.Provider>
    )
}

/** The shared mixer. Throws outside a `ReaderMixerProvider`. */
export function useReaderMixer(): ReaderMixer {
    const mixer = useContext(ReaderMixerContext)
    if (!mixer) throw new Error("useReaderMixer must be used inside a ReaderMixerProvider")
    return mixer
}

/** The shared mixer, or `null` outside a provider. */
export function useOptionalReaderMixer(): ReaderMixer | null {
    return useContext(ReaderMixerContext)
}

/**
 * Live mixer state for UI. Uses the provider's mixer when `mixer` is omitted;
 * pass `null` to read no mixer. Returns `null` when there is no mixer.
 */
export function useReaderMixerState(mixer?: ReaderMixer | null): ReaderMixerState | null {
    const contextMixer = useContext(ReaderMixerContext)
    const target = mixer === undefined ? contextMixer : mixer
    const subscribe = useCallback(
        (listener: () => void) => (target ? target.subscribe(listener) : () => {}),
        [target]
    )
    const getSnapshot = useCallback(() => (target ? target.getState() : null), [target])
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
