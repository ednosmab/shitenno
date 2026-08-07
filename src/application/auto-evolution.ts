/**
 * auto-evolution.ts — Pilar 10: Evolução Autónoma (barrel)
 *
 * Permite que o Shugo recomende a sua própria evolução.
 * Detect → Assess → Recommend → Confirm → Install → Govern → Automate
 *
 * PRINCÍPIO: O crescimento não depende exclusivamente do usuário.
 * O sistema aprende e recomenda a sua própria evolução.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CAPABILITIES } from "../domain/entities/capability-catalog.js";
import type { EngineeringState } from "./engineering-state.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "./knowledge-debt.js";
import { getAllFeedbackSummaries, adjustConfidence, shouldSuppress, type FeedbackSummary } from "./feedback-loops.js";
import { loadGrowthProfile, type GrowthProfile } from "../infrastructure/growth-profile.js";
import { generateChallengingAlternative, type DualPath } from "./challenge-generator.js";
import { logger } from "../shared/logger.js";
/** Tipo de recomendação. */
export type RecommendationType =
  | "capability_install" | "capability_upgrade" | "knowledge_creation"
  | "governance_enhancement" | "automation_addition" | "debt_remediation"
  | "pattern_extraction" | "architecture_improvement";

/** Prioridade da recomendação. */
export type RecommendationPriority = "urgent" | "high" | "medium" | "low";

/** Uma recomendação de evolução. */
export interface EvolutionRecommendation {
  id: string; type: RecommendationType; priority: RecommendationPriority;
  title: string; description: string; expectedImpact: string; action: string;
  command?: string; affectedArtifacts: string[]; dependencies: string[];
  confidence: number; evidence: string[]; feedbackAdjusted: boolean;
}

/** Resultado da análise de evolução. */
export interface EvolutionReport {
  analyzedAt: string;
  currentState: { maturityScore: number; installedCapabilities: string[]; knowledgeDebtScore: number };
  totalRecommendations: number;
  byType: Record<RecommendationType, number>;
  byPriority: Record<RecommendationPriority, number>;
  recommendations: EvolutionRecommendation[];
  dualPaths: DualPath[];
  growthProfile: GrowthProfile;
  topNextSteps: string[];
  summary: string;
}

// ── Recommendation Generators ───────────────────────────────────────────────

function generateCapabilityRecommendations(state: EngineeringState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 1;
  const recommendedCaps = state.maturity?.recommendedCapabilities ?? [];
  for (const capId of recommendedCaps) {
    const capInfo = CAPABILITIES.find((c) => c.id === capId);
    if (!capInfo) continue;
    recs.push({
      id: `EVO-${String(id++).padStart(3, "0")}`, type: "capability_install", priority: "high",
      title: `Install ${capInfo.name} capability`, description: capInfo.description,
      expectedImpact: `Adds ${capInfo.name.toLowerCase()} governance to your project`,
      action: `Run 'shugo upgrade --capability ${capId}'`, command: `shugo upgrade --capability ${capId}`,
      affectedArtifacts: [`shitenno/ (${capInfo.name})`], dependencies: capInfo.requires.map((r) => `capability:${r}`),
      confidence: 0.8, evidence: ["Maturity profile recommends this capability"], feedbackAdjusted: false,
    });
  }
  return recs;
}

function createAdrRecommendation(id: number): EvolutionRecommendation {
  return { id: `EVO-${String(id).padStart(3, "0")}`, type: "knowledge_creation", priority: "high",
    title: "Create first ADR", description: "No Architecture Decision Records found. ADRs document important decisions.",
    expectedImpact: "Captures decision rationale for future reference", action: "Create an ADR for your most recent architectural decision",
    affectedArtifacts: ["docs/adrs/ADR-001.md"], dependencies: [], confidence: 0.9,
    evidence: ["No ADRs in project", "Project has source files indicating decisions were made"], feedbackAdjusted: false };
}

function createSkillExtractionRecommendation(id: number, adrCount: number): EvolutionRecommendation {
  return { id: `EVO-${String(id).padStart(3, "0")}`, type: "pattern_extraction", priority: "medium",
    title: "Extract skills from ADRs", description: `${adrCount} ADRs exist but no Skills — patterns not extracted`,
    expectedImpact: "Reusable patterns improve consistency across sessions", action: "Review ADRs and extract common patterns into Skills",
    affectedArtifacts: ["docs/skills/"], dependencies: [], confidence: 0.7, evidence: [`${adrCount} ADRs, 0 skills`], feedbackAdjusted: false };
}

function createKnowledgeDebtRecommendation(id: number, criticalGaps: Array<{ description: string; location: string }>): EvolutionRecommendation {
  return { id: `EVO-${String(id).padStart(3, "0")}`, type: "debt_remediation", priority: "urgent",
    title: "Address knowledge debt", description: `${criticalGaps.length} critical/high knowledge gap(s) detected`,
    expectedImpact: "Reduces risk of repeated mistakes and knowledge loss", action: "Review and address critical knowledge gaps",
    affectedArtifacts: criticalGaps.map((g) => g.location), dependencies: [], confidence: 0.95,
    evidence: criticalGaps.map((g) => g.description), feedbackAdjusted: false };
}

function generateKnowledgeRecommendations(state: EngineeringState, debtReport: KnowledgeDebtReport | null): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 100;
  const adrs = state.assets.filter((a) => a.type === "adr");
  const skills = state.assets.filter((a) => a.type === "skill");
  if (adrs.length === 0 && state.project.sourceFileCount > 10) recs.push(createAdrRecommendation(id++));
  if (adrs.length > 3 && skills.length === 0) recs.push(createSkillExtractionRecommendation(id++, adrs.length));
  if (debtReport && debtReport.totalGaps > 0) {
    const criticalGaps = debtReport.gaps.filter((g) => g.severity === "critical" || g.severity === "high");
    if (criticalGaps.length > 0) recs.push(createKnowledgeDebtRecommendation(id++, criticalGaps));
  }
  return recs;
}

function generateGovernanceRecommendations(state: EngineeringState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 200;
  const governanceDocs = state.assets.filter((a) => a.type === "policy" || a.type === "doc");
  const hasWorkflow = governanceDocs.some((d) => d.name === "WORKFLOW.md");
  if (!hasWorkflow && state.capabilities.includes("governance")) {
    recs.push({ id: `EVO-${String(id++).padStart(3, "0")}`, type: "governance_enhancement", priority: "medium",
      title: "Create workflow document", description: "Governance capability installed but no WORKFLOW.md found",
      expectedImpact: "Defines standard session procedures for consistency", action: "Create governance/WORKFLOW.md with session flow",
      affectedArtifacts: ["governance/WORKFLOW.md"], dependencies: ["capability:governance"], confidence: 0.85,
      evidence: ["Governance capability installed", "No WORKFLOW.md"], feedbackAdjusted: false });
  }
  const hasSystemMap = governanceDocs.some((d) => d.name === "SYSTEM_MAP.md");
  if (!hasSystemMap) {
    recs.push({ id: `EVO-${String(id++).padStart(3, "0")}`, type: "governance_enhancement", priority: "low",
      title: "Create system map", description: "No SYSTEM_MAP.md — directory structure not documented",
      expectedImpact: "Helps navigate the governance structure", action: "Create governance/SYSTEM_MAP.md",
      affectedArtifacts: ["governance/SYSTEM_MAP.md"], dependencies: [], confidence: 0.6,
      evidence: ["No SYSTEM_MAP.md found"], feedbackAdjusted: false });
  }
  return recs;
}

function generateAutomationRecommendations(state: EngineeringState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 300;
  const scripts = state.assets.filter((a) => a.type === "script");
  if (scripts.length < 3 && state.project.sourceFileCount > 30) {
    recs.push({ id: `EVO-${String(id++).padStart(3, "0")}`, type: "automation_addition", priority: "medium",
      title: "Add more automation scripts", description: `Only ${scripts.length} script(s) for a project with ${state.project.sourceFileCount} files`,
      expectedImpact: "Reduces manual work and human error", action: "Identify repetitive processes and create automation scripts",
      affectedArtifacts: ["shitenno/scripts/"], dependencies: [], confidence: 0.7,
      evidence: [`${scripts.length} scripts, ${state.project.sourceFileCount} source files`], feedbackAdjusted: false });
  }
  return recs;
}

function generateSmartSuggestions(state: EngineeringState): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  let id = 400;
  const scripts = state.assets.filter((a) => a.type === "script");
  const hasRecentDigest = scripts.some((s) => s.name.includes("digest"));
  if (!hasRecentDigest && state.capabilities.includes("governance")) {
    recs.push({ id: `EVO-${String(id++).padStart(3, "0")}`, type: "automation_addition", priority: "low",
      title: "Enable daily digest", description: "No daily digest found — run `shugo digest` to see project health at a glance",
      expectedImpact: "Quick daily health check keeps issues visible", action: "Run `shugo digest` each morning",
      affectedArtifacts: [], dependencies: [], confidence: 0.6, evidence: ["Daily digest not yet used"], feedbackAdjusted: false });
  }
  if (state.capabilities.includes("governance")) {
    const governanceDocs = state.assets.filter((a) => a.type === "policy" || a.type === "doc");
    const hasContextRules = governanceDocs.some((d) => d.name === "CONTEXT_RULES.md");
    if (!hasContextRules) {
      recs.push({ id: `EVO-${String(id++).padStart(3, "0")}`, type: "governance_enhancement", priority: "medium",
        title: "Generate context-aware rules", description: "Context rules adapt governance to your project's specific risk profile",
        expectedImpact: "More targeted governance reduces noise", action: "Run `shugo upgrade --capability governance` to generate context rules",
        affectedArtifacts: ["CONTEXT_RULES.md"], dependencies: ["capability:governance"], confidence: 0.75,
        evidence: ["Context rules not yet generated"], feedbackAdjusted: false });
    }
  }
  return recs;
}

function adjustRecommendationsWithFeedback(recommendations: EvolutionRecommendation[], shitennoDir: string): number {
  const feedbackSummaries = getAllFeedbackSummaries(shitennoDir);
  let suppressedCount = 0;
  for (const rec of recommendations) {
    const summary = feedbackSummaries[rec.id] as FeedbackSummary | undefined;
    if (!summary) continue;
    if (shouldSuppress(summary)) { rec.confidence = 0; rec.feedbackAdjusted = true; suppressedCount++; continue; }
    if (summary.acceptCount > 0) { rec.confidence = adjustConfidence(rec.confidence, "accepted"); rec.feedbackAdjusted = true; }
    if (summary.rejectCount > 0) { rec.confidence = adjustConfidence(rec.confidence, "rejected"); rec.feedbackAdjusted = true; }
  }
  return suppressedCount;
}

function buildDualPaths(recommendations: EvolutionRecommendation[], growthProfile: GrowthProfile): DualPath[] {
  return recommendations.map((rec) => ({
    comfortable: rec, challenging: generateChallengingAlternative(rec, growthProfile),
    challengeLevel: growthProfile.challengeLevel ?? "medium",
  }));
}

function countByPriority(recommendations: EvolutionRecommendation[]): Record<RecommendationPriority, number> {
  const byPriority: Record<RecommendationPriority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const rec of recommendations) byPriority[rec.priority]++;
  return byPriority;
}

function buildSummary(
  input: { recommendations: EvolutionRecommendation[]; byPriority: Record<RecommendationPriority, number>;
    suppressedCount: number; state: EngineeringState; debtReport: KnowledgeDebtReport | null; growthProfile: GrowthProfile }
): string {
  const { recommendations, byPriority, suppressedCount, state, debtReport, growthProfile } = input;
  const parts: string[] = [`${recommendations.length} recommendation(s).`];
  if (byPriority.urgent) parts.push(`${byPriority.urgent} urgent.`);
  if (byPriority.high) parts.push(`${byPriority.high} high.`);
  if (suppressedCount > 0) parts.push(`${suppressedCount} suppressed by feedback.`);
  parts.push(`Maturity: ${state.maturity?.overallScore || 0}/100.`);
  parts.push(`Debt: ${debtReport?.healthScore || 100}/100.`);
  parts.push(`Growth capacity: ${Math.round((growthProfile.growthCapacity ?? 0.5) * 100)}%.`);
  return parts.join(" ");
}

/** Executa análise de evolução autónoma. */
export function analyzeEvolution(state: EngineeringState, projectRoot: string, shitennoDir: string): EvolutionReport {
  let debtReport: KnowledgeDebtReport | null = null;
  try { debtReport = detectKnowledgeDebt(projectRoot, shitennoDir); }
  catch (err) { logger.debug("auto-evolution", "Knowledge debt detection unavailable:", err instanceof Error ? err.message : err); }

  const allRecommendations: EvolutionRecommendation[] = [
    ...generateCapabilityRecommendations(state), ...generateKnowledgeRecommendations(state, debtReport),
    ...generateGovernanceRecommendations(state), ...generateAutomationRecommendations(state),
    ...generateSmartSuggestions(state),
  ];
  const suppressedCount = adjustRecommendationsWithFeedback(allRecommendations, shitennoDir);
  const recommendations = allRecommendations.filter((r) => r.confidence > 0);
  recommendations.sort((a, b) => ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] - { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority]));

  const growthProfile = loadGrowthProfile(shitennoDir);
  const dualPaths = buildDualPaths(recommendations, growthProfile);
  const byType = {} as Record<RecommendationType, number>;
  const byPriority = countByPriority(recommendations);
  for (const rec of recommendations) byType[rec.type] = (byType[rec.type] || 0) + 1;
  const topNextSteps = recommendations.filter((r) => r.priority === "urgent" || r.priority === "high").slice(0, 5).map((r) => r.command || r.action);

  return {
    analyzedAt: new Date().toISOString(),
    currentState: { maturityScore: state.maturity?.overallScore || 0, installedCapabilities: state.capabilities, knowledgeDebtScore: debtReport?.healthScore || 100 },
    totalRecommendations: recommendations.length, byType, byPriority, recommendations, dualPaths, growthProfile, topNextSteps,
    summary: buildSummary({ recommendations, byPriority, suppressedCount, state, debtReport, growthProfile }),
  };
}

/** Grava relatório de evolução. */
export function writeEvolutionReport(shitennoDir: string, report: EvolutionReport): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;
  const date = new Date().toISOString().slice(0, 10);
  const filename = `evolution-${date}.json`;
  const filepath = join(reportsDir, filename);
  try { writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8"); return filename; }
  catch { return null; }
}
