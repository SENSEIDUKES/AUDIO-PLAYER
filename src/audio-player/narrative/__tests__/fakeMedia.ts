/**
 * Test doubles for the reader mixer: an `Audio` element with controllable
 * play() and volume locking, and an `AudioContext` that records its graph.
 */

export type FakePlayBehavior =
    "resolve" | "not-allowed" | "reject" | "pending" | ((audio: FakeAudio) => Promise<void>)

export class FakeAudio {
    static created: FakeAudio[] = []
    static playBehavior: FakePlayBehavior = "resolve"
    /** Mimic iOS Safari: volume writes are ignored and read back 1. */
    static volumeLocked = false

    loop = false
    preload = ""
    crossOrigin: string | null = null
    muted = false
    paused = true
    readyState = 0
    duration = Number.NaN
    src = ""
    error: MediaError | null = null
    currentTime = 0
    playCalls = 0
    pauseCalls = 0
    loadCalls = 0
    loadActivations: boolean[] = []

    private volumeValue = 1
    private listeners = new Map<string, Set<EventListener>>()

    constructor() {
        FakeAudio.created.push(this)
    }

    static reset(): void {
        FakeAudio.created = []
        FakeAudio.playBehavior = "resolve"
        FakeAudio.volumeLocked = false
    }

    /** Elements that were given this URL (decks and pooled cues). */
    static withSrc(url: string): FakeAudio[] {
        return FakeAudio.created.filter((audio) => audio.src === url)
    }

    get volume(): number {
        return this.volumeValue
    }

    set volume(value: number) {
        if (FakeAudio.volumeLocked) return
        this.volumeValue = value
    }

    addEventListener(
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions | boolean
    ): void {
        const signal = typeof options === "object" ? options.signal : undefined
        if (signal?.aborted) return
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(listener)
        signal?.addEventListener("abort", () => this.listeners.get(type)?.delete(listener), {
            once: true,
        })
    }

    removeEventListener(type: string, listener: EventListener): void {
        this.listeners.get(type)?.delete(listener)
    }

    removeAttribute(name: string): void {
        if (name === "src") this.src = ""
    }

    load(): void {
        this.loadCalls += 1
        this.loadActivations.push(navigator.userActivation?.isActive ?? false)
    }

    pause(): void {
        this.pauseCalls += 1
        if (this.paused) return
        this.paused = true
        this.dispatch("pause")
    }

    play(): Promise<void> {
        this.playCalls += 1
        if (FakeAudio.playBehavior === "not-allowed") {
            const error = new Error("play() blocked")
            error.name = "NotAllowedError"
            return Promise.reject(error)
        }
        if (FakeAudio.playBehavior === "reject") {
            return Promise.reject(new Error("decode failure"))
        }
        const behavior = FakeAudio.playBehavior
        const result =
            typeof behavior === "function"
                ? behavior(this)
                : behavior === "pending"
                  ? new Promise<void>(() => {})
                  : Promise.resolve()
        return result.then(() => {
            this.paused = false
            this.dispatch("playing")
        })
    }

    dispatch(type: string): void {
        if (type === "loadedmetadata") this.readyState = 1
        const event = new Event(type)
        for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event)
    }
}

export class FakeAudioParam {
    value = 1
    cancelScheduledValues(): void {}
    setTargetAtTime(value: number): void {
        this.value = value
    }
}

export class FakeGainNode {
    readonly gain = new FakeAudioParam()
    readonly connections: unknown[] = []
    connect(target: unknown): void {
        this.connections.push(target)
    }
    disconnect(): void {
        this.connections.length = 0
    }
}

export class FakeAudioContext {
    static instances: FakeAudioContext[] = []

    state: "suspended" | "running" | "closed" | "interrupted" = "suspended"
    currentTime = 0
    readonly destination = { name: "destination" }
    readonly gains: FakeGainNode[] = []
    readonly routedElements: unknown[] = []
    resumeCalls = 0
    suspendCalls = 0
    resumeBehavior: "resolve" | "reject" | "interrupted" = "resolve"
    private listeners = new Set<() => void>()

    constructor() {
        FakeAudioContext.instances.push(this)
    }

    createGain(): FakeGainNode {
        const node = new FakeGainNode()
        this.gains.push(node)
        return node
    }

    createMediaElementSource(element: unknown): FakeGainNode {
        this.routedElements.push(element)
        return new FakeGainNode()
    }

    resume(): Promise<void> {
        this.resumeCalls += 1
        if (this.resumeBehavior === "reject") return Promise.reject(new Error("resume blocked"))
        this.setState(this.resumeBehavior === "interrupted" ? "interrupted" : "running")
        return Promise.resolve()
    }

    suspend(): Promise<void> {
        this.suspendCalls += 1
        this.setState("suspended")
        return Promise.resolve()
    }

    setState(state: FakeAudioContext["state"]): void {
        if (state === this.state) return
        this.state = state
        for (const listener of [...this.listeners]) listener()
    }

    close(): Promise<void> {
        this.state = "closed"
        return Promise.resolve()
    }

    addEventListener(_type: string, listener: () => void): void {
        this.listeners.add(listener)
    }

    removeEventListener(_type: string, listener: () => void): void {
        this.listeners.delete(listener)
    }

    /** The layer buses: the first gains created, each connected to the destination. */
    buses(): FakeGainNode[] {
        return this.gains.filter((node) => node.connections.includes(this.destination))
    }
}

export const flushMicrotasks = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
}

let visibility: DocumentVisibilityState = "visible"

/** Make `document.visibilityState` controllable and announce the change. */
export function setVisibility(state: DocumentVisibilityState): void {
    visibility = state
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibility,
    })
    document.dispatchEvent(new Event("visibilitychange"))
}

export function setUserActivation(active: boolean): void {
    Object.defineProperty(navigator, "userActivation", {
        configurable: true,
        value: { isActive: active, hasBeenActive: active },
    })
}

export function setOnline(online: boolean): void {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
    window.dispatchEvent(new Event(online ? "online" : "offline"))
}
