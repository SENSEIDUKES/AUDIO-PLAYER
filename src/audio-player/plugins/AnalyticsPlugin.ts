import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import { AnalyticsPluginConfigSchema, validateConfig } from "./configValidators"

export type AnalyticsEventType =
    | "track_load"
    | "play"
    | "pause"
    | "stop"
    | "seek"
    | "time_update"
    | "track_ended"

export interface AnalyticsEventPayload {
    type: AnalyticsEventType
    track: Track | null
    sourceKey: string
    position: number
    duration: number
    timestamp: number
    plugin: string
}

export interface AnalyticsPluginConfig {
    name?: string
    endpoint?: string
    send?: (event: AnalyticsEventPayload) => void | Promise<void>
    includeTimeUpdates?: boolean
    timeUpdateIntervalSeconds?: number
}

/** Small analytics adapter. Provide `send` or `endpoint` to emit events. */
export class AnalyticsPlugin implements AudioPlayerPlugin {
    readonly name: string
    private readonly endpoint?: string
    private readonly sendCallback?: (event: AnalyticsEventPayload) => void | Promise<void>
    private readonly includeTimeUpdates: boolean
    private readonly timeUpdateIntervalSeconds: number
    private context: PluginPlayerContext | null = null
    private lastTimeUpdateBucket = -1

    constructor(config: AnalyticsPluginConfig = {}) {
        const valid = validateConfig(AnalyticsPluginConfigSchema, config, "analytics")
        this.name = valid.name
        this.endpoint = valid.endpoint
        this.sendCallback = valid.send as AnalyticsPluginConfig["send"]
        this.includeTimeUpdates = valid.includeTimeUpdates
        this.timeUpdateIntervalSeconds = valid.timeUpdateIntervalSeconds
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
    }

    destroy() {
        this.context = null
        this.lastTimeUpdateBucket = -1
    }

    onTrackLoad = (_track: Track | null) => {
        this.lastTimeUpdateBucket = -1
        this.emit("track_load")
    }

    onPlay = () => this.emit("play")
    onPause = () => this.emit("pause")
    onStop = () => this.emit("stop")
    onSeek = (position: number) => this.emit("seek", position)
    onTrackEnded = () => {
        this.emit("track_ended")
    }

    onTimeUpdate = (position: number) => {
        if (!this.includeTimeUpdates) return
        const bucket = Math.floor(position / this.timeUpdateIntervalSeconds)
        if (bucket === this.lastTimeUpdateBucket) return
        this.lastTimeUpdateBucket = bucket
        this.emit("time_update", position)
    }

    private emit(type: AnalyticsEventType, overridePosition?: number) {
        if (!this.context || (!this.sendCallback && !this.endpoint)) return
        const engine = this.context.getEngine()
        const event: AnalyticsEventPayload = {
            type,
            track: this.context.getCurrentTrack(),
            sourceKey: this.context.getSourceKey(),
            position: overridePosition ?? engine.currentTime,
            duration: engine.duration,
            timestamp: Date.now(),
            plugin: this.name,
        }

        if (this.sendCallback) {
            void this.sendCallback(event)
            return
        }

        if (!this.endpoint || typeof window === "undefined") return
        const body = JSON.stringify(event)
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([body], { type: "application/json" })
            if (navigator.sendBeacon(this.endpoint, blob)) return
        }
        void fetch(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
        }).catch(() => {})
    }
}

export function createAnalyticsPlugin(config?: AnalyticsPluginConfig) {
    return new AnalyticsPlugin(config)
}
