import { createContext, useContext, useSyncExternalStore } from "react"
import type { ActivityLogApi } from "./activityTypes"

export const ActivityLogContext = createContext<ActivityLogApi | null>(null)

/** Read the Activity Log from context. Throws if used outside an ActivityLogProvider. */
export function useActivityLog(): ActivityLogApi {
    const ctx = useContext(ActivityLogContext)
    if (!ctx) {
        throw new Error("useActivityLog must be used within an <ActivityLogProvider>")
    }
    useSyncExternalStore(ctx.subscribe, () => ctx.events, () => ctx.events)
    return ctx
}
