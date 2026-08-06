/**
 * plan-lifecycle.ts — Plan lifecycle orchestrator (thin entry point)
 *
 * Implementation details extracted into:
 * - plan/checks.ts: checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation
 * - plan/verification.ts: runAutoVerification, computeDiffHash
 * - plan/lifecycle-actions.ts: executePlanAction, handleAutoMode, handleInteractiveMode, runLifecycleReview
 * - plan/management.ts: archivePlan, removePlan, detectActivePlans, checkAndArchiveDonePlans
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface CompletionCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  checks: CompletionCheck[];
  passed: boolean;
  valid: boolean;
  verifiedAt: string;
}

export interface LifecycleResult {
  checked: number;
  archived: number;
  archivedIds: string[];
  active: boolean;
}

export interface VerificationRecord {
  planId: string;
  checks: CompletionCheck[];
  passed: boolean;
  verifiedAt: string;
  diffHash: string;
}

// ── Re-exports from extracted modules ───────────────────────────────────────

export { checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation } from "../plan/checks.js";
export { runAutoVerification } from "../plan/verification.js";
export { executePlanAction, runLifecycleReview } from "../plan/lifecycle-actions.js";
export { archivePlan, removePlan, detectActivePlans, checkAndArchiveDonePlans } from "../plan/management.js";
