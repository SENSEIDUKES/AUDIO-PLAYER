import { AudioPlayerPlugin, PluginPlayerContext } from './PluginInterface';
import { PluginManager, PluginManagerOptions } from './PluginManager';
/** React bridge that keeps a PluginManager stable while plugin arrays change. */
export declare function usePluginManager(plugins: readonly AudioPlayerPlugin[], context: PluginPlayerContext, options?: PluginManagerOptions): PluginManager;
//# sourceMappingURL=usePluginManager.d.ts.map