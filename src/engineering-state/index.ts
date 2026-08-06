/**
 * engineering-state/index.ts — Public API for the engineering-state module.
 *
 * Consolidates: engineering-state.ts (core), -access, -discovery, -evolved,
 * -history, -io, -mutations, -subscription.
 *
 * Only this file should be imported by code outside src/engineering-state/.
 * The main src/engineering-state.ts remains as the primary entry point for
 * backward compatibility with existing imports.
 */

// Re-export from the main engineering-state.ts (core orchestrator)
export {
  type AssetType,
  type EngineeringAsset,
  type EngineeringState,
  consolidateEngineeringState,
  initializeEngineeringState,
  calculateEntropy,
  discoverAssets,
  saveEngineeringState,
  loadEngineeringState,
  engineeringStateToText,
} from "../application/engineering-state.js";

// Re-export from sub-modules
export { getEngineeringState, clearEngineeringStateCache, isInitialized } from "./access.js";
export {
  type CapabilityLifecycleState,
  type StateEvent,
  type StateDelta,
  type IncrementalState,
  CapabilityLifecycleTracker,
  EventSourcedState,
  IncrementalConsolidator,
} from "./evolved.js";
export { getSnapshotAt, listSnapshots, diffSnapshots } from "./history.js";
export { subscribeToEngineeringState } from "./subscription.js";
export {
  type StateMutation,
  type MutationSource,
  type MutationResult,
  getMutationLog,
  clearMutationLog,
  proposeStateMutation,
} from "./mutations.js";
