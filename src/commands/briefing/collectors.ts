/**
 * commands/briefing/collectors.ts — Data collection and cache management
 *
 * Extracted from commands/briefing.ts to keep modules focused.
 */

import { collectContext, type ContextSnapshot } from "../../application/context-collector.js";
import { computeInputHash, setCachedBriefing, invalidateBriefingCache, readCache } from "../../infrastructure/briefing-cache.js";
import { type Briefing } from "../../application/briefing.js";
import { compressedSummary, differentialBriefing, suggestDepth, type BriefingDepth } from "../../domain/rules/token-optimizer.js";
import { outputJson } from "../../shared/formatting.js";
import { output } from "../../shared/output.js";
import { isDaemonRunning, queryDaemon } from "../../infrastructure/daemon-client.js";

// ── Data Collection ─────────────────────────────────────────────────────────

export async function collectBriefingData(
  projectRoot: string,
  shitennoDir: string
): Promise<{ briefing: Briefing; snapshot: ReturnType<typeof collectContext> }> {
  if (isDaemonRunning(shitennoDir)) {
    const daemonResult = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    if (daemonResult?.data) {
      const briefing = daemonResult.data;
      const snapshot = { briefing, contextRules: [], dynamicRules: [], fingerprint: { hash: "" }, riskMap: { generatedAt: "" }, collectedAt: new Date().toISOString(), inputHash: "", maturityProfile: null } as unknown as ContextSnapshot;
      return { briefing, snapshot };
    }
  }
  const snapshot = collectContext(projectRoot, shitennoDir);
  return { briefing: snapshot.briefing, snapshot };
}

// ── Cache Management ────────────────────────────────────────────────────────

export function cacheBriefing(
  shitennoDir: string,
  briefing: Briefing,
  snapshot: ReturnType<typeof collectContext>,
  invalidate: boolean
): { briefing: Briefing; cacheHit: boolean; inputHash: string; previousBriefing: Briefing | null } {
  const newInputHash = computeInputHash({
    fingerprintHash: snapshot.fingerprint.hash,
    riskMapHash: snapshot.riskMap.generatedAt,
    contextRuleCount: snapshot.contextRules.length,
    dynamicRuleCount: snapshot.dynamicRules.length,
    maturityScore: snapshot.maturityProfile?.overallScore ?? null,
  });

  const oldCache = readCache(shitennoDir);
  const previousBriefing = oldCache?.entry?.briefing ?? null;

  if (invalidate) {
    invalidateBriefingCache(shitennoDir);
  }

  let cacheHit = false;

  if (!invalidate && oldCache?.entry && oldCache.entry.inputHash === newInputHash) {
    briefing = oldCache.entry.briefing;
    cacheHit = true;
  }

  if (!cacheHit) {
    setCachedBriefing(shitennoDir, briefing, newInputHash);
  }

  return { briefing, cacheHit, inputHash: newInputHash, previousBriefing };
}

// ── Depth Determination ─────────────────────────────────────────────────────

export function determineBriefingDepth(
  briefing: Briefing,
  forcedDepth: BriefingDepth | undefined,
  profile: string | undefined
): BriefingDepth {
  if (forcedDepth) {
    return forcedDepth;
  }
  if (profile === "minimal" || profile === "standard" || profile === "full") {
    return profile;
  }
  return suggestDepth(
    briefing.risks.overall,
    briefing.risks.criticalAreas.length > 0,
    briefing.risks.criticalAreas.length + briefing.risks.highAreas.length
  );
}

// ── Mode Handlers ───────────────────────────────────────────────────────────

export function handleDiffMode(
  briefing: Briefing,
  previousBriefing: Briefing | null,
  isJson: boolean
): boolean {
  if (!previousBriefing || previousBriefing.generatedAt === briefing.generatedAt) {
    const msg = "No previous briefing to diff against.";
    if (isJson) {
      outputJson({ type: "diff", message: msg });
    } else {
      output(`  ${msg}`);
    }
    return true;
  }

  const compactDiff = differentialBriefing(previousBriefing, briefing);
  if (isJson) {
    outputJson({
      type: "diff",
      oldTimestamp: previousBriefing.generatedAt,
      newTimestamp: briefing.generatedAt,
      diff: compactDiff,
    });
  } else {
    output(compactDiff);
  }
  return true;
}

export function handleSummaryMode(
  briefing: Briefing,
  isJson: boolean,
  cacheHit: boolean
): boolean {
  const summary = compressedSummary(briefing);
  if (isJson) {
    outputJson({ type: "summary", summary, cacheHit });
  } else {
    output(summary);
  }
  return true;
}
