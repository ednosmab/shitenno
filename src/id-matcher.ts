/**
 * id-matcher.ts — Exact ID matching with separator boundary.
 *
 * Replaces the fragile bidirectional substring matching
 * (`a.includes(b) || b.includes(a)`) used across task-completion
 * and backlog-state-machine.
 *
 * "TASK-1" matches "TASK-1" and "TASK-1-retry" but NEVER "TASK-10".
 */

export function matchesTaskId(candidateId: string, taskId: string): boolean {
  const a = candidateId.trim().toLowerCase();
  const b = taskId.trim().toLowerCase();
  if (a === b) return true;

  const boundaryAfter = (longer: string, shorter: string): boolean => {
    if (!longer.startsWith(shorter)) return false;
    const nextChar = longer[shorter.length];
    return nextChar === undefined || /[-_. ]/.test(nextChar);
  };

  return boundaryAfter(a, b) || boundaryAfter(b, a);
}
