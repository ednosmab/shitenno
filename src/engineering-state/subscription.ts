/**
 * engineering-state-subscription.ts — Reactive subscription to Engineering State
 *
 * Provides a helper that subscribes to `engineering_state.consolidated` events
 * and maintains a cached state. Commands use this to avoid direct fs reads.
 *
 * PRINCIPLE: Commands receive state via events, not by reading files directly.
 */

import { getEventBus } from "../infrastructure/event-bus.js";
import { consolidateEngineeringState, type EngineeringState } from "../application/engineering-state.js";

/**
 * Subscribe to Engineering State updates.
 * Returns a `getState()` function that always returns the latest consolidated state,
 * and an `unsubscribe()` function for cleanup.
 */
export function subscribeToEngineeringState(
  projectRoot: string,
  shitennoDir: string
): { getState: () => EngineeringState; unsubscribe: () => void } {
  const bus = getEventBus();
  let latestState = consolidateEngineeringState(projectRoot, shitennoDir);

  const unsubscribe = bus.subscribe("engineering_state.consolidated", () => {
    latestState = consolidateEngineeringState(projectRoot, shitennoDir);
  });

  return {
    getState: () => latestState,
    unsubscribe,
  };
}
