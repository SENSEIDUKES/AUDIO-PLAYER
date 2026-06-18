import { useMemo, useRef } from "react"
import type { ReactNode } from "react"
import type { ActivityLogApi, ActivityLogConfig } from "./activityTypes"
import { createActivityLogStore } from "./activityLogStore"
import { ActivityLogContext } from "./useActivityLog"

export interface ActivityLogProviderProps {
    children: ReactNode
    config?: Partial<ActivityLogConfig>
}

export function ActivityLogProvider({ children, config }: ActivityLogProviderProps) {
    const storeRef = useRef<ActivityLogApi | null>(null)
    if (storeRef.current === null) {
        storeRef.current = createActivityLogStore(config)
    }
    const api = useMemo(() => storeRef.current!, [])
    return <ActivityLogContext.Provider value={api}>{children}</ActivityLogContext.Provider>
}
