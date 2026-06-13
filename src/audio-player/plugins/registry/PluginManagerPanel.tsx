import { usePluginRegistry } from "./usePluginRegistry"
import type { PluginRegistryEntry } from "./usePluginRegistry"

/**
 * A plugin registry UI panel that lets users browse available plugins,
 * install/uninstall them, and toggle active/inactive state.
 *
 * Designed to be rendered inside a `<PluginRegistryProvider>`.
 */
export function PluginManagerPanel() {
    const {
        available,
        installed,
        install,
        uninstall,
        toggleActive,
        activeInstances,
    } = usePluginRegistry()

    const installedIds = new Set(installed.map((r) => r.entry.id))
    const availableButNotInstalled = available.filter(
        (e) => !installedIds.has(e.id)
    )

    return (
        <div className="lab-plugin-manager">
            {/* ── Header / summary ── */}
            <div className="lab-plugin-manager__head">
                <span className="lab-plugin-manager__title">Plugin Registry</span>
                <span className="lab-plugin-manager__badge">
                    {activeInstances.length} / {installed.length} active
                </span>
            </div>

            {/* ── Scroll body so long plugin lists stay reachable ── */}
            <div className="lab-plugin-manager__body">
                {/* ── Available plugins ── */}
                <PluginListSection
                    title="Available"
                    count={availableButNotInstalled.length}
                    emptyLabel="All plugins are installed."
                >
                    {availableButNotInstalled.map((entry) => (
                        <PluginCard
                            key={entry.id}
                            entry={entry}
                            action={
                                <button
                                    type="button"
                                    className="lab-plugin-card__btn lab-plugin-card__btn--install"
                                    onClick={() => install(entry.id)}
                                    aria-label={`Install ${entry.label}`}
                                >
                                    Install
                                </button>
                            }
                        />
                    ))}
                </PluginListSection>

                {/* ── Installed plugins ── */}
                <PluginListSection
                    title="Installed"
                    count={installed.length}
                    emptyLabel="No plugins installed yet."
                >
                    {installed.map((record) => {
                        const active = record.active
                        return (
                            <PluginCard
                                key={record.entry.id}
                                entry={record.entry}
                                active={active}
                                action={
                                    <>
                                        {/* Active/inactive toggle */}
                                        <button
                                            type="button"
                                            className={`lab-plugin-card__btn${
                                                active
                                                    ? " lab-plugin-card__btn--active"
                                                    : " lab-plugin-card__btn--inactive"
                                            }`}
                                            onClick={() => toggleActive(record.entry.id)}
                                            aria-label={`${
                                                active ? "Deactivate" : "Activate"
                                            } ${record.entry.label}`}
                                        >
                                            {active ? "Active" : "Inactive"}
                                        </button>
                                        {/* Uninstall */}
                                        <button
                                            type="button"
                                            className="lab-plugin-card__btn lab-plugin-card__btn--uninstall"
                                            onClick={() => uninstall(record.entry.id)}
                                            aria-label={`Uninstall ${record.entry.label}`}
                                        >
                                            ×
                                        </button>
                                    </>
                                }
                            />
                        )
                    })}
                </PluginListSection>
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Internal sub-components                                            */
/* ------------------------------------------------------------------ */

function PluginListSection({
    title,
    count,
    emptyLabel,
    children,
}: {
    title: string
    count: number
    emptyLabel: string
    children: React.ReactNode
}) {
    return (
        <div className="lab-plugin-manager__section">
            <div className="lab-plugin-manager__section-head">
                <span className="lab-plugin-manager__section-title">
                    {title}
                </span>
                <span className="lab-plugin-manager__section-count">{count}</span>
            </div>
            {count === 0 ? (
                <p className="lab-plugin-manager__empty">{emptyLabel}</p>
            ) : (
                <div className="lab-plugin-manager__list">{children}</div>
            )}
        </div>
    )
}

function PluginCard({
    entry,
    active,
    action,
}: {
    entry: PluginRegistryEntry
    active?: boolean
    action: React.ReactNode
}) {
    return (
        <div
            className={`lab-plugin-card${
                active ? " lab-plugin-card--active" : ""
            }`}
        >
            <div className="lab-plugin-card__body">
                <div className="lab-plugin-card__head">
                    <span className="lab-plugin-card__label">{entry.label}</span>
                    {entry.category && (
                        <span className="lab-plugin-card__category">
                            {entry.category}
                        </span>
                    )}
                </div>
                <p className="lab-plugin-card__desc">{entry.description}</p>
            </div>
            <div className="lab-plugin-card__actions">{action}</div>
        </div>
    )
}