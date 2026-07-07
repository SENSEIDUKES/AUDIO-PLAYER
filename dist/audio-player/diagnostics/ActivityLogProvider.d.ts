import { ReactNode } from 'react';
import { ActivityLogConfig } from './activityTypes';
export interface ActivityLogProviderProps {
    children: ReactNode;
    /** Optional configuration overrides. */
    config?: Partial<ActivityLogConfig>;
}
export declare function ActivityLogProvider({ children, config, }: ActivityLogProviderProps): import("react").JSX.Element;
//# sourceMappingURL=ActivityLogProvider.d.ts.map