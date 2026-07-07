import { AudioPlayerPlugin, PluginPlayerContext } from '../core/plugins/PluginInterface';
export interface KeyboardShortcutPluginConfig {
    name?: string;
    /** Attach to the player root by default; use document for global sessions. */
    scope?: "root" | "document";
    seekSeconds?: number;
    enableJKL?: boolean;
    enablePlaylistKeys?: boolean;
}
/** Space/arrow keyboard controls implemented as a swappable plugin. */
export declare class KeyboardShortcutPlugin implements AudioPlayerPlugin {
    readonly name: string;
    readonly handlesKeyboardShortcuts = true;
    private readonly scope;
    private readonly seekSeconds;
    private readonly enableJKL;
    private readonly enablePlaylistKeys;
    private target;
    private context;
    constructor(config?: KeyboardShortcutPluginConfig);
    init(playerInstance: PluginPlayerContext): void;
    destroy(): void;
    private handleKeyDown;
}
export declare function createKeyboardShortcutPlugin(config?: KeyboardShortcutPluginConfig): KeyboardShortcutPlugin;
//# sourceMappingURL=KeyboardShortcutPlugin.d.ts.map