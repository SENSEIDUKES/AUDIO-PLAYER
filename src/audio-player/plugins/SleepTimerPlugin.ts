import type { AudioPlayerPlugin, PluginPlayerContext } from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import { SleepTimerPluginConfigSchema, validateConfig } from "./configValidators"

export type SleepTimerPreset = "off" | "5m" | "15m" | "30m" | "45m" | "60m" | "120m" | "track-end" | "custom"

export interface SleepTimerState {
    preset: SleepTimerPreset
    deadlineMs: number | null
    remainingMs: number | null
    fadeOut: boolean
    customMinutes: number
}

export interface SleepTimerPluginConfig {
    name?: string
    label?: string
    renderUi?: boolean
    target?: HTMLElement | (() => HTMLElement | null) | null
    now?: () => number
    fadeOut?: boolean
}

const PRESET_DURATIONS_MS: Partial<Record<SleepTimerPreset, number>> = {
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "45m": 45 * 60 * 1000,
    "60m": 60 * 60 * 1000,
    "120m": 120 * 60 * 1000,
}

const OPTIONS: Array<{ value: SleepTimerPreset; label: string }> = [
    { value: "off", label: "Off" },
    { value: "5m", label: "5 min" },
    { value: "15m", label: "15 min" },
    { value: "30m", label: "30 min" },
    { value: "45m", label: "45 min" },
    { value: "60m", label: "1 hour" },
    { value: "120m", label: "2 hours" },
    { value: "track-end", label: "End of track" },
    { value: "custom", label: "Custom..." },
]

const STORAGE_KEY = "sap-sleep-timer-state"

function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    return `${m}:${s.toString().padStart(2, "0")}`
}

export class SleepTimerPlugin implements AudioPlayerPlugin {
    readonly name: string
    private readonly label: string
    private readonly renderUi: boolean
    private readonly target?: HTMLElement | (() => HTMLElement | null) | null
    private readonly now: () => number
    private context: PluginPlayerContext | null = null
    
    private preset: SleepTimerPreset = "off"
    private deadlineMs: number | null = null
    private fadeOut: boolean
    private customMinutes: number = 10
    
    private timeoutId: ReturnType<typeof setTimeout> | null = null
    private uiIntervalId: ReturnType<typeof setInterval> | null = null
    
    // UI elements
    private container: HTMLElement | null = null
    private triggerBtn: HTMLElement | null = null
    private menuContainer: HTMLElement | null = null
    private selectMenu: HTMLSelectElement | null = null
    private customInputContainer: HTMLElement | null = null
    private customInput: HTMLInputElement | null = null
    private fadeCheckbox: HTMLInputElement | null = null
    private countdownDisplay: HTMLElement | null = null

    constructor(config: SleepTimerPluginConfig = {}) {
        const valid = validateConfig(SleepTimerPluginConfigSchema, config, "sleep-timer")
        this.name = valid.name
        this.label = valid.label
        this.renderUi = valid.renderUi
        this.target = valid.target as HTMLElement | (() => HTMLElement | null) | null
        this.now = (valid.now as (() => number)) ?? (() => Date.now())
        this.fadeOut = valid.fadeOut
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
        this.loadState()
        this.mountUi()
    }

    destroy() {
        this.clearCountdown()
        if (this.uiIntervalId) clearInterval(this.uiIntervalId)
        this.unmountUi()
        this.context = null
        this.preset = "off"
        this.deadlineMs = null
    }

    private loadState() {
        if (typeof localStorage === "undefined") return
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<SleepTimerState>
                if (parsed.fadeOut !== undefined) this.fadeOut = parsed.fadeOut
                if (parsed.customMinutes !== undefined) this.customMinutes = parsed.customMinutes
                if (parsed.preset && parsed.preset !== "off") {
                    if (parsed.preset === "track-end") {
                        this.preset = "track-end"
                        this.deadlineMs = null
                    } else if (parsed.deadlineMs && parsed.deadlineMs > this.now()) {
                        this.preset = parsed.preset
                        this.deadlineMs = parsed.deadlineMs
                        this.resumeTimer()
                    }
                }
            }
        } catch (err) {
            console.warn("Failed to load sleep timer state", err)
        }
    }

    private saveState() {
        if (typeof localStorage === "undefined") return
        try {
            const state: SleepTimerState = {
                preset: this.preset,
                deadlineMs: this.deadlineMs,
                remainingMs: this.getActiveTimer().remainingMs,
                fadeOut: this.fadeOut,
                customMinutes: this.customMinutes
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        } catch (err) {
            // ignore
        }
    }

    private resumeTimer() {
        this.clearCountdown()
        if (this.deadlineMs && this.deadlineMs > this.now()) {
            this.timeoutId = setTimeout(this.expire, this.deadlineMs - this.now())
        } else {
            this.pauseAndReset()
        }
    }

    setTimer(preset: SleepTimerPreset, customMins?: number) {
        this.clearCountdown()
        this.preset = preset
        this.deadlineMs = null
        if (customMins !== undefined) this.customMinutes = customMins

        let durationMs = PRESET_DURATIONS_MS[preset]
        if (preset === "custom") {
            durationMs = this.customMinutes * 60 * 1000
        }

        if (durationMs !== undefined && durationMs > 0) {
            this.deadlineMs = this.now() + durationMs
            this.timeoutId = setTimeout(this.expire, durationMs)
        }

        this.saveState()
        this.syncUi()
    }

    setFadeOut(enabled: boolean) {
        this.fadeOut = enabled
        this.saveState()
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
            fadeOut: this.fadeOut,
            customMinutes: this.customMinutes
        }
    }

    onTrackEnded = (_track: Track | null) => {
        if (this.preset !== "track-end") return
        this.doPauseAction()
        return true
    }

    private expire = () => {
        if (this.deadlineMs !== null && this.now() < this.deadlineMs) {
            this.timeoutId = setTimeout(this.expire, this.deadlineMs - this.now())
            return
        }
        
        this.doPauseAction()
    }

    private doPauseAction() {
        if (this.fadeOut) {
            // Fade out over 10 seconds before pausing
            const fadeDuration = 10000
            this.context?.getEngine().fade(0, fadeDuration)
            setTimeout(() => {
                this.pauseAndReset()
            }, fadeDuration)
        } else {
            this.pauseAndReset()
        }
    }

    private pauseAndReset() {
        this.context?.getEngine().pause()
        this.clearCountdown()
        this.preset = "off"
        this.deadlineMs = null
        this.saveState()
        this.syncUi()
    }

    private clearCountdown() {
        if (this.timeoutId === null) return
        clearTimeout(this.timeoutId)
        this.timeoutId = null
    }

    // --- UI Methods ---

    private mountUi() {
        if (!this.renderUi || typeof document === "undefined") return
        const target = this.resolveTarget()
        if (!target) return

        this.container = document.createElement("div")
        this.container.className = "sap-sleep-timer"

        // Trigger button
        this.triggerBtn = document.createElement("button")
        this.triggerBtn.className = "sap-sleep-timer__btn ap-icon-btn"
        this.triggerBtn.setAttribute("aria-label", this.label)
        this.triggerBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
        
        // Active indicator badge
        this.countdownDisplay = document.createElement("div")
        this.countdownDisplay.className = "sap-sleep-timer__badge"
        this.countdownDisplay.style.display = "none"
        this.triggerBtn.appendChild(this.countdownDisplay)

        // Menu popover
        this.menuContainer = document.createElement("div")
        this.menuContainer.className = "sap-sleep-timer__menu ap-glass-surface"
        
        const header = document.createElement("div")
        header.className = "sap-sleep-timer__menu-header"
        header.textContent = "Sleep Timer"
        
        // Select
        this.selectMenu = document.createElement("select")
        this.selectMenu.className = "sap-sleep-timer__select"
        for (const optionConfig of OPTIONS) {
            const option = document.createElement("option")
            option.value = optionConfig.value
            option.textContent = optionConfig.label
            this.selectMenu.appendChild(option)
        }
        
        // Custom input
        this.customInputContainer = document.createElement("div")
        this.customInputContainer.className = "sap-sleep-timer__custom-row"
        this.customInputContainer.style.display = "none"
        
        this.customInput = document.createElement("input")
        this.customInput.type = "number"
        this.customInput.min = "1"
        this.customInput.max = "999"
        this.customInput.className = "sap-sleep-timer__custom-input"
        this.customInput.value = String(this.customMinutes)
        
        const customLabel = document.createElement("span")
        customLabel.textContent = "minutes"
        
        this.customInputContainer.append(this.customInput, customLabel)

        // Fade out toggle
        const fadeRow = document.createElement("label")
        fadeRow.className = "sap-sleep-timer__fade-row"
        
        this.fadeCheckbox = document.createElement("input")
        this.fadeCheckbox.type = "checkbox"
        this.fadeCheckbox.checked = this.fadeOut
        
        const fadeLabel = document.createElement("span")
        fadeLabel.textContent = "Fade out before stopping"
        
        fadeRow.append(this.fadeCheckbox, fadeLabel)

        // Assemble
        this.menuContainer.append(header, this.selectMenu, this.customInputContainer, fadeRow)
        this.container.append(this.triggerBtn, this.menuContainer)
        target.appendChild(this.container)

        // Event listeners
        this.triggerBtn.addEventListener("click", this.handleToggleMenu)
        this.selectMenu.addEventListener("change", this.handleSelectChange)
        this.customInput.addEventListener("change", this.handleCustomChange)
        this.fadeCheckbox.addEventListener("change", this.handleFadeChange)
        document.addEventListener("click", this.handleClickOutside)

        // Sync initial state
        this.syncUi()
        
        // Update countdown every second
        this.uiIntervalId = setInterval(this.updateCountdownDisplay, 1000)
    }

    private unmountUi() {
        this.triggerBtn?.removeEventListener("click", this.handleToggleMenu)
        this.selectMenu?.removeEventListener("change", this.handleSelectChange)
        this.customInput?.removeEventListener("change", this.handleCustomChange)
        this.fadeCheckbox?.removeEventListener("change", this.handleFadeChange)
        document.removeEventListener("click", this.handleClickOutside)
        
        this.container?.remove()
        this.container = null
        this.triggerBtn = null
        this.menuContainer = null
        this.selectMenu = null
        this.customInputContainer = null
        this.customInput = null
        this.fadeCheckbox = null
        this.countdownDisplay = null
    }

    private resolveTarget() {
        if (typeof this.target === "function") return this.target()
        return this.target ?? this.context?.getRootElement() ?? null
    }

    private handleToggleMenu = (e: Event) => {
        e.stopPropagation()
        this.container?.classList.toggle("sap-sleep-timer--open")
    }

    private handleClickOutside = (e: Event) => {
        if (!this.container?.contains(e.target as Node)) {
            this.container?.classList.remove("sap-sleep-timer--open")
        }
    }

    private handleSelectChange = () => {
        const val = (this.selectMenu?.value ?? "off") as SleepTimerPreset
        if (val === "custom") {
            this.customInputContainer!.style.display = "flex"
            this.setTimer("custom", Number(this.customInput?.value || 10))
        } else {
            this.customInputContainer!.style.display = "none"
            this.setTimer(val)
        }
    }

    private handleCustomChange = () => {
        const mins = Number(this.customInput?.value || 10)
        this.customMinutes = Math.max(1, mins)
        this.setTimer("custom", this.customMinutes)
    }
    
    private handleFadeChange = () => {
        this.setFadeOut(this.fadeCheckbox?.checked ?? false)
    }

    private syncUi() {
        if (!this.selectMenu) return
        this.selectMenu.value = this.preset
        if (this.preset === "custom") {
            this.customInputContainer!.style.display = "flex"
            this.customInput!.value = String(this.customMinutes)
        } else {
            this.customInputContainer!.style.display = "none"
        }
        if (this.fadeCheckbox) this.fadeCheckbox.checked = this.fadeOut
        this.updateCountdownDisplay()
    }

    private updateCountdownDisplay = () => {
        if (!this.countdownDisplay || !this.triggerBtn) return
        
        if (this.preset === "off") {
            this.countdownDisplay.style.display = "none"
            this.triggerBtn.classList.remove("sap-sleep-timer__btn--active")
            return
        }

        this.triggerBtn.classList.add("sap-sleep-timer__btn--active")
        
        if (this.preset === "track-end") {
            this.countdownDisplay.style.display = "flex"
            this.countdownDisplay.textContent = "1T" // One track
            return
        }

        const remaining = this.getActiveTimer().remainingMs
        if (remaining !== null && remaining > 0) {
            this.countdownDisplay.style.display = "flex"
            this.countdownDisplay.textContent = formatTime(remaining)
        } else {
            this.countdownDisplay.style.display = "none"
        }
    }
}

export function createSleepTimerPlugin(config?: SleepTimerPluginConfig) {
    return new SleepTimerPlugin(config)
}
