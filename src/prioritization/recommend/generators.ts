/**
 * generators.ts — Individual recommendation generators.
 */

import type { EngineeringState, AssetType } from "../../application/engineering-state.js";
import type { CapabilityEngineResult } from "../../application/capability-engine.js";
import type { KnowledgeDebtReport } from "../../application/knowledge-debt.js";
import type { PatternDetectionReport } from "../../infrastructure/pattern-detector.js";
import type { Recommendation } from "./types.js";

export function generateFromCapabilityEngine(
  capResult: CapabilityEngineResult
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const capRec of capResult.recommendations) {
    recs.push({
      id: `REC-CAP-${capRec.capability.toUpperCase()}`,
      source: "capability_engine",
      type: capRec.action,
      priority: capRec.priority,
      title: `${capRec.action.charAt(0).toUpperCase() + capRec.action.slice(1)} ${capRec.capability} capability`,
      description: capRec.reason,
      expectedImpact: capRec.expectedImpact,
      action: `Activate and configure ${capRec.capability} capability`,
      command: `shugo upgrade --capability ${capRec.capability}`,
      affectedArtifacts: [`shitenno/ (${capRec.capability})`],
      dependencies: capRec.dependencies.map((d) => `REC-CAP-${d.toUpperCase()}`),
      confidence: 0.8,
      evidence: [capRec.reason],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

export function generateFromKnowledgeDebt(
  debtReport: KnowledgeDebtReport | null
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!debtReport || debtReport.totalGaps === 0) return recs;

  const criticalGaps = debtReport.gaps.filter(
    (g) => g.severity === "critical" || g.severity === "high"
  );

  if (criticalGaps.length > 0) {
    recs.push({
      id: "REC-DEBT-CRITICAL",
      source: "knowledge_debt",
      type: "debt_remediation",
      priority: "urgent",
      title: "Address critical knowledge debt",
      description: `${criticalGaps.length} critical/high knowledge gap(s) detected`,
      expectedImpact: "Reduces risk of repeated mistakes and knowledge loss",
      action: "Review and address critical knowledge gaps",
      affectedArtifacts: criticalGaps.map((g) => g.location),
      dependencies: [],
      confidence: 0.95,
      evidence: criticalGaps.map((g) => g.description),
      generatedAt: new Date().toISOString(),
    });
  }

  for (const gap of debtReport.gaps.slice(0, 5)) {
    recs.push({
      id: `REC-DEBT-${gap.id}`,
      source: "knowledge_debt",
      type: gap.type,
      priority: gap.severity === "critical" ? "urgent" : gap.severity === "high" ? "high" : "medium",
      title: gap.recommendation,
      description: gap.description,
      expectedImpact: `Resolves ${gap.type.replace(/_/g, " ")} gap`,
      action: gap.recommendation,
      affectedArtifacts: [gap.location],
      dependencies: gap.severity === "critical" ? ["REC-DEBT-CRITICAL"] : [],
      confidence: 0.7,
      evidence: [gap.description],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

export function generateFromPatternDetection(
  patternReport: PatternDetectionReport | null
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!patternReport || patternReport.patterns.length === 0) return recs;

  for (const pattern of patternReport.patterns.slice(0, 3)) {
    if (pattern.severity >= 3) {
      recs.push({
        id: `REC-PATTERN-${pattern.type.toUpperCase()}`,
        source: "pattern_detection",
        type: "pattern_response",
        priority: pattern.severity >= 4 ? "high" : "medium",
        title: `Address ${pattern.type.replace(/_/g, " ")} pattern`,
        description: pattern.description,
        expectedImpact: "Prevents recurring issues",
        action: pattern.evidence[0] || "Review pattern and take corrective action",
        affectedArtifacts: [pattern.affectedArea],
        dependencies: [],
        confidence: 0.6,
        evidence: pattern.evidence,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return recs;
}

export function generateFromEntropy(
  state: EngineeringState
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (state.entropy.orphanedAssets > 3) {
    recs.push({
      id: "REC-ENTROPY-ORPHANS",
      source: "entropy_reduction",
      type: "entropy_reduction",
      priority: "medium",
      title: "Connect orphaned assets",
      description: `${state.entropy.orphanedAssets} assets have no relations — knowledge is fragmented`,
      expectedImpact: "Improves knowledge graph connectivity and discoverability",
      action: "Add relations between orphaned assets in the knowledge graph",
      affectedArtifacts: state.assets
        .filter((_a) => !state.knowledgeGraph || true)
        .slice(0, state.entropy.orphanedAssets)
        .map((a) => a.path),
      dependencies: [],
      confidence: 0.65,
      evidence: [`${state.entropy.orphanedAssets} orphaned assets detected`],
      generatedAt: new Date().toISOString(),
    });
  }

  if (state.entropy.score > 50) {
    recs.push({
      id: "REC-ENTROPY-HIGH",
      source: "entropy_reduction",
      type: "entropy_reduction",
      priority: "high",
      title: "Reduce organizational entropy",
      description: `Entropy score is ${state.entropy.score}/100 — significant organizational decay`,
      expectedImpact: "Preserves engineering organization and knowledge",
      action: "Review and clean up stale assets, connect orphaned artifacts",
      affectedArtifacts: [],
      dependencies: [],
      confidence: 0.8,
      evidence: [`Entropy score: ${state.entropy.score}/100`],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

export function generateFromAIReadiness(
  state: EngineeringState
): Recommendation[] {
  const recs: Recommendation[] = [];

  const hasAgentContracts = state.assets.some((a) => a.type === "contract");
  const hasPrompts = state.assets.some((a) => a.type === "prompt");

  if (!hasAgentContracts && state.project.sourceFileCount > 50) {
    recs.push({
      id: "REC-AI-CONTRACTS",
      source: "ai_readiness",
      type: "ai_readiness",
      priority: "medium",
      title: "Add AI agent contracts",
      description: "Project has significant code but no AI agent contracts",
      expectedImpact: "Enables structured AI assistance with defined roles",
      action: "Create AI agent contracts for planner, executor, and reviewer roles",
      command: "shugo upgrade --capability ai",
      affectedArtifacts: ["governance/agents/"],
      dependencies: [],
      confidence: 0.7,
      evidence: [`${state.project.sourceFileCount} source files, no agent contracts`],
      generatedAt: new Date().toISOString(),
    });
  }

  if (!hasPrompts && hasAgentContracts) {
    recs.push({
      id: "REC-AI-PROMPTS",
      source: "ai_readiness",
      type: "ai_readiness",
      priority: "low",
      title: "Add AI prompts",
      description: "Agent contracts exist but no structured prompts",
      expectedImpact: "Improves AI interaction quality",
      action: "Create structured prompts for each agent role",
      affectedArtifacts: ["cognition/prompts/"],
      dependencies: ["REC-AI-CONTRACTS"],
      confidence: 0.5,
      evidence: ["Agent contracts exist, no prompts"],
      generatedAt: new Date().toISOString(),
    });
  }

  return recs;
}

export function generateFromAssetManagement(
  state: EngineeringState
): Recommendation[] {
  const recs: Recommendation[] = [];

  const assetTypes = new Set(state.assets.map((a) => a.type));
  const criticalAssets: AssetType[] = ["adr", "skill", "workflow", "contract"];

  for (const assetType of criticalAssets) {
    if (!assetTypes.has(assetType)) {
      recs.push({
        id: `REC-ASSET-${assetType.toUpperCase()}`,
        source: "asset_management",
        type: "asset_creation",
        priority: assetType === "workflow" ? "high" : "medium",
        title: `Create ${assetType} assets`,
        description: `No ${assetType} assets found in the project`,
        expectedImpact: `Adds ${assetType} governance to the project`,
        action: `Create initial ${assetType} asset`,
        affectedArtifacts: [],
        dependencies: [],
        confidence: 0.6,
        evidence: [`No ${assetType} assets in project`],
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return recs;
}
