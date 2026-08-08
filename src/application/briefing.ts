/**
 * briefing.ts — Pre-Session Briefing Generator (barrel)
 *
 * Generates a concise briefing for AI agents before starting work:
 * - Project identity (fingerprint)
 * - Risk areas (risk map)
 * - Test coverage status
 * - Recent patterns
 * - Context rules
 *
 * PRINCIPLE: AI should understand the project before modifying it.
 *
 * Split layout:
 *   - types:    ./briefing-types.js    — briefing document types
 *   - manifest: ./briefing-manifest.js — manifest rule resolution
 */

import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import { runSemanticAnalysis } from "../semantic/index.js";
import type { MaturityProfile } from "./maturity-profile.js";
import type { Briefing, BriefingOptions } from "./briefing-types.js";

// ── Briefing Generation ────────────────────────────────────────────────────

function generateRecommendations(
  criticalAreas: string[],
  areasWithoutTests: string[],
  maturityProfile?: MaturityProfile,
): string[] {
  const recommendations: string[] = [];
  if (criticalAreas.length > 0) recommendations.push(`Address critical risk areas: ${criticalAreas.join(", ")}`);
  if (areasWithoutTests.length > 0) recommendations.push(`Improve test coverage in ${areasWithoutTests.length} area(s)`);
  if (maturityProfile?.recommendedCapabilities?.length) {
    recommendations.push(`Consider installing: ${maturityProfile.recommendedCapabilities.slice(0, 3).join(", ")}`);
  }
  if (recommendations.length === 0) recommendations.push("Project looks healthy. Continue current practices.");
  return recommendations;
}

function readDaemonState(shitennoDir: string): { proactiveAlerts?: Briefing["proactiveAlerts"]; daemonHeartbeat?: Briefing["daemonHeartbeat"] } {
  const statePath = join(shitennoDir, "daemon", "state.json");
  if (!existsSync(statePath)) return { daemonHeartbeat: { running: false, uptime: "N/A", lastAudit: "N/A", auditCount: 0, notificationsSent: 0 } };
  const state = JSON.parse(readFileSync(statePath, "utf-8"));
  const proactiveAlerts = state.challenges && Array.isArray(state.challenges) ? {
    pendingChallenges: state.challenges.filter((c: { resolved?: boolean }) => !c.resolved).slice(0, 5).map((c: { message?: string; id?: string }) => c.message ?? c.id ?? "Unknown challenge"),
    unresolvedHealthDips: state.health?.recentDips ?? [],
    pendingDebts: (state.engineeringState?.debts ?? []).filter((d: { resolved?: boolean }) => !d.resolved).slice(0, 3).map((d: { description?: string }) => d.description ?? "Unknown debt"),
  } : undefined;
  const uptimeMs = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0;
  const daemonHeartbeat = {
    running: true, uptime: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
    lastAudit: state.lastAuditTime ?? "Never", auditCount: state.auditCount ?? 0, notificationsSent: state.notificationsSent ?? 0,
  };
  return { proactiveAlerts, daemonHeartbeat };
}

function runSemanticBriefing(shitennoDir: string, projectRoot: string): Briefing["semantic"] | undefined {
  const { profile, patterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
  return {
    patterns, insights, correlations,
    growthProfile: { growthCapacity: profile.growthCapacity, challengeLevel: profile.challengeLevel, domainChallengeLevels: profile.domainChallengeLevels, totalChoices: profile.semanticChoices.length },
  };
}

export function generateBriefing(options: BriefingOptions): Briefing {
  const { fingerprint, riskMap, contextRules, dynamicRules, maturityProfile, quickBoard } = options;
  const reminders = options.reminders ?? [];
  const shitennoDir = options.projectRoot ? join(options.projectRoot, SHITENNO_DIR_NAME) : undefined;
  const criticalAreas = riskMap.areas.filter((a) => a.riskLevel === "critical").map((a) => a.path);
  const highAreas = riskMap.areas.filter((a) => a.riskLevel === "high").map((a) => a.path);
  const areasWithoutTests = riskMap.areas.flatMap((a) => a.factors).filter((f) => f.type === "no-tests").map((f) => f.description).slice(0, 5);
  const recommendations = generateRecommendations(criticalAreas, areasWithoutTests, maturityProfile);
  const estimatedTokensSaved = 8000 + (contextRules.length * 400) + (dynamicRules.length * 400);
  let proactiveAlerts: Briefing["proactiveAlerts"] | undefined;
  let daemonHeartbeat: Briefing["daemonHeartbeat"] | undefined;
  let semantic: Briefing["semantic"] | undefined;
  if (shitennoDir) {
    try { ({ proactiveAlerts, daemonHeartbeat } = readDaemonState(shitennoDir)); } catch { daemonHeartbeat = { running: false, uptime: "Error reading state", lastAudit: "N/A", auditCount: 0, notificationsSent: 0 }; }
    try { semantic = runSemanticBriefing(shitennoDir, options.projectRoot ?? ""); } catch { /* non-critical */ }
  }
  const hotAreas = riskMap.areas.filter((a) => a.factors.some((f) => f.type === "high-churn")).map((a) => a.path);
  const detected = semantic?.patterns.map((p) => ({ type: p.type, description: p.description, occurrences: 1, affectedArea: p.domain, severity: Math.round(p.confidence * 5) })) ?? [];
  return {
    generatedAt: new Date().toISOString(),
    project: { domain: fingerprint.domain, scale: fingerprint.scale, stack: fingerprint.stack.slice(0, 5), maturityScore: maturityProfile?.overallScore ?? 0 },
    risks: { overall: riskMap.overallRisk, criticalAreas, highAreas },
    tests: { hasTests: fingerprint.tooling.tests, areasWithoutTests },
    patterns: { recurringErrors: [], hotAreas, detected },
    contextRules: contextRules.slice(0, 5), dynamicRules: dynamicRules.slice(0, 3), recommendations,
    tokenEconomy: { estimatedTokensSaved, cacheHit: false, contextRuleCount: contextRules.length, dynamicRuleCount: dynamicRules.length },
    quickBoard: quickBoard ?? { currentTask: "Nenhuma", nextP0: "Definir novo P0 no BACKLOG.md", p1Debts: "Nenhuma", impediments: "Nenhum", lastSessionStatus: "Desconhecido" },
    reminders, proactiveAlerts, daemonHeartbeat, semantic,
  };
}

// ── Re-exports for backward compatibility ────────────────────────────────
export { briefingToJson, briefingToSummary, briefingToMarkdown } from "../domain/types/briefing-formatter.js";
export { generateDiff } from "../domain/rules/briefing-diff.js";
export {
  resolveManifestRules,
  manifestRulesToMarkdown,
  type ManifestRuleSection,
} from "./briefing-manifest.js";
export type {
  ReminderPriority,
  ReminderCategory,
  Reminder,
  Briefing,
  BriefingOptions,
} from "./briefing-types.js";
