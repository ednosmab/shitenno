/**
 * infrastructure/versioning.ts — Event Version Registry and Migration
 *
 * Handles schema versioning for events to support graceful evolution.
 */

import type { ShitennoEventType } from "../event-bus.js";

// ── Types ──────────────────────────────────────────────────────────────────

/** Event version for schema evolution. */
export type EventVersion = number;

/** A versioned event with metadata. */
export interface VersionedEvent<T = unknown> {
  /** Unique event ID. */
  id: string;
  /** Event type. */
  type: ShitennoEventType;
  /** Event payload. */
  payload: T;
  /** Schema version (for migration). */
  version: EventVersion;
  /** ISO timestamp. */
  timestamp: string;
  /** Correlation ID. */
  correlationId?: string;
  /** Trace ID. */
  traceId?: string;
}

// ── Event Version Registry ─────────────────────────────────────────────────

export const EVENT_VERSIONS: Record<ShitennoEventType, EventVersion> = {
  "session.start": 1,
  "session.end": 1,
  "analysis.complete": 1,
  "command.completed": 1,
  "score.calculated": 1,
  "pattern.detected": 1,
  "health.checked": 1,
  "debt.detected": 1,
  "capability.installed": 1,
  "capability.unlocked": 1,
  "maturity.changed": 1,
  "rule.triggered": 1,
  "evolution.recommended": 1,
  "adr.created": 1,
  "skill.created": 1,
  "validation.completed": 1,
  "task.completed": 1,
  "pipeline.stage.start": 1,
  "pipeline.stage.complete": 1,
  "pipeline.started": 1,
  "pipeline.complete": 1,
  "plan.archived": 1,
  "plan.created": 1,
  "plan.file_changed": 1,
  "plan.status_changed": 1,
  "plan.format_warning": 1,
  "plan.inconsistency_detected": 1,
  "backlog.updated": 1,
  "lifecycle.state_changed": 1,
  "knowledge.analyzed": 1,
  "engineering_state.updated": 1,
  "engineering_state.consolidated": 1,
  "knowledge_debt.detected": 1,
  "recommendation.accepted": 1,
  "recommendation.rejected": 1,
  "governance.policy_applied": 1,
  "asset.created": 1,
  "asset.updated": 1,
  "asset.archived": 1,
  "entropy.calculated": 1,
  "docs.sync.triggered": 1,
  "doc.lifecycle.audited": 1,
  "system.updated": 1,
  "challenge.generated": 1,
  "state.mutated": 1,
  "workdir.large_uncommitted_drift": 1,
  "context.p4_loaded": 1,
  "context.tier_mismatch": 1,
  "watcher.error": 1,
  "daemon.ready": 1,
  "briefing.generated": 1,
  "proactive.digest_ready": 1,
  "action.pre_sensitive": 1,
  "resource.claimed": 1,
  "resource.released": 1,
  "pipeline.partial_failure": 1,
  "audit.standard": 1,
  "source.changed": 1,
  "source.file_added": 1,
  "source.file_deleted": 1,
  "git.branch_changed": 1,
  "git.commit_detected": 1,
  "git.ref_updated": 1,
  "semantic.pattern_detected": 1,
  "semantic.insight_detected": 1,
  "notification.sent": 1,
  "notification.throttled": 1,
};

// ── Migration ──────────────────────────────────────────────────────────────

/** Migrate a payload from one version to another. */
function migratePayload(
  payload: unknown,
  _fromVersion: EventVersion,
  _toVersion: EventVersion
): unknown {
  return payload;
}

/** Migrate a versioned event to the latest version. */
export function migrateEvent<T>(event: VersionedEvent<T>): VersionedEvent<T> {
  const latestVersion = EVENT_VERSIONS[event.type] ?? 1;
  if (event.version === latestVersion) return event;

  return {
    ...event,
    payload: migratePayload(event.payload, event.version, latestVersion) as T,
    version: latestVersion,
  };
}

/** Get current version for an event type. */
export function getEventVersion(type: ShitennoEventType): EventVersion {
  return EVENT_VERSIONS[type] ?? 1;
}
