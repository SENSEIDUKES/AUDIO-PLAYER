import { ActivityLogApi } from './activityTypes';
export declare const ActivityLogContext: import('react').Context<ActivityLogApi | null>;
/**
 * Read the Activity Log from context. Throws if used outside an
 * ActivityLogProvider.
 */
export declare function useOptionalActivityLog(): ActivityLogApi | null;
export declare function useActivityLog(): ActivityLogApi;
//# sourceMappingURL=useActivityLog.d.ts.map