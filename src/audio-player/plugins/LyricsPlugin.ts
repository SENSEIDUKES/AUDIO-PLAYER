import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import type { Track } from "../types"
import { LyricsPluginConfigSchema, validateConfig } from "./configValidators"

export interface TimedLyricLine {
    time: number
    text: string
}

export interface LyricsPluginConfig {
    name?: string
    lyrics?: string
    lines?: TimedLyricLine[]
    onLineChange?: (line: TimedLyricLine | null, index: number, track: Track | null) => void
    target?: HTMLElement | (() => HTMLElement | null)
}

/** Syncs LRC-style lyrics with playback and optionally writes the active line to a DOM node. */
export class LyricsPlugin implements AudioPlayerPlugin {
    readonly name: string
    private readonly configuredLyrics?: string
    private readonly configuredLines?: TimedLyricLine[]
    private readonly onLineChangeCallback?: LyricsPluginConfig["onLineChange"]
    private readonly target?: LyricsPluginConfig["target"]
    private context: PluginPlayerContext | null = null
    private lines: TimedLyricLine[] = []
    private activeIndex = -1

    constructor(config: LyricsPluginConfig = {}) {
        const valid = validateConfig(LyricsPluginConfigSchema, config, "lyrics")
        this.name = valid.name
        this.configuredLyrics = valid.lyrics
        this.configuredLines = valid.lines
        this.onLineChangeCallback = valid.onLineChange as LyricsPluginConfig["onLineChange"]
        this.target = valid.target as LyricsPluginConfig["target"]
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
        this.loadLyrics(playerInstance.getCurrentTrack())
    }

    destroy() {
        this.context = null
        this.lines = []
        this.activeIndex = -1
        this.writeTarget("")
    }

    onTrackLoad = (track: Track | null) => {
        this.loadLyrics(track)
    }

    onTimeUpdate = (position: number) => {
        if (!this.context || this.lines.length === 0) return
        const engine = this.context.getEngine()
        const explicitTiming = this.lines.some((line) => line.time > 0)
        const index = explicitTiming
            ? this.findTimedLine(position)
            : this.findApproximateLine(position, engine.duration)
        if (index === this.activeIndex) return
        this.activeIndex = index
        const line = index >= 0 ? this.lines[index] : null
        this.writeTarget(line?.text ?? "")
        this.onLineChangeCallback?.(line, index, this.context.getCurrentTrack())
    }

    private loadLyrics(track: Track | null) {
        const source = this.configuredLines
            ? this.configuredLines
            : parseLyrics(this.configuredLyrics ?? track?.lyrics ?? "")
        this.lines = source
        this.activeIndex = -1
        this.writeTarget("")
    }

    private findTimedLine(position: number) {
        let active = -1
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lines[i].time <= position) active = i
            else break
        }
        return active
    }

    private findApproximateLine(position: number, duration: number) {
        if (duration <= 0) return -1
        const ratio = Math.max(0, Math.min(0.999, position / duration))
        return Math.floor(ratio * this.lines.length)
    }

    private writeTarget(text: string) {
        const target =
            typeof this.target === "function" ? this.target() : this.target ?? null
        if (target) target.textContent = text
    }
}

function parseLyrics(lyrics: string): TimedLyricLine[] {
    const lines = lyrics
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    const parsed: TimedLyricLine[] = []
    const lrcPattern = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/

    for (const line of lines) {
        const match = line.match(lrcPattern)
        if (!match) {
            parsed.push({ time: 0, text: line })
            continue
        }
        const minutes = Number(match[1])
        const seconds = Number(match[2])
        const fraction = match[3] ? Number(`0.${match[3]}`) : 0
        parsed.push({ time: minutes * 60 + seconds + fraction, text: match[4] })
    }

    return parsed.sort((a, b) => a.time - b.time)
}

export function createLyricsPlugin(config?: LyricsPluginConfig) {
    return new LyricsPlugin(config)
}
