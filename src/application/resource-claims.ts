/**
 * resource-claims.ts — CLI-side Resource Arbitration Helper
 *
 * The CLI publishes `resource.claimed` / `resource.released` events while it is
 * actively mutating a plan or task, so the daemon's rule-engine can defer
 * conflicting autonomous (Tier 2) actions instead of racing the human.
 *
 * The daemon owns the claimedResources cache and reacts to these events.
 */

import { randomUUID } from "node:crypto";
import { getEventBus } from "../infrastructure/event-bus.js";
import { getSessionId } from "../shared/session-context.js";

/** Claim a resource on behalf of the active CLI session. Returns the sessionId used. */
export function claimResource(resourceId: string, resourceType: "plan" | "task"): string {
  const sessionId = getSessionId() ?? randomUUID();
  getEventBus().publish("resource.claimed", {
    resourceId,
    resourceType,
    sessionId,
    timestamp: new Date().toISOString(),
  });
  return sessionId;
}

/** Release a previously claimed resource. */
export function releaseResource(resourceId: string, sessionId: string): void {
  getEventBus().publish("resource.released", {
    resourceId,
    sessionId,
    timestamp: new Date().toISOString(),
  });
}
