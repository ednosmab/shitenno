/**
 * Detector map — Architecture & reliability detectors builder
 */

import type { HealthIssue } from "../types.js";
import type { DetectorContext } from "./context.js";

import {
  detectCleanArchitectureLayers,
  detectSRPViolations,
  detectDependencyInversion,
  detectBarrelFileCycles,
  detectModuleCoupling,
  detectImportConsistency,
  detectTestStructure,
} from "../architecture-detectors.js";

import {
  detectVisionAlignment,
  detectRoadmapConsistency,
  detectKPICoverage,
  detectOrphanRequirements,
  detectRequirementTraceability,
  detectAmbiguityPatterns,
} from "../product-detectors.js";

import {
  detectSchemaConsistency,
  detectDataOwnership,
  detectMissingMigrations,
  detectIndexCoverage,
} from "../data-architecture-detectors.js";

import {
  detectCircuitBreaker,
  detectRetryPolicy,
  detectTimeoutConfig,
  detectHealthChecks,
  detectGracefulDegradation,
  detectRaceConditions,
  detectDeadlockRisk,
} from "../reliability-detectors.js";

import {
  detectNPlusOne,
  detectMissingCaching,
  detectStatefulServices,
  detectMissingRateLimiting,
  detectMissingTimeouts,
} from "../performance-detectors.js";

export function buildArchReliabilityDetectors(ctx: DetectorContext): Record<string, () => HealthIssue[]> {
  return {
    detectCleanArchitectureLayers: () => detectCleanArchitectureLayers(ctx.projectRoot, ctx.sourceFiles),
    detectSRPViolations: () => detectSRPViolations(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyInversion: () => detectDependencyInversion(ctx.projectRoot, ctx.sourceFiles),
    detectBarrelFileCycles: () => detectBarrelFileCycles(ctx.projectRoot, ctx.sourceFiles),
    detectModuleCoupling: () => detectModuleCoupling(ctx.projectRoot, ctx.sourceFiles),
    detectImportConsistency: () => detectImportConsistency(ctx.projectRoot, ctx.sourceFiles),
    detectTestStructure: () => detectTestStructure(ctx.projectRoot),
    detectVisionAlignment: () => detectVisionAlignment(ctx.projectRoot),
    detectRoadmapConsistency: () => detectRoadmapConsistency(ctx.projectRoot),
    detectKPICoverage: () => detectKPICoverage(ctx.projectRoot),
    detectOrphanRequirements: () => detectOrphanRequirements(ctx.projectRoot, ctx.sourceFiles),
    detectRequirementTraceability: () => detectRequirementTraceability(ctx.projectRoot, ctx.sourceFiles),
    detectAmbiguityPatterns: () => detectAmbiguityPatterns(ctx.projectRoot),
    detectSchemaConsistency: () => detectSchemaConsistency(ctx.projectRoot, ctx.sourceFiles),
    detectDataOwnership: () => detectDataOwnership(ctx.projectRoot),
    detectMissingMigrations: () => detectMissingMigrations(ctx.projectRoot, ctx.sourceFiles),
    detectIndexCoverage: () => detectIndexCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectCircuitBreaker: () => detectCircuitBreaker(ctx.projectRoot, ctx.sourceFiles),
    detectRetryPolicy: () => detectRetryPolicy(ctx.projectRoot, ctx.sourceFiles),
    detectTimeoutConfig: () => detectTimeoutConfig(ctx.projectRoot, ctx.sourceFiles),
    detectHealthChecks: () => detectHealthChecks(ctx.projectRoot),
    detectGracefulDegradation: () => detectGracefulDegradation(ctx.projectRoot, ctx.sourceFiles),
    detectRaceConditions: () => detectRaceConditions(ctx.projectRoot, ctx.sourceFiles),
    detectDeadlockRisk: () => detectDeadlockRisk(ctx.projectRoot, ctx.sourceFiles),
    detectNPlusOne: () => detectNPlusOne(ctx.projectRoot, ctx.sourceFiles),
    detectMissingCaching: () => detectMissingCaching(ctx.projectRoot, ctx.sourceFiles),
    detectStatefulServices: () => detectStatefulServices(ctx.projectRoot, ctx.sourceFiles),
    detectMissingRateLimiting: () => detectMissingRateLimiting(ctx.projectRoot, ctx.sourceFiles),
    detectMissingTimeouts: () => detectMissingTimeouts(ctx.projectRoot, ctx.sourceFiles),
  };
}
