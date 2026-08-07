/**
 * schema-validators.ts — Runtime type guards for critical record types.
 *
 * Used at trust boundaries (file I/O) to validate parsed data
 * before it enters the system. Follows the safeJsonParseValidated pattern.
 */

import { isRecord } from "../../shared/validation-utils.js";

// ── Daemon State ───────────────────────────────────────────────────────────

export function isDaemonState(v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false;
  return typeof v.startedAt === "string"
    && typeof v.pid === "number"
    && typeof v.auditCount === "number"
    && (v.lastAudit === null || typeof v.lastAudit === "string")
    && Array.isArray(v.challenges)
    && isRecord(v.notificationStats);
}

// ── Engineering State ──────────────────────────────────────────────────────

export function isEngineeringState(v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false;
  return typeof v.consolidatedAt === "string"
    && typeof v.lifecycle === "string"
    && isRecord(v.project)
    && Array.isArray(v.capabilities)
    && (v.knowledgeDebt === null || isRecord(v.knowledgeDebt));
}

// ── Briefing Cache ─────────────────────────────────────────────────────────

export function isBriefingCache(v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false;
  if (v.version !== 1) return false;
  if (!isRecord(v.entry)) return false;
  const entry = v.entry as Record<string, unknown>;
  return typeof entry.inputHash === "string"
    && typeof entry.computedAt === "string"
    && isRecord(entry.briefing);
}

// ── Feedback Record ────────────────────────────────────────────────────────

export function isFeedbackRecord(v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false;
  return typeof v.sessionId === "string"
    && (v.outcome === "success" || v.outcome === "failure" || v.outcome === "partial")
    && typeof v.timestamp === "string"
    && typeof v.notes === "string";
}

// ── Context Buffer ─────────────────────────────────────────────────────────

export function isContextBuffer(v: unknown): v is Record<string, unknown> {
  if (!isRecord(v)) return false;
  return typeof v.contextVersion === "number"
    && isRecord(v.session)
    && isRecord(v.current_task)
    && Array.isArray(v.reminders)
    && Array.isArray(v.completed_tasks)
    && Array.isArray(v.technical_debt)
    && Array.isArray(v.documents_loaded);
}
