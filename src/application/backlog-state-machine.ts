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
  type TransitionResult,
  resolveBacklogPaths,
  parseBacklogItems,
  findItem,
  transitionItem,
} from "./backlog-core.js";

// ── Re-exports (backwards-compatible aliases) ──────────────────────────────

export {
  type BacklogState,
  type TransitionResult,
  isValidTransition,
  getAllowedTransitions,
} from "./backlog-core.js";

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
