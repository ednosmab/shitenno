/**
 * doc-lifecycle-auditor.ts — Documentation Lifecycle Auditor
 *
 * Thin facade — all logic split into audit/doc-lifecycle/ modules.
 */

export type {
  DocType,
  DocLifecycleStatus,
  StatusMarkerResult,
  CrossReference,
  GitCorrelation,
  StalenessSignals,
  DetectionSignals,
  SupersessionSignals,
  DocumentInfo,
  DocumentClassification,
  ProposedMove,
  DocLifecycleReport,
  MoveResult,
} from "../audit/doc-lifecycle/types.js";

export {
  detectStatusMarkers,
  detectCrossReferences,
  detectSupersession,
} from "../audit/doc-lifecycle/detectors.js";

export { classifyDocument } from "../audit/doc-lifecycle/classifier.js";

export {
  auditDocLifecycle,
  applyMoves,
  writeDocLifecycleReport,
} from "../audit/doc-lifecycle/auditor.js";
