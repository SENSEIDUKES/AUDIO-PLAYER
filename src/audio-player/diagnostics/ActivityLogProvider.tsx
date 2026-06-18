/**
 * ActivityLogProvider — React context provider for the Activity Log.
 *
 * Mount this near the root of your player tree to make the Activity Log
 * available through `useActivityLog()`. The provider creates a single store
 * at mount time that lasts the lifetime of the component; it clears on
 * unmount (provider is torn down) but NOT on session reset unless you
 * manually call `clear()`.
 *
 * Usage:
 * ```tsx
 * <ActivityLogProvider>
 *   <AudioSessionProvider>
 *     <App />
 *   </AudioSessionProvider>
 * </ActivityLogProvider>
 * ```
 */

import { useMemo, useRef } from "react"
import type { ReactNode } from "react"
import type { ActivityLogConfig } from "./activityTypes"
import { createActivityLogStore } from "./activityLogStore"
import { ActivityLogContext } from "./useActivityLog"

export interface ActivityLogProviderProps {
    children: ReactNode
    /** Optional configuration overrides. */
    config?: Partial<ActivityLogConfig>
}

export function ActivityLogProvider({
    children,
    config,
}: ActivityLogProviderProps) {
    // Store lives in a ref so it survives re-renders without recreating the
    // buffer. Created once on mount.
    const storeRef = useRef<ReturnType<typeof createActivityLogStore> | null>(
        null
    )
    if (storeRef.current === null) {
        storeRef.current = createActivityLogStore(config)
    }

    // The API object is stable (methods close over the same ref) so we only
    // need to memoize it once. We create it from the ref which is stable.
    const api = useMemo(() => storeRef.current!, [])

    return (
        <ActivityLogContext.Provider value={api}>
            {children}
        </ActivityLogContext.Provider>
    )
}