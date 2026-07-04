import { ReactNode } from 'react';
import { AudioPlayerPlugin } from '../../core/plugins/PluginInterface';
/** Describes a plugin that is *available* to install. */
export interface PluginRegistryEntry {
    /** Unique stable identifier (used as the plugin instance name too). */
    id: string;
    /** Human-readable label shown in the UI. */
    label: string;
    /** Short description. */
    description: string;
    /**
     * Factory that returns a fresh plugin instance.
     * The registry calls this when the user installs the plugin.
     * The caller may merge default config before calling the factory.
     */
    factory: () => AudioPlayerPlugin;
    /** Whether this plugin is enabled by default after install. */
    defaultActive: boolean;
    /**
     * Optional hint for the UI.
     * e.g. "lifecycle", "analytics", "ui", "playback"
     */
    category?: string;
}
/** Tracks a plugin *once installed* by the user. */
export interface InstalledPluginRecord {
    entry: PluginRegistryEntry;
    active: boolean;
}
/** Snapshot of registry state for consumers that need to rebuild instances. */
export interface PluginRegistrySnapshot {
    available: readonly PluginRegistryEntry[];
    installed: readonly InstalledPluginRecord[];
    install: (id: string) => void;
    uninstall: (id: string) => void;
    activate: (id: string) => void;
    deactivate: (id: string) => void;
    toggleActive: (id: string) => void;
    /** Materialised active plugin instances — pass this as `plugins` to AudioPlayer. */
    activeInstances: readonly AudioPlayerPlugin[];
}
export interface PluginRegistryProviderProps {
    children: ReactNode;
}
/**
 * Wraps children with a plugin registry context.
 * Tracks which plugins are installed and which are active.
 * Exposes `activeInstances` – a stable array of `AudioPlayerPlugin` objects
 * that can be passed directly into `<AudioPlayer plugins={...} />`.
 *
 * The provider only materialises instances for **active** plugins, so an
 * installed-but-inactive plugin does not consume slots in the player.
 */
export declare function PluginRegistryProvider({ children, }: PluginRegistryProviderProps): import("react").JSX.Element;
/**
 * Access the plugin registry from any component within a
 * `<PluginRegistryProvider>`. Returns the full registry snapshot including
 * `activeInstances` which can be spread into an `<AudioPlayer>`.
 */
export declare function usePluginRegistry(): PluginRegistrySnapshot;
/**
 * Returns the current `activeInstances` array from the registry.
 * This is a thin wrapper around `usePluginRegistry()` for convenience.
 */
export declare function useActivePluginInstances(): readonly AudioPlayerPlugin[];
//# sourceMappingURL=usePluginRegistry.d.ts.map