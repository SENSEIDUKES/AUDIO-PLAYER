/** Session-only reader policies. Nothing in this file is persisted. */
export interface ReaderMixerSleepTimerChoice {
    id: string
    label: string
    kind: "off" | "duration" | "chapter-end"
    /** Positive wall-clock duration, required for `duration`. */
    durationMs?: number
}

export interface ReaderMixerSleepTimerState {
    readonly status: "off" | "running" | "fired"
    readonly choiceId: string | null
    readonly endsAt: number | null
    readonly remainingMs: number | null
}

export interface ReaderMixerSleepEvent {
    readonly choiceId: string
    readonly firedAt: number
}

export const READER_MIXER_SLEEP_TIMERS: readonly ReaderMixerSleepTimerChoice[] = Object.freeze(
    [
        { id: "off", label: "Off", kind: "off" as const },
        ...[15, 30, 45, 60].map((minutes): ReaderMixerSleepTimerChoice => ({
            id: `${minutes}-minutes`,
            label: `${minutes} minutes`,
            kind: "duration",
            durationMs: minutes * 60000,
        })),
        { id: "chapter-end", label: "End of chapter", kind: "chapter-end" as const },
    ].map((choice) => Object.freeze(choice))
)

const ACTIVITY_EVENTS = [
    "scroll",
    "wheel",
    "touchstart",
    "touchmove",
    "pointerdown",
    "pointermove",
    "keydown",
] as const
const OFF: ReaderMixerSleepTimerState = Object.freeze({
    status: "off",
    choiceId: null,
    endsAt: null,
    remainingMs: null,
})

/** Wall-clock scheduling, activity leases and sleep latching, owned by one mixer. */
export class ReaderMixerSession {
    readonly choices: readonly ReaderMixerSleepTimerChoice[]
    sleep: ReaderMixerSleepTimerState = OFF
    idle = false
    private active = false
    private hidden = false
    private lastActivity = Date.now()
    private voicePlaying = false
    private readonly holders = new Set<object>()
    private timer: ReturnType<typeof setTimeout> | null = null
    private readonly cleanups: Array<() => void> = []
    private disposed = false

    constructor(
        private readonly options: {
            choices?: readonly ReaderMixerSleepTimerChoice[]
            idleTimeoutMs: number | null
            onChange: () => void
            onSleep: (event: ReaderMixerSleepEvent) => void
            onResume: () => void
            onIdle: (idle: boolean) => void
        }
    ) {
        this.choices = Object.freeze(
            (options.choices ?? READER_MIXER_SLEEP_TIMERS)
                .filter(
                    (choice) =>
                        choice.kind !== "duration" ||
                        (Number.isFinite(choice.durationMs) && choice.durationMs! > 0)
                )
                .map((choice) => Object.freeze({ ...choice }))
        )
        if (typeof document !== "undefined") {
            const activity = () => this.activity()
            for (const type of ACTIVITY_EVENTS) {
                document.addEventListener(type, activity, { capture: true, passive: true })
            }
            this.cleanups.push(() => {
                for (const type of ACTIVITY_EVENTS)
                    document.removeEventListener(type, activity, true)
            })
        }
    }

    start(): void {
        if (this.disposed || this.active) return
        this.active = true
        this.lastActivity = Date.now()
        this.check()
    }

    setTimer(id: string): void {
        if (this.disposed) return
        const choice = this.choices.find((candidate) => candidate.id === id)
        if (!choice) return
        const wasStopped = this.sleep.status === "fired"
        const endsAt = choice.kind === "duration" ? Date.now() + choice.durationMs! : null
        this.sleep =
            choice.kind === "off"
                ? OFF
                : Object.freeze({
                      status: "running",
                      choiceId: id,
                      endsAt,
                      remainingMs: choice.durationMs ?? null,
                  })
        if (wasStopped) {
            this.lastActivity = Date.now()
            this.idle = false
            this.options.onResume()
        }
        this.options.onChange()
        this.check()
    }

    cancelTimer(): void {
        if (this.sleep.status !== "running") return
        this.sleep = OFF
        this.options.onChange()
        this.check()
    }

    chapterEnd(): void {
        if (this.sleep.status !== "running") return
        if (
            this.choices.find((choice) => choice.id === this.sleep.choiceId)?.kind === "chapter-end"
        )
            this.fire()
    }

    /** Only an explicit control calls this; input events cannot clear the sleep latch. */
    resume(): void {
        if (this.disposed || this.sleep.status !== "fired") return
        this.sleep = OFF
        this.lastActivity = Date.now()
        this.idle = false
        this.options.onResume()
        this.options.onChange()
        this.check()
    }

    setHidden(hidden: boolean): void {
        this.hidden = hidden
        this.check()
    }

    setVoicePlaying(playing: boolean): void {
        if (this.disposed || this.voicePlaying === playing) return
        this.voicePlaying = playing
        this.lastActivity = Date.now()
        if (playing && this.idle && !this.hidden && this.sleep.status !== "fired") this.wake()
        this.check()
    }

    retainActivity(): () => void {
        if (this.disposed) return () => {}
        const holder = {}
        this.holders.add(holder)
        this.activity()
        return () => {
            if (!this.holders.delete(holder) || this.disposed) return
            this.lastActivity = Date.now()
            this.check()
        }
    }

    reset(): void {
        this.clearTimer()
        this.sleep = OFF
        this.idle = false
        this.active = false
        this.voicePlaying = false
        this.options.onChange()
    }

    dispose(): void {
        this.disposed = true
        this.clearTimer()
        for (const cleanup of this.cleanups) cleanup()
        this.holders.clear()
    }

    private activity(): void {
        if (this.disposed || this.hidden) return
        this.lastActivity = Date.now()
        if (this.idle && this.sleep.status !== "fired") this.wake()
        this.check()
    }

    private wake(): void {
        this.idle = false
        this.options.onIdle(false)
        this.options.onChange()
    }

    private fire(): void {
        const choiceId = this.sleep.choiceId
        if (this.disposed || this.sleep.status !== "running" || !choiceId) return
        this.sleep = Object.freeze({
            status: "fired",
            choiceId,
            endsAt: this.sleep.endsAt,
            remainingMs: 0,
        })
        this.options.onSleep(Object.freeze({ choiceId, firedAt: Date.now() }))
        this.options.onChange()
        this.check()
    }

    /** Always reconcile elapsed time before a visibility resume, even if timeouts were throttled. */
    private check(): void {
        this.clearTimer()
        if (this.disposed) return
        const now = Date.now()
        if (this.sleep.status === "running" && this.sleep.endsAt !== null) {
            const remaining = Math.max(0, this.sleep.endsAt - now)
            if (remaining === 0) {
                this.fire()
                return
            }
            this.sleep = Object.freeze({ ...this.sleep, remainingMs: remaining })
            this.options.onChange()
        }
        const timeout = this.options.idleTimeoutMs
        const canIdle =
            this.active &&
            timeout !== null &&
            !this.voicePlaying &&
            this.holders.size === 0 &&
            this.sleep.status !== "fired"
        if (canIdle && !this.idle && now - this.lastActivity >= timeout) {
            this.idle = true
            this.options.onIdle(true)
            this.options.onChange()
        }
        const untilSleep =
            this.sleep.status === "running" && this.sleep.endsAt !== null
                ? this.sleep.endsAt - now
                : Infinity
        const untilIdle =
            canIdle && !this.idle ? Math.max(1, timeout - (now - this.lastActivity)) : Infinity
        const delay = Math.min(untilSleep, untilIdle, untilSleep < Infinity ? 30000 : Infinity)
        if (Number.isFinite(delay)) this.timer = setTimeout(() => this.check(), Math.max(1, delay))
    }

    private clearTimer(): void {
        if (this.timer !== null) clearTimeout(this.timer)
        this.timer = null
    }
}
