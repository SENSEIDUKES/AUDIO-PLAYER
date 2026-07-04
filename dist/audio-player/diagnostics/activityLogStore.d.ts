import { ActivityLogApi, ActivityLogConfig } from './activityTypes';
/** Create a standalone activity log store. Callers can create multiple stores
 *  (e.g. one for a session, one for a plugin) or share a single global one. */
export declare function createActivityLogStore(config?: Partial<ActivityLogConfig>): ActivityLogApi;
//# sourceMappingURL=activityLogStore.d.ts.map