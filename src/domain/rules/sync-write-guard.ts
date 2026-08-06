/**
 * sync-write-guard.ts — Re-entrance Guard for Bidirectional Sync
 *
 * Prevents feedback loops between file-watcher and plan-backlog-sync.
 *
 * When syncPlanToBacklog() or syncBacklogToPlan() writes a file
 * programmatically, the file-watcher will detect the change and fire
 * an event. Without a guard, this creates an infinite loop:
 *   BACKLOG.md write → plan.md write → BACKLOG.md write → ...
 *
 * Usage:
 *   withSyncWriteGuard(() => writeFileSync(...))
 *   if (isSyncWriteInProgress()) return; // inside event handlers
 */

let writingDepth = 0;

/**
 * Execute a sync write operation with the guard active.
 * Any file-watcher events fired during this window will be ignored
 * by callers that check `isSyncWriteInProgress()`.
 */
export function withSyncWriteGuard<T>(fn: () => T): T {
  writingDepth++;
  try {
    return fn();
  } finally {
    writingDepth--;
  }
}

/**
 * Returns true when a programmatic sync write is in progress.
 * Event handlers should bail out early when this is true.
 */
export function isSyncWriteInProgress(): boolean {
  return writingDepth > 0;
}
