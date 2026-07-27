import { getEventBus } from "../../event-bus.js";
import { BoundedQueue } from "../../daemon-resources.js";
import { MAX_CAPABILITY_HISTORY, type CapabilityLifecycleState } from "./types.js";

export class CapabilityLifecycleTracker {
  private states = new Map<string, CapabilityLifecycleState>();
  private history = new Map<string, BoundedQueue<{ state: CapabilityLifecycleState; timestamp: string }>>();

  transition(
    capabilityId: string,
    newState: CapabilityLifecycleState,
    source: string
  ): { previous: CapabilityLifecycleState; current: CapabilityLifecycleState } | undefined {
    const previous = this.states.get(capabilityId) ?? "detected";
    if (previous === newState) return undefined;

    this.states.set(capabilityId, newState);

    const history = this.history.get(capabilityId) ?? new BoundedQueue<{ state: CapabilityLifecycleState; timestamp: string }>(MAX_CAPABILITY_HISTORY);
    history.push({ state: newState, timestamp: new Date().toISOString() });
    this.history.set(capabilityId, history);

    const bus = getEventBus();
    bus.publish("lifecycle.state_changed", {
      capabilityId,
      previousState: previous,
      newState,
      source,
      timestamp: new Date().toISOString(),
    });

    const stateOrder: CapabilityLifecycleState[] = ["detected", "installed", "configured", "validated", "healthy"];
    const prevIdx = stateOrder.indexOf(previous);
    const newIdx = stateOrder.indexOf(newState);
    if (prevIdx >= 0 && newIdx > prevIdx) {
      bus.publish("capability.unlocked", {
        capabilityId,
        previousLevel: previous,
        newLevel: newState,
        timestamp: new Date().toISOString(),
      });
    }

    return { previous, current: newState };
  }

  getState(capabilityId: string): CapabilityLifecycleState {
    return this.states.get(capabilityId) ?? "detected";
  }

  getHistory(capabilityId: string): Array<{ state: CapabilityLifecycleState; timestamp: string }> {
    return this.history.get(capabilityId)?.toArray() ?? [];
  }

  getAll(): Map<string, CapabilityLifecycleState> {
    return new Map(this.states);
  }

  canTransition(capabilityId: string, newState: CapabilityLifecycleState): boolean {
    const current = this.getState(capabilityId);
    const validTransitions: Record<CapabilityLifecycleState, CapabilityLifecycleState[]> = {
      detected: ["installed", "removed"],
      installed: ["configured", "removed"],
      configured: ["validated", "deprecated"],
      validated: ["healthy", "deprecated"],
      healthy: ["deprecated"],
      deprecated: ["removed"],
      removed: [],
    };
    return validTransitions[current]?.includes(newState) ?? false;
  }
}
