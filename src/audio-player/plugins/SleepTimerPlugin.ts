import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import { SleepTimerPluginConfigSchema, validateConfig } from "./configValidators"

export type SleepTimerPreset = "off" | "15m" | "30m" | "45m" | "60m" | "track-end"

export interface SleepTimerState {
    preset: SleepTimerPreset
    deadlineMs: number | null
    remainingMs: number | null
}

export interface SleepTimerPluginConfig {
    name?: string
    label?: string
    renderUi?: boolean
    target?: HTMLElement | (() => HTMLElement | null) | null
    now?: () => number
}

const PRESET_DURATIONS_MS: Partial<Record<SleepTimerPreset, number>> = {
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "45m": 45 * 60 * 1000,
    "60m": 60 * 60 * 1000,
}

const OPTIONS: Array<{ value: SleepTimerPreset; label: string }> = [
    { value: "off", label: "Sleep timer" },
    { value: "15m", label: "15 min" },
    { value: "30m", label: "30 min" },
    { value: "45m", label: "45 min" },
    { value: "60m", label: "1 hr" },
    { value: "track-end", label: "Until end of track" },
]

/** Adds a scoped sleep-timer dropdown and pauses playback when the timer expires. */
export class SleepTimerPlugin implements AudioPlayerPlugin {
    readonly name: string
    private readonly label: string
    private readonly renderUi: boolean
    private readonly target?: HTMLElement | (() => HTMLElement | null) | null
    private readonly now: () => number
    private context: PluginPlayerContext | null = null
    private preset: SleepTimerPreset = "off"
    private deadlineMs: number | null = null
    private timeoutId: ReturnType<typeof setTimeout> | null = null
    private container: HTMLElement | null = null
    private select: HTMLSelectElement | null = null

    constructor(config: SleepTimerPluginConfig = {}) {
        const valid = validateConfig(SleepTimerPluginConfigSchema, config, "sleep-timer")
        this.name = valid.name
        this.label = valid.label
        this.renderUi = valid.renderUi
        this.target = valid.target as HTMLElement | (() => HTMLElement | null) | null
        this.now = (valid.now as (() => number)) ?? (() => Date.now())
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
        this.mountUi()
    }

    destroy() {
        this.clearCountdown()
        this.unmountUi()
        this.context = null
        this.preset = "off"
        this.deadlineMs = null
    }

    setTimer(preset: SleepTimerPreset) {
        this.clearCountdown()
        this.preset = preset
        this.deadlineMs = null

        const durationMs = PRESET_DURATIONS_MS[preset]
        if (durationMs !== undefined) {
            this.deadlineMs = this.now() + durationMs
            this.timeoutId = setTimeout(this.expire, durationMs)
        }

        this.syncSelect()
    }

    getActiveTimer(): SleepTimerState {
        const remainingMs =
            this.deadlineMs === null
                ? null
                : Math.max(0, this.deadlineMs - this.now())
        return {
            preset: this.preset,
            deadlineMs: this.deadlineMs,
            remainingMs,
        }
    }

    onTrackEnded = (_track: Track | null) => {
        if (this.preset !== "track-end") return
        this.pauseAndReset()
        return true
    }

    private expire = () => {
        if (this.deadlineMs !== null && this.now() < this.deadlineMs) {
            this.timeoutId = setTimeout(this.expire, this.deadlineMs - this.now())
            return
        }
        this.pauseAndReset()
    }

    private pauseAndReset() {
        this.context?.getEngine().pause()
        this.clearCountdown()
        this.preset = "off"
        this.deadlineMs = null
        this.syncSelect()
    }

    private clearCountdown() {
        if (this.timeoutId === null) return
        clearTimeout(this.timeoutId)
        this.timeoutId = null
    }

    private mountUi() {
        if (!this.renderUi || typeof document === "undefined") return
        const target = this.resolveTarget()
        if (!target) return

        const container = document.createElement("label")
        container.className = "sap-sleep-timer"

        const label = document.createElement("span")
        label.className = "sap-sleep-timer__label"
        label.textContent = this.label

        const select = document.createElement("select")
        select.className = "sap-sleep-timer__select"
        select.setAttribute("aria-label", "Sleep timer")

        for (const optionConfig of OPTIONS) {
            const option = document.createElement("option")
            option.value = optionConfig.value
            option.textContent = optionConfig.label
            select.appendChild(option)
        }

        select.addEventListener("change", this.handleSelectChange)
        container.append(label, select)
        target.appendChild(container)
        this.container = container
        this.select = select
        this.syncSelect()
    }

    private unmountUi() {
        this.select?.removeEventListener("change", this.handleSelectChange)
        this.container?.remove()
        this.container = null
        this.select = null
    }

    private resolveTarget() {
        if (typeof this.target === "function") return this.target()
        return this.target ?? this.context?.getRootElement() ?? null
    }

    private syncSelect() {
        if (this.select) this.select.value = this.preset
    }

    private handleSelectChange = (event: Event) => {
        const select = event.currentTarget as HTMLSelectElement | null
        this.setTimer((select?.value ?? "off") as SleepTimerPreset)
    }
}

export function createSleepTimerPlugin(config?: SleepTimerPluginConfig) {
    return new SleepTimerPlugin(config)
}
