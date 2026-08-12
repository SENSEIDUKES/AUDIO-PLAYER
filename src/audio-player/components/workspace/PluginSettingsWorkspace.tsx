export interface PluginSettingsWorkspaceProps {
    /** Which plugin's settings to render (e.g. `"waveform"`). Derived from the
     *  route target by the shell. */
    pluginId: string
}

/* Generic plugin-settings workspace. Renders a stub keyed by plugin id; a later
   prompt swaps in per-plugin config panels driven by the plugin registry. */
export function PluginSettingsWorkspace({ pluginId }: PluginSettingsWorkspaceProps) {
    const label = pluginId ? pluginId.charAt(0).toUpperCase() + pluginId.slice(1) : "Plugin"
    return (
        <div className="sap-ctl__workspace-empty">
            <p className="sap-ctl__workspace-lead">{label} settings</p>
            <p className="sap-ctl__workspace-sub">
                Configuration for the {label} plugin will appear here.
            </p>
        </div>
    )
}

export default PluginSettingsWorkspace
