/**
 * Detector map — Supply chain & tech debt detectors builder
 */

import type { HealthIssue } from "../types.js";
import type { DetectorContext } from "./context.js";

import {
  detectSBOMCoverage,
  detectDependencyProvenance,
  detectTyposquatting,
  detectLicenseConflicts,
  detectTransitiveVulns,
  detectMalwarePatterns,
  detectDependencyStaleness,
} from "../security-advanced-detectors/index.js";

import {
  detectTechDebtCost,
  detectTDR,
  detectRemediationEffort,
  detectDebtTrend,
  detectHotspotFiles,
  detectDebtByDomain,
  detectROIRefactoring,
  detectDebtAccumulationRate,
} from "../tech-debt-detectors.js";

import {
  detectSBOMExists,
  detectSBOMCompleteness,
  detectOutdatedDeps,
  detectUnusedDeps,
  detectLockFileSync,
  detectDuplicateDeps,
  detectDepAuditStatus,
} from "../supply-chain-detectors.js";

import { detectAccessibilityGaps } from "../a11y-engine.js";
import { detectStaleVerification } from "../detect-stale-verification.js";

export function buildSupplyChainTechDebtDetectors(ctx: DetectorContext): Record<string, () => HealthIssue[] | Promise<HealthIssue[]>> {
  return {
    detectSBOMCoverage: () => detectSBOMCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyProvenance: () => detectDependencyProvenance(ctx.projectRoot, ctx.sourceFiles),
    detectTyposquatting: () => detectTyposquatting(ctx.projectRoot, ctx.sourceFiles),
    detectLicenseConflicts: () => detectLicenseConflicts(ctx.projectRoot, ctx.sourceFiles),
    detectTransitiveVulns: () => detectTransitiveVulns(ctx.projectRoot, ctx.sourceFiles),
    detectMalwarePatterns: () => detectMalwarePatterns(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyStaleness: () => detectDependencyStaleness(ctx.projectRoot, ctx.sourceFiles),
    detectTechDebtCost: () => detectTechDebtCost(ctx.projectRoot, ctx.sourceFiles, []),
    detectTDR: () => detectTDR(ctx.projectRoot, ctx.sourceFiles, []),
    detectRemediationEffort: () => detectRemediationEffort(ctx.projectRoot, ctx.sourceFiles, []),
    detectDebtTrend: () => detectDebtTrend(ctx.projectRoot, ctx.sourceFiles),
    detectHotspotFiles: () => detectHotspotFiles(ctx.projectRoot, ctx.sourceFiles, []),
    detectDebtByDomain: () => detectDebtByDomain(ctx.projectRoot, ctx.sourceFiles, []),
    detectROIRefactoring: () => detectROIRefactoring(ctx.projectRoot, ctx.sourceFiles, []),
    detectDebtAccumulationRate: () => detectDebtAccumulationRate(ctx.projectRoot, ctx.sourceFiles),
    detectSBOMExists: () => detectSBOMExists(ctx.projectRoot, ctx.sourceFiles),
    detectSBOMCompleteness: () => detectSBOMCompleteness(ctx.projectRoot, ctx.sourceFiles),
    detectOutdatedDeps: () => detectOutdatedDeps(ctx.projectRoot, ctx.sourceFiles),
    detectUnusedDeps: () => detectUnusedDeps(ctx.projectRoot, ctx.sourceFiles),
    detectLockFileSync: () => detectLockFileSync(ctx.projectRoot, ctx.sourceFiles),
    detectDuplicateDeps: () => detectDuplicateDeps(ctx.projectRoot, ctx.sourceFiles),
    detectDepAuditStatus: () => detectDepAuditStatus(ctx.projectRoot, ctx.sourceFiles),
    detectAccessibilityGaps: () => detectAccessibilityGaps(ctx.projectRoot, ctx.sourceFiles),
    detectStaleVerification: () => detectStaleVerification(ctx.projectRoot, ctx.shitennoDir),
  };
}
