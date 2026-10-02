/** Page-wide context leases keep narration, sprites and reader buses on one render thread. */
export interface AudioContextLease {
    readonly context: AudioContext
    setActive(active: boolean, fromActivation?: boolean): Promise<void>
    release(): void
}

type SharedContext = {
    context: AudioContext
    ctor: typeof AudioContext
    owners: Set<object>
    active: Set<object>
    changing: boolean
    token: number
    removeListener: () => void
}

let shared: SharedContext | null = null

function synchronize(record: SharedContext, fromActivation = false): Promise<void> {
    const ctx = record.context
    const running = record.active.size > 0
    if (ctx.state === "closed" || !record.owners.size) return Promise.resolve()
    if (record.changing && !(fromActivation && running)) return Promise.resolve()
    if (
        ctx.state === (running ? "running" : "suspended") &&
        !(fromActivation && record.changing && running)
    )
        return Promise.resolve()
    record.changing = true
    const token = ++record.token
    let operation: Promise<void>
    try {
        operation = running ? ctx.resume() : ctx.suspend()
    } catch (error) {
        if (token === record.token) record.changing = false
        return Promise.reject(error)
    }
    void Promise.resolve(operation)
        .catch(() => {})
        .then(() => {
            if (token !== record.token) {
                void synchronize(record).catch(() => {})
                return
            }
            record.changing = false
            if (running !== record.active.size > 0) void synchronize(record).catch(() => {})
        })
    return operation
}

/** Retain a context until the last consumer releases it; suspend only when every consumer is idle. */
export function retainAudioContext(ctor: typeof AudioContext): AudioContextLease {
    if (!shared || shared.context.state === "closed" || shared.ctor !== ctor) {
        const context = new ctor()
        const record: SharedContext = {
            context,
            ctor,
            owners: new Set(),
            active: new Set(),
            changing: false,
            token: 0,
            removeListener: () => {},
        }
        const listener = () => {
            void synchronize(record).catch(() => {})
        }
        context.addEventListener?.("statechange", listener)
        record.removeListener = () => context.removeEventListener?.("statechange", listener)
        shared = record
    }
    const record = shared
    const owner = {}
    record.owners.add(owner)
    void synchronize(record).catch(() => {})
    let released = false
    return {
        context: record.context,
        setActive: (active, fromActivation = false) => {
            if (released) return Promise.resolve()
            if (active) record.active.add(owner)
            else record.active.delete(owner)
            return synchronize(record, fromActivation)
        },
        release: () => {
            if (released) return
            released = true
            record.active.delete(owner)
            record.owners.delete(owner)
            if (record.owners.size) {
                void synchronize(record).catch(() => {})
                return
            }
            record.removeListener()
            if (shared === record) shared = null
            try {
                void Promise.resolve(record.context.close()).catch(() => {})
            } catch {
                /* Best effort. */
            }
        },
    }
}
