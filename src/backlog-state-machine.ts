/**
 * backlog-state-machine.ts — Backlog State Machine (delegator)
 *
 * This module re-exports core functionality and provides convenience wrappers
 * around backlog-core.ts for backwards compatibility.
 *
 * All actual implementation is in backlog-core.ts.
 */

import { updateCurrentTask, addCompletedTask } from "./context-buffer-writer.js";
import {
  type BacklogState,
  type BacklogItem,
  type TransitionResult,
  resolveBacklogPaths,
  parseBacklogItems,
  findItem,
  transitionItem,
  findShortestPath,
} from "./backlog-core.js";

// ── Re-exports (backwards-compatible aliases) ──────────────────────────────

export {
  type BacklogState,
  type TransitionResult,
  isValidTransition,
  getAllowedTransitions,
} from "./backlog-core.js";

/** Backwards-compatible alias: parseBacklogItems with a single path arg */
export function parseBacklog(filePath: string): BacklogItem[] {
  return parseBacklogItems(filePath);
}

/** Backwards-compatible alias: findItem using items array parsed from a file path */
export function findBacklogItem(
  backlogPath: string,
  taskId: string,
): BacklogItem | null {
  const items = parseBacklogItems(backlogPath);
  return findItem(items, taskId);
}

// ── Convenience Wrappers ───────────────────────────────────────────────────

/**
 * Transition a backlog item to a new state.
 *
 * @param shitennoDir - Path to .shitenno directory
 * @param taskId - Task ID to transition
 * @param fromState - Expected current state (for validation)
 * @param toState - Target state
 */
export function transitionTask(
  shitennoDir: string,
  taskId: string,
  fromState: BacklogState,
  toState: BacklogState,
): TransitionResult {
  const { active: backlogPath } = resolveBacklogPaths(shitennoDir);
  const items = parseBacklogItems(backlogPath);
  const item = findItem(items, taskId);

  if (!item) {
    return { success: false, message: `Task ${taskId} not found in backlog` };
  }

  if (item.state !== fromState) {
    return {
      success: false,
      message: `Task ${taskId} is in state "${item.state}", expected "${fromState}"`,
    };
  }

  const result = transitionItem(backlogPath, taskId, toState);

  if (result.success) {
    const bufStatus = toState === "concluído" ? "completed" : "in_progress";
    updateCurrentTask(shitennoDir, { status: bufStatus });
    if (toState === "concluído") {
      addCompletedTask(shitennoDir, {
        id: taskId,
        description: "Auto-completed via backlog state machine",
        completed_at: new Date().toISOString(),
      });
    }
  }

  return result;
}

/**
 * Transition task to "concluído" (convenience function).
 * Finds the shortest path from current state to "concluído".
 */
export function completeTask(
  shitennoDir: string,
  taskId: string,
): TransitionResult {
  const { active: backlogPath } = resolveBacklogPaths(shitennoDir);
  const items = parseBacklogItems(backlogPath);
  const item = findItem(items, taskId);

  if (!item) {
    return {
      success: false,
      message: `Task ${taskId} not found in backlog`,
    };
  }

  if (item.state === "concluído") {
    return {
      success: true,
      message: `Task ${taskId} is already "concluído"`,
      previousState: item.state,
      newState: item.state,
    };
  }

  const path = findShortestPath(item.state, "concluído");
  if (!path || path.length === 0) {
    return {
      success: false,
      message: `No path from "${item.state}" to "concluído"`,
    };
  }

  let lastResult: TransitionResult = { success: true, message: "Initial state" };

  for (const nextState of path) {
    lastResult = transitionItem(backlogPath, taskId, nextState);
    if (!lastResult.success) {
      return lastResult;
    }
  }

  return lastResult;
}
