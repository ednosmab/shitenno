/**
 * doc-sync-hook.ts — Documentation Sync Hook
 *
 * Reusable hook that triggers documentation sync based on file changes.
 * Can be called from file-watcher, git hooks, or event bus subscribers.
 *
 * PRINCIPLE: Documentation sync should be automatic but unobtrusive.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SHITENNO_DIR_NAME } from "./constants.js";
import { getEventBus } from "./event-bus.js";
import { logger } from "./logger.js";
import type { DocsSyncTriggeredPayload } from "./event-payloads.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocSyncHookOptions {
  /** Project root directory */
  projectRoot: string;
  /** Enable automatic sync on file changes (default: true) */
  enableAutoSync?: boolean;
  /** Minimum significance score to trigger sync (default: 0.3) */
  minSignificance?: number;
  /** Sync command to execute (default: 'pnpm run sync:docs') */
  syncCommand?: string;
}

export interface DocSyncResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MIN_SIGNIFICANCE = 0.3;
const DEFAULT_SYNC_COMMAND = "pnpm run sync:docs";

// ── Hook ─────────────────────────────────────────────────────────────────────

let isSyncing = false;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL_MS = 5000; // Minimum 5 seconds between syncs

/**
 * Execute documentation sync command.
 * Respects minimum interval to prevent rapid-fire syncs.
 */
function checkSyncPrerequisites(projectRoot: string): DocSyncResult | null {
  if (isSyncing) {
    logger.debug("doc-sync-hook", "Sync already in progress, skipping");
    return { success: true, output: "skipped: already syncing", exitCode: 0, duration: 0 };
  }

  if (Date.now() - lastSyncTime < MIN_SYNC_INTERVAL_MS) {
    logger.debug("doc-sync-hook", "Minimum interval not reached, skipping");
    return { success: true, output: "skipped: minimum interval", exitCode: 0, duration: 0 };
  }

  const syncScript = resolve(projectRoot, SHITENNO_DIR_NAME, "scripts", "sync-docs.ts");
  if (!existsSync(syncScript)) {
    logger.warn("doc-sync-hook", "sync-docs.ts not found, skipping");
    return { success: false, output: "sync-docs.ts not found", exitCode: 1, duration: 0 };
  }

  return null;
}

function buildCommandWithFlags(command: string, outputLevel: "silent" | "minimal" | "verbose"): string {
  if (outputLevel === "silent" || outputLevel === "minimal") {
    return command + " --quiet";
  }
  return command;
}

function executeSyncExecution(
  projectRoot: string,
  fullCommand: string,
  outputLevel: "silent" | "minimal" | "verbose",
  startTime: number
): DocSyncResult {
  try {
    const output = execSync(fullCommand, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    lastSyncTime = Date.now();
    const duration = Date.now() - startTime;

    if (outputLevel === "verbose") {
      logger.info("doc-sync-hook", `Sync completed in ${duration}ms`);
    }

    return { success: true, output, exitCode: 0, duration };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const err = error as { status?: number; message?: string };
    logger.error("doc-sync-hook", `Sync failed: ${err.message}`);
    return {
      success: false,
      output: err.message || "unknown error",
      exitCode: err.status || 1,
      duration,
    };
  } finally {
    isSyncing = false;
  }
}

export function runDocSync(
  projectRoot: string,
  command: string = DEFAULT_SYNC_COMMAND,
  outputLevel: "silent" | "minimal" | "verbose" = "silent"
): DocSyncResult {
  const skipped = checkSyncPrerequisites(projectRoot);
  if (skipped) return skipped;

  isSyncing = true;
  const startTime = Date.now();
  const fullCommand = buildCommandWithFlags(command, outputLevel);
  return executeSyncExecution(projectRoot, fullCommand, outputLevel, startTime);
}

/**
 * Subscribe to docs.sync.triggered events and run sync.
 * This is the main integration point with the event bus.
 */
export function registerDocSyncHook(
  options: DocSyncHookOptions
): () => void {
  const {
    projectRoot,
    enableAutoSync = true,
    minSignificance = DEFAULT_MIN_SIGNIFICANCE,
    syncCommand = DEFAULT_SYNC_COMMAND,
  } = options;

  if (!enableAutoSync) {
    logger.info("doc-sync-hook", "Auto-sync disabled");
    return () => {};
  }

  const bus = getEventBus();

  const unsubscribe = bus.subscribe(
    "docs.sync.triggered",
    (payload: Record<string, unknown>) => {
      const docSyncPayload = payload as unknown as DocsSyncTriggeredPayload;

      // Check significance threshold
      if (docSyncPayload.significance < minSignificance) {
        logger.debug(
          "doc-sync-hook",
          `Significance ${docSyncPayload.significance.toFixed(2)} below threshold ${minSignificance}, skipping`
        );
        return;
      }

      // Run sync with appropriate output level
      runDocSync(projectRoot, syncCommand, docSyncPayload.outputLevel);
    }
  );

  logger.info(
    "doc-sync-hook",
    `Registered (minSignificance: ${minSignificance})`
  );

  return unsubscribe;
}

/**
 * Run sync manually (for git hooks or CLI commands).
 */
export function triggerManualSync(
  projectRoot: string,
  outputLevel: "silent" | "minimal" | "verbose" = "verbose"
): DocSyncResult {
  return runDocSync(projectRoot, DEFAULT_SYNC_COMMAND, outputLevel);
}
