/**
 * ActivityLogWorkspace — the workspace surface that wraps the ActivityLogPanel
 * for the SAP Controller shell.
 *
 * This is the route destination for "diagnostics:activity-log". It provides
 * a scroll-ready container and the panel itself.
 */

import { ActivityLogPanel } from "./ActivityLogPanel"

export function ActivityLogWorkspace() {
    return <ActivityLogPanel />
}

export default ActivityLogWorkspace