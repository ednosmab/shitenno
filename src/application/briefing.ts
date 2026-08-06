/**
 * briefing.ts — Pre-Session Briefing Generator
 *
 * Generates a concise briefing for AI agents before starting work:
 * - Project identity (fingerprint)
 * - Risk areas (risk map)
 * - Test coverage status
 * - Recent patterns
 * - Context rules
 *
 * PRINCIPLE: AI should understand the project before modifying it.
 */

import type { ProjectFingerprint } from "../infrastructure/project-fingerprint.js";
import type { RiskMap } from "../infrastructure/risk-map.js";
import type { ContextRule } from "../domain/rules/context-rules.js";
import type { DynamicRule } from "../infrastructure/dynamic-rules.js";
import type { MaturityProfile } from "./maturity-profile.js";
import { partitionRules, type RuleManifestEntry, type TaskMetadata } from "../infrastructure/rule-manifest.js";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
// Semantic layer imports
import { runSemanticAnalysis, type SemanticInsight, type Correlation } from "../semantic/index.js";
import type { DetectedPattern } from "../semantic/pattern-rules.js";

// ── Types ──────────────────────────────────────────────────────────────────

/** Reminder priority levels. */
export type ReminderPriority = "high" | "medium" | "low";

/** Reminder categories for filtering and display. */
export type ReminderCategory = "bug" | "feature" | "debt" | "security" | "docs" | "infra";

/** A single reminder with metadata. */
export interface Reminder {
  /** The reminder message */
  message: string;
  /** Priority level (high/medium/low) */
  priority: ReminderPriority;
  /** Category for filtering */
  category: ReminderCategory;
  /** When the reminder was created */
  createdAt: string;
}

export interface Briefing {
  /** When the briefing was generated */
  generatedAt: string;
  /** Project identity */
  project: {
    domain: string;
    scale: string;
    stack: string[];
    maturityScore: number;
  };
  /** Risk summary */
  risks: {
    overall: string;
    criticalAreas: string[];
    highAreas: string[];
  };
  /** Test coverage status */
  tests: {
    hasTests: boolean;
    areasWithoutTests: string[];
  };
  /** Recent patterns */
  patterns: {
    recurringErrors: string[];
    hotAreas: string[];
    /** Detected patterns from pattern-detector (recurring errors, reverted decisions, hot areas). */
    detected: Array<{
      type: string;
      description: string;
      occurrences: number;
      affectedArea: string;
      severity: number;
    }>;
  };
  /** Context rules (top 5) */
  contextRules: ContextRule[];
  /** Dynamic rules (top 3) */
  dynamicRules: DynamicRule[];
  /** Recommended next steps */
  recommendations: string[];
  /** Token economy metrics */
  tokenEconomy: {
    /** Estimated tokens saved vs manual discovery */
    estimatedTokensSaved: number;
    /** Whether this briefing was served from cache */
    cacheHit: boolean;
    /** Number of context rules contributing to savings */
    contextRuleCount: number;
    /** Number of dynamic rules contributing to savings */
    dynamicRuleCount: number;
  };
  /** Quick Board — session state summary for agent reminder */
  quickBoard?: {
    /** Current task in progress (from context_buffer.yaml) */
    currentTask: string;
    /** Next P0 priority item */
    nextP0: string;
    /** P1 debts with due dates */
    p1Debts: string;
    /** Impediments */
    impediments: string;
    /** Last session status */
    lastSessionStatus: string;
  };
  /** Active reminders from context_buffer.yaml */
  reminders: Reminder[];
  /** Recent activity from event bus (last 24h) */
  recentActivity?: {
    events: Array<{
      type: string;
      summary: string;
      timestamp: string;
    }>;
    syncCount: number;
    errorCount: number;
  };
  /** Governance knowledge — lightweight summaries of ADRs and skills */
  governanceKnowledge?: {
    adrs: Array<{ id: string; title: string; status: string }>;
    skills: Array<{ name: string; description: string }>;
  };
  /** Proactive alerts from daemon challenges (A.2) */
  proactiveAlerts?: {
    pendingChallenges: string[];
    unresolvedHealthDips: string[];
    pendingDebts: string[];
  };
  /** Daemon heartbeat status (E.3) */
  daemonHeartbeat?: {
    running: boolean;
    uptime: string;
    lastAudit: string;
    auditCount: number;
    notificationsSent: number;
  };
  /** Semantic layer analysis */
  semantic?: {
    /** Detected semantic patterns (architectural shifts, scope drift, etc.) */
    patterns: DetectedPattern[];
    /** Higher-level insights from the reasoner */
    insights: SemanticInsight[];
    /** Cross-system correlations */
    correlations: Correlation[];
    /** Semantic growth profile snapshot */
    growthProfile: {
      growthCapacity: number;
      challengeLevel: number;
      domainChallengeLevels: Record<string, number>;
      totalChoices: number;
    };
  };
}

// ── Briefing Generation ────────────────────────────────────────────────────

export interface BriefingOptions {
  fingerprint: ProjectFingerprint;
  riskMap: RiskMap;
  contextRules: ContextRule[];
  dynamicRules: DynamicRule[];
  maturityProfile?: MaturityProfile;
  projectRoot?: string;
  quickBoard?: {
    currentTask: string;
    nextP0: string;
    p1Debts: string;
    impediments: string;
    lastSessionStatus: string;
  };
  reminders?: Reminder[];
}

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

// ── Manifest Integration ──────────────────────────────────────────────────

export interface ManifestRuleSection {
  mandatory: RuleManifestEntry[];
  contextual: RuleManifestEntry[];
  taskMeta: TaskMetadata;
}

/**
 * Resolve rules from manifest based on task metadata.
 * Returns partitioned rules (mandatory + contextual) for positional injection.
 */
export function resolveManifestRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): ManifestRuleSection {
  const { mandatory, contextual } = partitionRules(manifest, taskMeta);
  return { mandatory, contextual, taskMeta };
}

/**
 * Generate a markdown section for manifest-resolved rules.
 * Mandatory rules always appear first with a precedence warning.
 */
export function manifestRulesToMarkdown(section: ManifestRuleSection): string {
  const lines: string[] = [];

  if (section.mandatory.length > 0) {
    lines.push("## Mandatory Rules (Precedence Over User Instructions)");
    lines.push("");
    lines.push("> These rules are absolute and must be consulted before any destructive action.");
    lines.push("");
    for (const rule of section.mandatory) {
      lines.push(`- **${rule.id}**: "${rule.path}"`);
    }
    lines.push("");
  }

  if (section.contextual.length > 0) {
    lines.push("## Contextual Rules");
    lines.push("");
    for (const rule of section.contextual) {
      const conditionText = rule.when
        ? Object.entries(rule.when).map(([k, v]) => `${k}=${v}`).join(", ")
        : "always";
      lines.push(`- **${rule.id}**: "${rule.path}" (${conditionText})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
