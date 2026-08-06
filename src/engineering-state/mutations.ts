/**
 * engineering-state-mutations.ts — Mutation Governance
 *
 * Provides provenance tracking for state mutations.
 * Every mutation is validated, logged, and attributed to its source.
 *
 * PRINCIPLE: State changes must have provenance. No silent mutations.
 */

import { getEventBus } from "../infrastructure/event-bus.js";
import { saveEngineeringState, type EngineeringState } from "../application/engineering-state.js";
import { logger } from "../shared/logger.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface StateMutation {
  shitennoDir: string;
  newState: EngineeringState;
  description: string;
}

export interface MutationSource {
  module: string;
  trigger: string;
}

export interface MutationResult {
  allowed: boolean;
  reason?: string;
  mutation: StateMutation;
  source: MutationSource;
  timestamp: string;
}

// ── Mutation Log ────────────────────────────────────────────────────────────

const mutationLog: MutationResult[] = [];

/**
 * Get the mutation log.
 */
export function getMutationLog(): readonly MutationResult[] {
  return mutationLog;
}

/**
 * Clear the mutation log (useful for tests).
 */
export function clearMutationLog(): void {
  mutationLog.length = 0;
}

// ── Mutation Validation ─────────────────────────────────────────────────────

/**
 * Validate a state mutation.
 * Returns whether the mutation is allowed.
 */
function validateMutation(mutation: StateMutation): { allowed: boolean; reason?: string } {
  // Basic validation
  if (!mutation.newState) {
    return { allowed: false, reason: "New state is required" };
  }

  if (!mutation.newState.consolidatedAt) {
    return { allowed: false, reason: "New state must have a consolidatedAt timestamp" };
  }

  // Health score sanity check
  if (mutation.newState.healthScores.overall < 0 || mutation.newState.healthScores.overall > 100) {
    return { allowed: false, reason: "Health score must be between 0 and 100" };
  }

  // Entropy sanity check
  if (mutation.newState.entropy.score < 0 || mutation.newState.entropy.score > 100) {
    return { allowed: false, reason: "Entropy score must be between 0 and 100" };
  }

  return { allowed: true };
}

// ── Mutation Application ────────────────────────────────────────────────────

/**
 * Propose and apply a state mutation.
 * Validates, logs, saves, and publishes the mutation event.
 */
export function proposeStateMutation(
  mutation: StateMutation,
  source: MutationSource
): MutationResult {
  const validation = validateMutation(mutation);

  const result: MutationResult = {
    allowed: validation.allowed,
    reason: validation.reason,
    mutation,
    source,
    timestamp: new Date().toISOString(),
  };

  if (!validation.allowed) {
    logger.warn(
      "state-mutations",
      `Mutation rejected: ${mutation.description} — ${validation.reason}`
    );
    mutationLog.push(result);
    return result;
  }

  // Apply the mutation
  saveEngineeringState(mutation.shitennoDir, mutation.newState);

  // Publish event
  getEventBus().publish("state.mutated", {
    source: source.module,
    trigger: source.trigger,
    description: mutation.description,
    timestamp: result.timestamp,
  });

  // Log the mutation
  mutationLog.push(result);

  logger.debug(
    "state-mutations",
    `Mutation applied: ${mutation.description} (source: ${source.module}/${source.trigger})`
  );

  return result;
}
