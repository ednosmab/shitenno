/**
 * token-optimizer.ts — Context Pipeline: Token Optimization Strategies
 *
 * Implements strategies to further reduce token consumption:
 * - Adaptive briefing depth based on task complexity
 * - Differential updates (only changed sections)
 * - Compression hints for AI agents
 *
 * PRINCIPLE: Every token must earn its place.
 */

import type { Briefing } from "../../application/briefing.js";
export type { Briefing };

// ── Types ──────────────────────────────────────────────────────────────────

export type { BriefingDepth } from "../types/briefing.js";
import type { BriefingDepth } from "../types/briefing.js";

export interface OptimizationHints {
  /** Suggested briefing depth based on task analysis */
  suggestedDepth: BriefingDepth;
  /** Sections that can be skipped */
  skipSections: string[];
  /** Sections that should be compressed */
  compressSections: string[];
  /** Estimated tokens at each depth */
  tokenEstimates: Record<BriefingDepth, number>;
}

// ── Depth Selection ────────────────────────────────────────────────────────

/**
 * Determine optimal briefing depth based on risk and task scope.
 * Pure function — easy to test.
 */
export function suggestDepth(
  riskLevel: string,
  hasCriticalAreas: boolean,
  areaCount: number
): BriefingDepth {
  if (hasCriticalAreas || riskLevel === "critical") return "full";
  if (riskLevel === "high" || areaCount > 3) return "standard";
  return "minimal";
}

/**
 * Generate optimization hints for a briefing.
 * Pure function — easy to test.
 */
export function generateOptimizationHints(briefing: Briefing): OptimizationHints {
  const hasCriticalAreas = briefing.risks.criticalAreas.length > 0;
  const areaCount = briefing.risks.criticalAreas.length + briefing.risks.highAreas.length;

  const suggestedDepth = suggestDepth(
    briefing.risks.overall,
    hasCriticalAreas,
    areaCount
  );

  const skipSections: string[] = [];
  const compressSections: string[] = [];

  // For minimal depth, skip dynamic rules and patterns
  if (suggestedDepth === "minimal") {
    skipSections.push("dynamicRules", "patterns", "contextRules");
  }

  // For standard depth, compress rules to IDs only
  if (suggestedDepth === "standard") {
    compressSections.push("contextRules", "dynamicRules");
  }

  // Estimate tokens at each depth
  const baseTokens = 200; // project identity + risks
  const fullBriefingTokens = briefingToJsonSize(briefing);

  const tokenEstimates: Record<BriefingDepth, number> = {
    minimal: baseTokens,
    standard: Math.round(baseTokens + (fullBriefingTokens - baseTokens) * 0.5),
    full: fullBriefingTokens,
  };

  return {
    suggestedDepth,
    skipSections,
    compressSections,
    tokenEstimates,
  };
}

// ── Compressed Output ──────────────────────────────────────────────────────

/**
 * Generate a compressed briefing summary optimized for minimal tokens.
 * ~200 tokens vs ~500 for standard summary.
 */
export function compressedSummary(briefing: Briefing): string {
  const parts: string[] = [];
  parts.push(`${briefing.project.domain}:${briefing.project.scale}`);
  parts.push(`risk=${briefing.risks.overall}`);

  if (briefing.risks.criticalAreas.length > 0) {
    parts.push(`critical=${briefing.risks.criticalAreas.join(",")}`);
  }

  if (briefing.tests.areasWithoutTests.length > 0) {
    parts.push(`notest=${briefing.tests.areasWithoutTests.length}`);
  }

  parts.push(`recs=${briefing.recommendations.length}`);

  if (briefing.tokenEconomy.estimatedTokensSaved > 0) {
    parts.push(`saved=~${briefing.tokenEconomy.estimatedTokensSaved}`);
  }

  return parts.join(" | ");
}

/**
 * Generate differential briefing (only changes since last session).
 * Much smaller than full briefing for incremental sessions.
 */
export function differentialBriefing(
  oldBriefing: Briefing | null,
  newBriefing: Briefing
): string {
  if (!oldBriefing) return compressedSummary(newBriefing);

  const changes: string[] = [];

  if (oldBriefing.risks.overall !== newBriefing.risks.overall) {
    changes.push(`risk:${oldBriefing.risks.overall}→${newBriefing.risks.overall}`);
  }

  const oldCritical = new Set(oldBriefing.risks.criticalAreas);
  const newCritical = new Set(newBriefing.risks.criticalAreas);
  const addedCritical = [...newCritical].filter((a) => !oldCritical.has(a));
  const removedCritical = [...oldCritical].filter((a) => !newCritical.has(a));

  if (addedCritical.length > 0) changes.push(`+critical:${addedCritical.join(",")}`);
  if (removedCritical.length > 0) changes.push(`-critical:${removedCritical.join(",")}`);

  const oldRecs = new Set(oldBriefing.recommendations);
  const newRecs = newBriefing.recommendations.filter((r) => !oldRecs.has(r));
  if (newRecs.length > 0) changes.push(`+recs:${newRecs.length}`);

  if (changes.length === 0) return "no-changes";

  return `delta:${changes.join(";")}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function briefingToJsonSize(briefing: Briefing): number {
  // Rough estimate: each field ~50 tokens, rules ~100 tokens each
  let size = 200; // base
  size += briefing.contextRules.length * 100;
  size += briefing.dynamicRules.length * 80;
  size += briefing.recommendations.length * 30;
  return size;
}
