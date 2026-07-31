/**
 * Audit module — Public barrel
 *
 * Re-exports everything that health-auditor.ts currently exports.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type {
  AuditLevel,
  HealthIssue,
  GovernanceOptimization,
  HealthAuditReport,
  SourceFileInfo,
  HistoryEntry,
} from "./types.js";

// ── Shared utilities ─────────────────────────────────────────────────────────

export { collectSourceFiles, issueFingerprint } from "./shared.js";

// ── Health score ─────────────────────────────────────────────────────────────

export { calculateHealthScore } from "./health-score.js";

// ── Optimization proposer ────────────────────────────────────────────────────

export { proposeOptimizations } from "./optimization-proposer.js";

// ── Deduplication ────────────────────────────────────────────────────────────

export { deduplicateIssues } from "./shared.js";

// ── Constants ────────────────────────────────────────────────────────────────

export { DETECTORS_BY_LEVEL } from "./constants.js";

// ── Governance detectors (non-exported — called via detector registry) ───────

// These are internal to the audit system and called via the detector registry
// in auditHealth(). They are NOT re-exported as public API.

// ── Engineering detectors (non-exported — called via detector registry) ──────

// These are internal to the audit system and called via the detector registry
// in auditHealth(). They are NOT re-exported as public API.

// ── Security pattern detectors (public — called from tests) ──────────────────

export {
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
} from "./engineering-detectors.js";

// ── Context tier detectors ───────────────────────────────────────────────────

export {
  detectMisclassifiedTier,
} from "./context-tier-detectors.js";
