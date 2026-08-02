/**
 * backlog-core.ts — Barrel Re-exports
 *
 * This module re-exports everything from the split modules for backwards compatibility.
 * All consumers should import from this file or from the specific sub-modules.
 *
 * Sub-modules:
 *   - backlog-types.ts: Types, constants, state helpers
 *   - backlog-parser.ts: Parsing, findItem, resolveBacklogPaths
 *   - backlog-writer.ts: addItem, deleteItem, transitionItem, moveItemToDone
 *   - backlog-format.ts: Summary, formatting
 */

export {
  type BacklogState,
  type BacklogPriority,
  type BacklogSeverity,
  type BacklogItem,
  type TransitionResult,
  type BacklogSummary,
  type AddItemInput,
  VALID_TRANSITIONS,
  normalizeState,
  getAllowedTransitions,
  isValidTransition,
  findShortestPath,
} from "./backlog-types.js";

export {
  resolveBacklogPaths,
  parseBacklogItems,
  findItem,
} from "./backlog-parser.js";

export {
  addItem,
  deleteItem,
  transitionItem,
  moveItemToDone,
  type BacklogWriteResult,
  mapSeverityToPriority,
  severityLabel,
  isDuplicate,
  formatBacklogItem,
  formatBacklogSection,
  appendBacklogSection,
  issueToBacklogItem,
  dimensionToBacklogItem,
} from "./backlog-writer.js";

export {
  getBacklogSummary,
  formatItemCompact,
  formatItemsByPriority,
  formatSummaryLine,
} from "./backlog-format.js";
