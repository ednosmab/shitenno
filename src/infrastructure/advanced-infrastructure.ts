/**
 * advanced-infrastructure.ts — Event Replay, Dead-Letter Queue, Event Versioning
 *
 * Provides advanced event infrastructure:
 * - Event replay: Re-process events from history
 * - Dead-letter queue: Capture events that failed processing
 * - Event versioning: Handle schema evolution gracefully
 *
 * PRINCIPLE: Events are the system's memory. Never lose them.
 */

// ── Re-exports from split modules ───────────────────────────────────────────

export type {
  EventVersion,
  VersionedEvent,
} from "./versioning.js";

export {
  EVENT_VERSIONS,
  migrateEvent,
  getEventVersion,
} from "./versioning.js";

export type { DeadLetterEvent } from "./dead-letter.js";
export { DeadLetterQueue } from "./dead-letter.js";

export type { ReplayResult } from "./event-replayer.js";
export { EventReplayer } from "./event-replayer.js";

// ── Re-export factory ──────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import type { ShitennoEventType } from "./event-bus.js";
import type { VersionedEvent, EventVersion } from "./versioning.js";
import { EVENT_VERSIONS } from "./versioning.js";

/** Create a versioned event with automatic version. */
export function createVersionedEvent<T>(
  type: ShitennoEventType,
  payload: T,
  options?: { correlationId?: string; traceId?: string; version?: EventVersion }
): VersionedEvent<T> {
  return {
    id: randomUUID(),
    type,
    payload,
    version: options?.version ?? EVENT_VERSIONS[type] ?? 1,
    timestamp: new Date().toISOString(),
    correlationId: options?.correlationId,
    traceId: options?.traceId,
  };
}
