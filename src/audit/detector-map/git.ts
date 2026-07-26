/**
 * Detector map — Git, enforcement & code quality detectors builder
 */

import type { HealthIssue } from "../types.js";
import type { DetectorContext } from "./context.js";

import {
  detectCommitFormat,
  detectBranchNaming,
  detectDirectMainCommits,
  detectForcePushes,
  detectOrphanBranches,
  detectCommitLanguage,
  detectSecretsInGitHistory,
  detectCommitWithoutGating,
} from "../git-detectors.js";

import {
  detectIncompleteSessionClose,
  detectMissingFeedback,
  detectInvalidBacklogStates,
  detectPlanFormat,
  detectRuleExecutionCompliance,
  detectPolicyStructure,
  detectMissingPremortem,
  detectMissingAdrForChanges,
  detectDonePlanIntegrity,
} from "../governance-enforcement-detectors.js";

import {
  detectMisclassifiedTier,
  detectTierMismatches,
} from "../context-tier-detectors.js";

import {
  detectJSDocCoverage,
  detectUnsafeTypeAssertions,
  detectUnreachableCode,
  detectUnusedImports,
  detectMagicNumbers,
  detectLongParams,
  detectDeepNesting,
  detectDuplicateCode,
  detectGodFunctions,
  detectCoverageThreshold,
} from "../code-quality-detectors.js";

export function buildGitEnforcementDetectors(ctx: DetectorContext): Record<string, () => HealthIssue[]> {
  return {
    detectCommitFormat: () => detectCommitFormat(ctx.projectRoot),
    detectBranchNaming: () => detectBranchNaming(ctx.projectRoot),
    detectDirectMainCommits: () => detectDirectMainCommits(ctx.projectRoot),
    detectForcePushes: () => detectForcePushes(ctx.projectRoot),
    detectOrphanBranches: () => detectOrphanBranches(ctx.projectRoot),
    detectCommitLanguage: () => detectCommitLanguage(ctx.projectRoot),
    detectSecretsInGitHistory: () => detectSecretsInGitHistory(ctx.projectRoot),
    detectCommitWithoutGating: () => detectCommitWithoutGating(ctx.projectRoot),
    detectIncompleteSessionClose: () => detectIncompleteSessionClose(ctx.shitennoDir),
    detectMissingFeedback: () => detectMissingFeedback(ctx.shitennoDir),
    detectInvalidBacklogStates: () => detectInvalidBacklogStates(ctx.shitennoDir),
    detectPlanFormat: () => detectPlanFormat(ctx.shitennoDir),
    detectRuleExecutionCompliance: () => detectRuleExecutionCompliance(ctx.shitennoDir),
    detectPolicyStructure: () => detectPolicyStructure(ctx.shitennoDir),
    detectMissingPremortem: () => detectMissingPremortem(ctx.shitennoDir),
    detectMissingAdrForChanges: () => detectMissingAdrForChanges(ctx.shitennoDir),
    detectDonePlanIntegrity: () => detectDonePlanIntegrity(ctx.shitennoDir),
    detectMisclassifiedTier: () => detectMisclassifiedTier(ctx.shitennoDir),
    detectTierMismatches: () => detectTierMismatches(ctx.shitennoDir),
    detectJSDocCoverage: () => detectJSDocCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectUnsafeTypeAssertions: () => detectUnsafeTypeAssertions(ctx.projectRoot, ctx.sourceFiles),
    detectUnreachableCode: () => detectUnreachableCode(ctx.projectRoot, ctx.sourceFiles),
    detectUnusedImports: () => detectUnusedImports(ctx.projectRoot, ctx.sourceFiles),
    detectMagicNumbers: () => detectMagicNumbers(ctx.projectRoot, ctx.sourceFiles),
    detectLongParams: () => detectLongParams(ctx.projectRoot, ctx.sourceFiles),
    detectDeepNesting: () => detectDeepNesting(ctx.projectRoot, ctx.sourceFiles),
    detectDuplicateCode: () => detectDuplicateCode(ctx.projectRoot, ctx.sourceFiles),
    detectGodFunctions: () => detectGodFunctions(ctx.projectRoot, ctx.sourceFiles),
    detectCoverageThreshold: () => detectCoverageThreshold(ctx.projectRoot),
  };
}
