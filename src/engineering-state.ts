/**
 * engineering-state.ts — Engineering State: Single Source of Truth
 *
 * Consolidates all engineering information into a single canonical state.
 * Thin orchestrator — discovery in engineering-state-discovery.ts,
 * persistence in engineering-state-io.ts, entropy in entropy.ts.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyseProject } from "./analyser.js";
import { detectKnowledgeDebt, type KnowledgeDebtReport } from "./knowledge-debt.js";
import { getEventBus } from "./event-bus.js";
import { logger } from "./logger.js";
import { getKnowledgeHealthScore } from "./health-score-registry.js";
import {
  detectCapabilitySignalsFromFilesystem,
  loadMaturityProfile,
} from "./maturity-profile.js";
import { detectLifecycleState, type ShitennoLifecycleState } from "./shitenno-state-machine.js";
import {
  loadArtifacts,
  loadRelations,
  analyzeGraph,
} from "./knowledge-graph.js";

// ── Types (re-exported from domain entities) ────────────────────────────────

import type { AssetType, EngineeringAsset, EngineeringState } from "./domain/entities/engineering-state.js";

export type { AssetType, EngineeringAsset, EngineeringState } from "./domain/entities/engineering-state.js";

// ── Re-exports from split modules ───────────────────────────────────────────

export { discoverAssets } from "./engineering-state/discovery.js";
export {
  saveEngineeringState,
  loadEngineeringState,
  engineeringStateToText,
} from "./engineering-state/io.js";
export { calculateEntropy } from "./engineering-state/entropy.js";

// ── Import from split modules ───────────────────────────────────────────────

import { discoverAssets } from "./engineering-state/discovery.js";
import {
  saveEngineeringState,
  loadEngineeringState,
} from "./engineering-state/io.js";
import { calculateEntropy } from "./engineering-state/entropy.js";

// ── Main Consolidation ─────────────────────────────────────────────────────

let isConsolidating = false;

function buildReentrantState(projectRoot: string, shitennoDir: string): EngineeringState {
  const cached = loadEngineeringState(shitennoDir);
  if (cached) return cached;

  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle: detectLifecycleState(projectRoot, shitennoDir),
    project: { name: projectRoot.split("/").pop() || "", root: projectRoot, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
    maturity: null,
    capabilities: ["core"],
    capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
    knowledgeDebt: null,
    knowledgeGraph: null,
    assets: [],
    assetsByType: {} as Record<string, number>,
    activeRules: 0,
    activePolicies: 0,
    healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, entropy: 0, overall: 100 },
    entropy: { score: 0, orphanedAssets: 0, staleAssets: 0, missingDependencies: 0 },
    summary: "Re-entrancy: returning minimal state",
  } as EngineeringState;
}

function countAssetsByType(assets: EngineeringAsset[]): Record<AssetType, number> {
  const assetsByType = {} as Record<AssetType, number>;
  for (const asset of assets) {
    assetsByType[asset.type] = (assetsByType[asset.type] || 0) + 1;
  }
  return assetsByType;
}

function countActiveRules(shitennoDir: string): number {
  const rulesDir = join(shitennoDir, "governance", "rules");
  let activeRules = 0;
  if (!existsSync(rulesDir)) return activeRules;
  const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
  for (const file of ruleFiles) {
    try {
      const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
      if (content.enabled) activeRules++;
    } catch {
      logger.debug("engineering-state", "Failed to parse rule file:", file);
    }
  }
  return activeRules;
}

function buildProjectInfo(projectRoot: string, analysis: ReturnType<typeof analyseProject>) {
  return {
    name: projectRoot.split("/").pop() || "",
    root: projectRoot,
    stack: analysis.stack,
    hasGit: analysis.hasGit,
    hasCI: analysis.hasCI,
    hasTests: analysis.hasTests,
    hasTypeScript: analysis.hasTypeScript,
    packageCount: analysis.packageCount,
    sourceFileCount: analysis.sourceFileCount,
    monorepo: analysis.monorepo,
  };
}

function buildKnowledgeDebtInfo(debtReport: KnowledgeDebtReport | null) {
  if (!debtReport) return null;
  return { totalGaps: debtReport.totalGaps, healthScore: debtReport.healthScore, detectedAt: debtReport.generatedAt };
}

function buildKnowledgeGraphInfo(graphAnalysis: ReturnType<typeof analyzeGraph> | null) {
  if (!graphAnalysis) return null;
  return { totalArtifacts: graphAnalysis.totalArtifacts, totalRelations: graphAnalysis.totalRelations, healthScore: graphAnalysis.healthScore };
}

function buildSummaryParts(stats: {
  assetCount: number; capabilityCount: number; overall: number;
  orphanedCount: number; knowledgeGaps: number; lifecycle: string;
}): string {
  const parts: string[] = [];
  parts.push(`${stats.assetCount} assets.`);
  parts.push(`${stats.capabilityCount} capabilities.`);
  parts.push(`Health: ${stats.overall}/100.`);
  if (stats.orphanedCount > 0) parts.push(`${stats.orphanedCount} orphaned.`);
  if (stats.knowledgeGaps > 0) parts.push(`${stats.knowledgeGaps} knowledge gaps.`);
  parts.push(`Lifecycle: ${stats.lifecycle}.`);
  return parts.join(" ");
}

function buildConsolidatedState(ctx: {
  projectRoot: string; shitennoDir: string; lifecycle: ShitennoLifecycleState;
  projectAnalysis: ReturnType<typeof analyseProject>; maturityProfile: ReturnType<typeof loadMaturityProfile>;
  assets: EngineeringAsset[]; graphAnalysis: ReturnType<typeof analyzeGraph> | null;
  debtReport: KnowledgeDebtReport | null; entropy: ReturnType<typeof calculateEntropy>;
}): EngineeringState {
  const installedCapabilities = ctx.maturityProfile?.installedCapabilities ?? ["core"];
  const fsDetected = detectCapabilitySignalsFromFilesystem(ctx.shitennoDir);
  const knowledgeDebtScore = ctx.debtReport?.healthScore ?? 100;
  const knowledgeGraphScore = ctx.graphAnalysis?.healthScore ?? 100;
  const overall = getKnowledgeHealthScore(knowledgeDebtScore, knowledgeGraphScore, ctx.entropy.score).score;
  const assetsByType = countAssetsByType(ctx.assets);
  const activeRules = countActiveRules(ctx.shitennoDir);
  const activePolicies = ctx.assets.filter((a) => a.type === "policy" && a.status === "active").length;

  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle: ctx.lifecycle,
    project: buildProjectInfo(ctx.projectRoot, ctx.projectAnalysis),
    maturity: ctx.maturityProfile,
    capabilities: installedCapabilities,
    capabilityDrift: {
      detectedNotRegistered: fsDetected.filter((c) => !installedCapabilities.includes(c)),
      registeredNotDetected: installedCapabilities.filter((c) => !fsDetected.includes(c)),
    },
    knowledgeDebt: buildKnowledgeDebtInfo(ctx.debtReport),
    knowledgeGraph: buildKnowledgeGraphInfo(ctx.graphAnalysis),
    assets: ctx.assets,
    assetsByType,
    activeRules,
    activePolicies,
    healthScores: { knowledgeDebt: knowledgeDebtScore, knowledgeGraph: knowledgeGraphScore, overall },
    entropy: ctx.entropy,
    summary: buildSummaryParts({
      assetCount: ctx.assets.length, capabilityCount: installedCapabilities.length, overall,
      orphanedCount: ctx.entropy.orphanedAssets, knowledgeGaps: ctx.debtReport?.totalGaps ?? 0,
      lifecycle: ctx.lifecycle,
    }),
  };
}

export function consolidateEngineeringState(
  projectRoot: string,
  shitennoDir: string
): EngineeringState {
  if (isConsolidating) return buildReentrantState(projectRoot, shitennoDir);

  isConsolidating = true;

  try {
    const projectAnalysis = analyseProject(projectRoot);
    const lifecycle = detectLifecycleState(projectRoot, shitennoDir);
    const maturityProfile = loadMaturityProfile(shitennoDir);
    const assets = discoverAssets(shitennoDir);

    const artifacts = loadArtifacts(shitennoDir);
    const relations = loadRelations(shitennoDir);
    const graphAnalysis = artifacts.length > 0 ? analyzeGraph(artifacts, relations) : null;

    let debtReport: KnowledgeDebtReport | null = null;
    try {
      debtReport = detectKnowledgeDebt(projectRoot, shitennoDir);
    } catch {
      logger.debug("engineering-state", "Knowledge debt detection unavailable");
    }

    const entropy = calculateEntropy(assets, relations, lifecycle);
    const state = buildConsolidatedState({
      projectRoot, shitennoDir, lifecycle, projectAnalysis,
      maturityProfile, assets, graphAnalysis, debtReport, entropy,
    });

    getEventBus().publish("entropy.calculated", {
      projectId: projectRoot.split("/").pop() || "",
      entropyScore: entropy.score,
      factors: {
        orphaned: entropy.orphanedAssets,
        stale: entropy.staleAssets,
        missingDeps: entropy.missingDependencies,
      },
      timestamp: new Date().toISOString(),
    });

    getEventBus().publish("engineering_state.consolidated", {
      totalDimensions: 7,
      changedDimensions: [],
      overallHealth: state.healthScores.overall,
      timestamp: new Date().toISOString(),
    });

    return state;
  } finally {
    isConsolidating = false;
  }
}

// ── Reactive Initialization ─────────────────────────────────────────────────

export function initializeEngineeringState(
  projectRoot: string,
  shitennoDir: string
): () => void {
  const bus = getEventBus();

  const reconsolidate = () => {
    const state = consolidateEngineeringState(projectRoot, shitennoDir);
    saveEngineeringState(shitennoDir, state);
    bus.publish("engineering_state.consolidated", {
      consolidatedAt: state.consolidatedAt,
      lifecycle: state.lifecycle,
      overallHealth: state.healthScores.overall,
    });
  };

  const unsubscribers = [
    bus.subscribe("maturity.changed", reconsolidate),
    bus.subscribe("debt.detected", reconsolidate),
    bus.subscribe("knowledge.analyzed", reconsolidate),
    bus.subscribe("lifecycle.state_changed", reconsolidate),
    bus.subscribe("asset.created", reconsolidate),
    bus.subscribe("asset.updated", reconsolidate),
    bus.subscribe("asset.archived", reconsolidate),
  ];

  return () => unsubscribers.forEach((unsub) => unsub());
}
