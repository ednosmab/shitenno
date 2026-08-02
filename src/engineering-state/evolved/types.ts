import type { EngineeringState, EngineeringAsset } from "../../engineering-state.js";

export const MAX_STATE_EVENTS = 10_000;
export const MAX_CAPABILITY_HISTORY = 50;
export const MAX_PENDING_DELTAS = 100;

export type CapabilityLifecycleState =
  | "detected"
  | "installed"
  | "configured"
  | "validated"
  | "healthy"
  | "deprecated"
  | "removed";

export interface StateEvent {
  id: string;
  type: "state_changed" | "capability_updated" | "asset_added" | "asset_removed" | "dimension_updated" | "consolidation";
  entityPath: string;
  previousState?: unknown;
  newState: unknown;
  source: string;
  timestamp: string;
  correlationId?: string;
}

export interface StateDelta {
  timestamp: string;
  assetsAdded: EngineeringAsset[];
  assetsRemoved: string[];
  dimensionsChanged: Array<{
    dimension: string;
    previousScore: number;
    newScore: number;
    delta: number;
  }>;
  capabilitiesChanged: Array<{
    capabilityId: string;
    previousState: CapabilityLifecycleState;
    newState: CapabilityLifecycleState;
  }>;
  healthChanges: {
    previous: number;
    current: number;
    delta: number;
  };
}

export interface IncrementalState {
  state: EngineeringState;
  version: number;
  lastConsolidated: string;
  pendingDeltas: StateDelta[];
}
