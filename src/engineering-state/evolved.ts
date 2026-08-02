/**
 * engineering-state-evolved.ts — Barrel re-exporting from sub-modules.
 */

export type { CapabilityLifecycleState, StateEvent, StateDelta, IncrementalState } from "./evolved/types.js";
export { CapabilityLifecycleTracker } from "./evolved/lifecycle.js";
export { EventSourcedState } from "./evolved/event-sourced.js";
export { IncrementalConsolidator } from "./evolved/consolidator.js";
