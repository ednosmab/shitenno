/**
 * entropy.ts — Entropy Calculation for Engineering State
 *
 * Calculates how "chaotic" a project's knowledge state is
 * based on orphaned assets, stale assets, and missing dependencies.
 */

import type { AssetType, EngineeringAsset } from "../domain/entities/engineering-state.js";
import type { Relation } from "../knowledge-graph.js";
import type { ShitennoLifecycleState } from "../shitenno-state-machine.js";

// ── Constants ──────────────────────────────────────────────────────────────

const STALE_THRESHOLDS_DAYS: Record<AssetType, number> = {
  plan: 15,
  checklist: 15,
  prompt: 15,
  decision: 15,
  doc: 30,
  contract: 30,
  runbook: 30,
  context: 30,
  sdr: 30,
  script: 30,
  feedback: 30,
  rule: 45,
  workflow: 45,
  skill: 45,
  policy: 180,
  adr: 180,
  template: 180,
  report: Infinity,
};

const ORPHAN_EXEMPT_TYPES = new Set<AssetType>(["report", "doc", "adr", "policy"]);

// Minimum sample before ratios are trustworthy — a single orphaned asset in a
// freshly-started project is noise, not degradation (calibrated; revisit against
// real maturity-profile data if available).
const MIN_ASSET_SAMPLE = 8;

// ── Helpers ────────────────────────────────────────────────────────────────

function orphanWeightFor(lifecycle: ShitennoLifecycleState): number {
  if (lifecycle === "uninitialized" || lifecycle === "discovered") return 20;
  if (lifecycle === "governed" || lifecycle === "evolved") return 45;
  return 40;
}

// ── Main ───────────────────────────────────────────────────────────────────

export function calculateEntropy(
  assets: EngineeringAsset[],
  relations: Relation[],
  lifecycle: ShitennoLifecycleState
): { orphanedAssets: number; staleAssets: number; missingDependencies: number; score: number } {
  const now = Date.now();

  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.source);
    connectedIds.add(r.target);
  }

  const orphanedAssets = assets.filter(
    (a) => !connectedIds.has(a.id) && !ORPHAN_EXEMPT_TYPES.has(a.type)
  ).length;

  const staleAssets = assets.filter((a) => {
    const thresholdDays = STALE_THRESHOLDS_DAYS[a.type] ?? 30;
    if (!isFinite(thresholdDays)) return false;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    return now - new Date(a.updatedAt).getTime() > thresholdMs && a.status === "active";
  }).length;

  const assetIds = new Set(assets.map((a) => a.id));
  const missingDependencies = assets.filter((a) =>
    a.dependencies.some((dep) => !assetIds.has(dep))
  ).length;

  const rawTotal = assets.length || 1;
  const totalAssets = Math.max(rawTotal, MIN_ASSET_SAMPLE);
  const orphanWeight = orphanWeightFor(lifecycle);
  const staleWeight = 100 - orphanWeight - 30;

  const orphanRatio = orphanedAssets / totalAssets;
  const staleRatio = staleAssets / totalAssets;
  const depRatio = missingDependencies / totalAssets;

  const score = Math.round(orphanRatio * orphanWeight + staleRatio * staleWeight + depRatio * 30);

  return {
    orphanedAssets,
    staleAssets,
    missingDependencies,
    score: Math.min(100, score),
  };
}
