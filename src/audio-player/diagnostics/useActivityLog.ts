/**
 * useActivityLog — React hook for consuming the Activity Log context.
 *
 * Provides the full ActivityLogApi (record, events, clear, exportJson,
 * exportText) to any component in the tree. Throws with a clear error
 * message when used outside an ActivityLogProvider.
 */

import { createContext, useContext } from "react"
import type { ActivityLogApi } from "./activityTypes"

export const ActivityLogContext = createContext<ActivityLogApi | null>(null)

/**
 * Read the Activity Log from context. Throws if used outside an
 * ActivityLogProvider.
 */
export function useOptionalActivityLog(): ActivityLogApi | null {
    return useContext(ActivityLogContext)
}

export function useActivityLog(): ActivityLogApi {
    const ctx = useOptionalActivityLog()
    if (!ctx) {
        throw new Error(
            "useActivityLog must be used within an <ActivityLogProvider>"
        )
    }
    return ctx
}