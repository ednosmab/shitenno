/**
 * Detector map — Operations & compliance detectors builder
 */

import type { HealthIssue } from "../types.js";
import type { DetectorContext } from "./context.js";

import {
  detectMissingTracing,
  detectLogStructure,
  detectAlertCoverage,
  detectMetricEndpoints,
  detectMissingDashboard,
  detectLogRetention,
  detectDistributedLogging,
  detectSLODefinitions,
} from "../observability-detectors.js";

import {
  detectPipelineGaps,
  detectRollbackCapability,
  detectMissingRunbooks,
  detectMonitoringGaps,
  detectIncidentResponse,
  detectDisasterRecovery,
  detectCapacityPlanning,
  detectChangeManagement,
} from "../operations-detectors.js";

import {
  detectOWASPTop10,
  detectCWEMapping,
  detectSOC2Controls,
  detectNISTAlignment,
  detectLGPDCompliance,
  detectDataRetention,
  detectConsentTracking,
  detectSecretsInConfig,
  detectEncryptionAtRest,
  detectAccessControls,
  detectAuditLogging,
  detectComplianceReport,
} from "../compliance-detectors.js";

export function buildOpsComplianceDetectors(ctx: DetectorContext): Record<string, () => HealthIssue[]> {
  return {
    detectMissingTracing: () => detectMissingTracing(ctx.projectRoot, ctx.sourceFiles),
    detectLogStructure: () => detectLogStructure(ctx.projectRoot, ctx.sourceFiles),
    detectAlertCoverage: () => detectAlertCoverage(ctx.projectRoot, ctx.sourceFiles),
    detectMetricEndpoints: () => detectMetricEndpoints(ctx.projectRoot, ctx.sourceFiles),
    detectMissingDashboard: () => detectMissingDashboard(ctx.projectRoot, ctx.sourceFiles),
    detectLogRetention: () => detectLogRetention(ctx.projectRoot, ctx.sourceFiles),
    detectDistributedLogging: () => detectDistributedLogging(ctx.projectRoot, ctx.sourceFiles),
    detectSLODefinitions: () => detectSLODefinitions(ctx.projectRoot, ctx.sourceFiles),
    detectPipelineGaps: () => detectPipelineGaps(ctx.projectRoot, ctx.sourceFiles),
    detectRollbackCapability: () => detectRollbackCapability(ctx.projectRoot, ctx.sourceFiles),
    detectMissingRunbooks: () => detectMissingRunbooks(ctx.projectRoot, ctx.sourceFiles),
    detectMonitoringGaps: () => detectMonitoringGaps(ctx.projectRoot, ctx.sourceFiles),
    detectIncidentResponse: () => detectIncidentResponse(ctx.projectRoot, ctx.sourceFiles),
    detectDisasterRecovery: () => detectDisasterRecovery(ctx.projectRoot, ctx.sourceFiles),
    detectCapacityPlanning: () => detectCapacityPlanning(ctx.projectRoot, ctx.sourceFiles),
    detectChangeManagement: () => detectChangeManagement(ctx.projectRoot, ctx.sourceFiles),
    detectOWASPTop10: () => detectOWASPTop10(ctx.projectRoot, ctx.sourceFiles, []),
    detectCWEMapping: () => detectCWEMapping(ctx.projectRoot, ctx.sourceFiles, []),
    detectSOC2Controls: () => detectSOC2Controls(ctx.projectRoot, ctx.sourceFiles),
    detectNISTAlignment: () => detectNISTAlignment(ctx.projectRoot, ctx.sourceFiles),
    detectLGPDCompliance: () => detectLGPDCompliance(ctx.projectRoot, ctx.sourceFiles),
    detectDataRetention: () => detectDataRetention(ctx.projectRoot, ctx.sourceFiles),
    detectConsentTracking: () => detectConsentTracking(ctx.projectRoot, ctx.sourceFiles),
    detectSecretsInConfig: () => detectSecretsInConfig(ctx.projectRoot, ctx.sourceFiles),
    detectEncryptionAtRest: () => detectEncryptionAtRest(ctx.projectRoot, ctx.sourceFiles),
    detectAccessControls: () => detectAccessControls(ctx.projectRoot, ctx.sourceFiles),
    detectAuditLogging: () => detectAuditLogging(ctx.projectRoot, ctx.sourceFiles),
    detectComplianceReport: () => detectComplianceReport(ctx.projectRoot, ctx.sourceFiles),
  };
}
