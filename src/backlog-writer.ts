/**
 * backlog-writer.ts — Write Operations
 *
 * Core operations: addItem, deleteItem, transitionItem, moveItemToDone.
 * Legacy compat: mapSeverityToPriority, severityLabel, isDuplicate,
 *   formatBacklogItem, formatBacklogSection, appendBacklogSection,
 *   issueToBacklogItem, dimensionToBacklogItem.
 */

export type { BacklogItem, BacklogPriority, BacklogSeverity } from "./backlog-types.js";

export {
  addItem,
  deleteItem,
  findItemRange,
  transitionItem,
  moveItemToDone,
} from "./backlog-writer/core.js";

export type { BacklogWriteResult } from "./backlog-writer/legacy.js";
export {
  mapSeverityToPriority,
  severityLabel,
  isDuplicate,
  formatBacklogItem,
  formatBacklogSection,
  appendBacklogSection,
  issueToBacklogItem,
  dimensionToBacklogItem,
} from "./backlog-writer/legacy.js";
