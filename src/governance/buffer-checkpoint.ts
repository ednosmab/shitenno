/**
 * buffer-checkpoint.ts — Context Buffer Checkpoint Mechanism
 *
 * Creates timestamped checkpoints of context_buffer.yaml before pruning.
 * Instead of overwriting, the buffer is checkpointed to a history directory,
 * allowing recovery of previous states and analysis of context evolution.
 *
 * Called BEFORE the existing pruning logic in governance-enforcement-detectors.ts.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of checkpoints to retain (oldest are deleted). */
const MAX_CHECKPOINTS = 50;

/** Directory name for checkpoints. */
const CHECKPOINT_DIR = "checkpoints";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CheckpointResult {
  success: boolean;
  checkpointPath?: string;
  message: string;
  removedCount?: number;
}

// ── Main Function ──────────────────────────────────────────────────────────

/**
 * Create a checkpoint of context_buffer.yaml.
 *
 * Copies the current buffer to a timestamped file in the checkpoints directory.
 * Also cleans up old checkpoints beyond MAX_CHECKPOINTS.
 *
 * @param shitennoDir - Path to shitenno/ directory
 * @returns CheckpointResult with operation status
 */
export function checkpointBuffer(shitennoDir: string): CheckpointResult {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  const checkpointDir = join(shitennoDir, "governance", "context", CHECKPOINT_DIR);

  // Ensure checkpoint directory exists
  if (!existsSync(checkpointDir)) {
    try {
      mkdirSync(checkpointDir, { recursive: true });
    } catch (err) {
      return {
        success: false,
        message: `Failed to create checkpoint directory: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  // Check if buffer exists
  if (!existsSync(bufferPath)) {
    return {
      success: false,
      message: "context_buffer.yaml not found",
    };
  }

  // Create timestamped checkpoint filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const checkpointPath = join(checkpointDir, `${timestamp}.yaml`);

  // Copy buffer to checkpoint
  try {
    copyFileSync(bufferPath, checkpointPath);
  } catch (err) {
    return {
      success: false,
      message: `Failed to create checkpoint: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }

  const removedCount = cleanupOldCheckpoints(checkpointDir);

  return {
    success: true,
    checkpointPath,
    message: `Checkpoint created: ${checkpointPath}${removedCount > 0 ? ` (${removedCount} old checkpoints removed)` : ""}`,
    removedCount,
  };
}

function cleanupOldCheckpoints(checkpointDir: string): number {
  let removedCount = 0;
  try {
    const checkpoints = readdirSync(checkpointDir)
      .filter((f) => f.endsWith(".yaml"))
      .sort()
      .reverse();

    if (checkpoints.length > MAX_CHECKPOINTS) {
      const toRemove = checkpoints.slice(MAX_CHECKPOINTS);
      for (const file of toRemove) {
        try {
          unlinkSync(join(checkpointDir, file));
          removedCount++;
        } catch {
          logger.debug("buffer-checkpoint", "Failed to remove old checkpoint");
        }
      }
    }
  } catch {
    logger.debug("buffer-checkpoint", "Checkpoint cleanup failed — best-effort");
  }
  return removedCount;
}

/**
 * List all available checkpoints.
 *
 * @param shitennoDir - Path to shitenno/ directory
 * @returns Array of checkpoint file names sorted by date (newest first)
 */
export function listCheckpoints(shitennoDir: string): string[] {
  const checkpointDir = join(shitennoDir, "governance", "context", CHECKPOINT_DIR);

  if (!existsSync(checkpointDir)) {
    return [];
  }

  try {
    return readdirSync(checkpointDir)
      .filter((f) => f.endsWith(".yaml"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Get the most recent checkpoint.
 *
 * @param shitennoDir - Path to shitenno/ directory
 * @returns Checkpoint file name or null if no checkpoints exist
 */
export function getLatestCheckpoint(shitennoDir: string): string | null {
  const checkpoints = listCheckpoints(shitennoDir);
  return checkpoints[0] ?? null;
}

/**
 * Restore a checkpoint to context_buffer.yaml.
 *
 * WARNING: This overwrites the current buffer!
 *
 * @param shitennoDir - Path to shitenno/ directory
 * @param checkpointName - Name of checkpoint file to restore
 * @returns CheckpointResult with operation status
 */
export function restoreCheckpoint(shitennoDir: string, checkpointName: string): CheckpointResult {
  const checkpointDir = join(shitennoDir, "governance", "context", CHECKPOINT_DIR);
  const checkpointPath = join(checkpointDir, checkpointName);
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(checkpointPath)) {
    return {
      success: false,
      message: `Checkpoint not found: ${checkpointName}`,
    };
  }

  try {
    // First, checkpoint current buffer before restore
    if (existsSync(bufferPath)) {
      const preRestoreResult = checkpointBuffer(shitennoDir);
      if (!preRestoreResult.success) {
        logger.warn("buffer-checkpoint", "Failed to checkpoint before restore:", preRestoreResult.message);
      }
    }

    copyFileSync(checkpointPath, bufferPath);
    return {
      success: true,
      message: `Restored from checkpoint: ${checkpointName}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to restore checkpoint: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
