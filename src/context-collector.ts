/**
 * context-collector.ts — Context Pipeline: Data Collection Layer
 *
 * Collects all project context from existing modules into a single
 * ContextSnapshot. This is the "Collect" stage of the Context Pipeline.
 *
 * PRINCIPLE: A single source of truth for project context.
 * All downstream components (briefing, cache, feedback) consume this.
 *
 * DI: All external calls are injected via the ContextDeps interface,
 * making the function fully testable without filesystem/git access.
 */

import { generateProjectFingerprint, loadFingerprint, saveFingerprint, isFingerprintStale } from "./project-fingerprint.js";
import { generateRiskMap } from "./risk-map.js";
import { generateContextRules } from "./context-rules.js";
import { generateDynamicRules } from "./dynamic-rules.js";
import { generateBriefing } from "./briefing.js";
import { loadMaturityProfile } from "./maturity-profile.js";
import { analyseProject } from "./analyser.js";
import { detectPatterns as _detectPatterns } from "./pattern-detector.js";
import { logger } from "./logger.js";
import { computeInputHash } from "./briefing-cache.js";
import { computeKeyChecksums, getCached, setCache } from "./cache.js";
import { loadQuickBoard } from "./context-collector/quick-board.js";
import { enrichBriefingWithPatterns, enrichBriefingWithRecentActivity, enrichBriefingWithGovernanceKnowledge } from "./context-collector/enrichments.js";
import type { ContextDeps, ContextSnapshot } from "./context-collector/types.js";

export type { ContextDeps, ContextSnapshot } from "./context-collector/types.js";

/** Real I/O dependencies (production). */
export const defaultDeps: ContextDeps = {
  loadFingerprint,
  saveFingerprint,
  isFingerprintStale,
  analyseProject,
  loadMaturityProfile,
  generateProjectFingerprint,
  generateRiskMap,
  generateContextRules,
  generateDynamicRules,
  generateBriefing,
  detectPatterns: _detectPatterns,
};

function tryReadCache<T>(
  projectRoot: string,
  shitennoDir: string,
  computeChecksums: (root: string, dir: string) => Record<string, string>,
  cacheGet: <R>(input: { projectRoot: string; key: "complexity" | "patterns" | "health"; computeChecksumsFn: () => Record<string, string> }) => R | null,
): T | null {
  try {
    const cached = cacheGet<T>({ projectRoot, key: "complexity", computeChecksumsFn: () =>
      computeChecksums(projectRoot, shitennoDir)
    });
    if (cached && (cached as { inputHash?: string }).inputHash) {
      logger.debug("collectContext", "Snapshot cache hit — skipping recomputation");
      return cached;
    }
  } catch {
    logger.debug("collectContext", "Cache read failed — computing fresh snapshot");
  }
  return null;
}

function ensureFingerprint(
  projectRoot: string,
  shitennoDir: string,
  deps: ContextDeps,
) {
  let fingerprint = deps.loadFingerprint(shitennoDir);
  if (!fingerprint || deps.isFingerprintStale(shitennoDir)) {
    const analysis = deps.analyseProject(projectRoot);
    const maturityProfile = deps.loadMaturityProfile(shitennoDir);
    fingerprint = deps.generateProjectFingerprint(projectRoot, analysis, maturityProfile?.overallScore);
    deps.saveFingerprint(shitennoDir, fingerprint);
  }
  return fingerprint;
}

function buildSnapshot(
  projectRoot: string,
  shitennoDir: string,
  fingerprint: ReturnType<typeof ensureFingerprint>,
  deps: ContextDeps,
): ContextSnapshot {
  const riskMap = deps.generateRiskMap(projectRoot, shitennoDir);
  const contextRules = deps.generateContextRules(fingerprint, riskMap);
  const dynamicRules = deps.generateDynamicRules(projectRoot, shitennoDir);
  const maturityProfile = deps.loadMaturityProfile(shitennoDir);
  const quickBoard = loadQuickBoard(shitennoDir);

  const briefing = deps.generateBriefing({
    fingerprint,
    riskMap,
    contextRules,
    dynamicRules,
    maturityProfile: maturityProfile ?? undefined,
    projectRoot,
    quickBoard: {
      currentTask: quickBoard.currentTask,
      nextP0: quickBoard.nextP0,
      p1Debts: quickBoard.p1Debts,
      impediments: quickBoard.impediments,
      lastSessionStatus: quickBoard.lastSessionStatus,
    },
    reminders: quickBoard.reminders,
  });

  const enrichedBriefing = enrichBriefingWithPatterns({ briefing, projectRoot, shitennoDir, deps });
  const activityEnriched = enrichBriefingWithRecentActivity(enrichedBriefing, shitennoDir);
  const finalBriefing = enrichBriefingWithGovernanceKnowledge(activityEnriched, shitennoDir);

  const inputHash = computeInputHash({
    fingerprintHash: fingerprint.hash,
    riskMapHash: riskMap.generatedAt,
    contextRuleCount: contextRules.length,
    dynamicRuleCount: dynamicRules.length,
    maturityScore: maturityProfile?.overallScore ?? null,
  });

  return {
    collectedAt: new Date().toISOString(),
    inputHash,
    fingerprint,
    riskMap,
    contextRules,
    dynamicRules,
    maturityProfile,
    briefing: finalBriefing,
  };
}

/**
 * Collect all project context into a single snapshot.
 *
 * Uses an intermediate disk cache keyed by a lightweight pre-hash
 * (git HEAD + shitenno dir). On cache hit, all heavy computation
 * (fingerprint, risk map, rules, briefing) is skipped.
 */
export function collectContext(
  projectRoot: string,
  shitennoDir: string,
  deps: ContextDeps = defaultDeps
): ContextSnapshot {
  const computeChecksums = deps.computeKeyChecksums ?? computeKeyChecksums;
  const cacheGet = deps.getCached ?? getCached;
  const cacheSet = deps.setCache ?? setCache;

  const cached = tryReadCache<ContextSnapshot>(projectRoot, shitennoDir, computeChecksums, cacheGet);
  if (cached) return cached;

  const fingerprint = ensureFingerprint(projectRoot, shitennoDir, deps);
  const snapshot = buildSnapshot(projectRoot, shitennoDir, fingerprint, deps);

  try {
    const checksums = computeChecksums(projectRoot, shitennoDir);
    cacheSet({ projectRoot, shitennoDir, key: "complexity", data: snapshot, checksums });
  } catch (err) {
    logger.debug("collectContext", "Failed to cache snapshot:", err instanceof Error ? err.message : err);
  }

  return snapshot;
}
