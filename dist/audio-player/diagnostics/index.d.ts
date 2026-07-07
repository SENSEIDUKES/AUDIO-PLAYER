/**
 * Diagnostics — Activity Log system for recording and viewing lifecycle events.
 *
 * The Activity Log is a bounded, non-blocking event recording system that any
 * component can safely call from anywhere. Events are categorized by area
 * (plugin, player, canvas, agent, playback, session, system) and status
 * (info, warn, error, success).
 *
 * Architecture:
 * - `ActivityLogProvider` — React context provider (mount near root)
 * - `useActivityLog` — React hook to read/write the log
 * - `createActivityLogStore` — standalone store factory (for non-React usage)
 * - `ActivityLogPanel` — settings-panel UI with filters, copy, export, clear
 * - `ActivityLogWorkspace` — workspace surface for the SAP Controller shell
 * - `useActivityLogRecording` — auto-records playback lifecycle events
 */
export { ActivityLogProvider } from './ActivityLogProvider';
export type { ActivityLogProviderProps } from './ActivityLogProvider';
export { useActivityLog } from './useActivityLog';
export { ActivityLogContext } from './useActivityLog';
export { ActivityLogPanel } from './ActivityLogPanel';
export { ActivityLogWorkspace } from './ActivityLogWorkspace';
export { useActivityLogRecording } from './useActivityLogRecording';
export type { UseActivityLogRecordingOptions } from './useActivityLogRecording';
export { createActivityLogStore } from './activityLogStore';
export type { ActivityArea, ActivityStatus, ActivityEvent, ActivityLogEntry, ActivityLogConfig, ActivityLogApi, } from './activityTypes';
export { DEFAULT_ACTIVITY_LOG_CONFIG } from './activityTypes';
//# sourceMappingURL=index.d.ts.map