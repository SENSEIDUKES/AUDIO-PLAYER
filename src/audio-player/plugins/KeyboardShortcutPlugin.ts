import type {
    AudioPlayerPlugin,
    PluginPlayerContext,
} from "../core/plugins/PluginInterface"
import { KeyboardShortcutPluginConfigSchema, validateConfig } from "./configValidators"

export interface KeyboardShortcutPluginConfig {
    name?: string
    /** Attach to the player root by default; use document for global sessions. */
    scope?: "root" | "document"
    seekSeconds?: number
    enableJKL?: boolean
    enablePlaylistKeys?: boolean
}

/** Space/arrow keyboard controls implemented as a swappable plugin. */
export class KeyboardShortcutPlugin implements AudioPlayerPlugin {
    readonly name: string
    readonly handlesKeyboardShortcuts = true
    private readonly scope: "root" | "document"
    private readonly seekSeconds: number
    private readonly enableJKL: boolean
    private readonly enablePlaylistKeys: boolean
    private target: HTMLElement | Document | null = null
    private context: PluginPlayerContext | null = null

    constructor(config: KeyboardShortcutPluginConfig = {}) {
        const valid = validateConfig(KeyboardShortcutPluginConfigSchema, config, "keyboard-shortcuts")
        this.name = valid.name
        this.scope = valid.scope as "root" | "document"
        this.seekSeconds = valid.seekSeconds
        this.enableJKL = valid.enableJKL
        this.enablePlaylistKeys = valid.enablePlaylistKeys
    }

    init(playerInstance: PluginPlayerContext) {
        this.context = playerInstance
        this.target =
            this.scope === "document"
                ? typeof document === "undefined"
                    ? null
                    : document
                : playerInstance.getRootElement()
        this.target?.addEventListener("keydown", this.handleKeyDown)
    }

    destroy() {
        this.target?.removeEventListener("keydown", this.handleKeyDown)
        this.target = null
        this.context = null
    }

    private handleKeyDown = (nativeEvent: Event) => {
        const event = nativeEvent as KeyboardEvent
        if (!this.context || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
            return
        }

        const target = event.target as HTMLElement | null
        const onInteractive = !!target?.closest(
            "button, a, input, textarea, select, [role='slider'], [contenteditable='true']"
        )
        if (onInteractive) return

        const engine = this.context.getEngine()
        const key = event.key.toLowerCase()
        let handled = true

        if (event.key === " " || event.key === "Spacebar" || (this.enableJKL && key === "k")) {
            engine.toggle()
        } else if (event.key === "ArrowLeft" || (this.enableJKL && key === "j")) {
            engine.seekBy(-this.seekSeconds)
        } else if (event.key === "ArrowRight" || (this.enableJKL && key === "l")) {
            engine.seekBy(this.seekSeconds)
        } else if (this.enablePlaylistKeys && key === "n" && this.context.next) {
            this.context.next()
        } else if (this.enablePlaylistKeys && key === "p" && this.context.previous) {
            this.context.previous()
        } else {
            handled = false
        }

        if (handled) event.preventDefault()
    }
}

export function createKeyboardShortcutPlugin(config?: KeyboardShortcutPluginConfig) {
    return new KeyboardShortcutPlugin(config)
}
