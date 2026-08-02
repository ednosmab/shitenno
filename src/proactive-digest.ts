/**
 * proactive-digest.ts — Periodic Proactive Digest
 *
 * Generates a proactive digest every 30 minutes (configurable via
 * SHITENNO_PROACTIVE_INTERVAL_MS). Aggregates pending challenges,
 * drift, health trend, and writes .shitenno/daemon/proactive-digest.md.
 *
 * PRINCIPLE: Proactive insights should be surfaced, not buried in logs.
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";
import { queryDaemon, isDaemonRunning } from "./daemon-client.js";
import { logger } from "./logger.js";

const DEFAULT_DIGEST_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface DigestData {
  generatedAt: string;
  challenges: Array<{ type: string; severity: string; description: string }>;
  health: { score: number | null; trend: string } | null;
  drift: { filesChanged: number; minutesSinceLastCommit: number } | null;
  debt: { gapCount: number; healthScore: number } | null;
}

function formatDigest(data: DigestData): string {
  const lines: string[] = ["# Proactive Digest", `*Generated: ${data.generatedAt}*`, ""];
  lines.push(...formatChallenges(data.challenges));
  lines.push(...formatHealth(data.health));
  lines.push(...formatDrift(data.drift));
  lines.push(...formatDebt(data.debt));
  if (!hasAlerts(data)) lines.push("No pending proactive alerts. System is healthy.", "");
  return lines.join("\n");
}

function formatChallenges(challenges: DigestData["challenges"]): string[] {
  if (challenges.length === 0) return [];
  const lines = ["## Pending Challenges"];
  for (const c of challenges) {
    const icon = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
    lines.push(`- ${icon} **${c.type}**: ${c.description}`);
  }
  lines.push("");
  return lines;
}

function formatHealth(health: DigestData["health"]): string[] {
  if (!health) return [];
  const scoreColor = health.score !== null && health.score >= 70 ? "🟢" : health.score !== null && health.score >= 40 ? "🟡" : "🔴";
  return ["## Health", `- Score: ${health.score ?? "N/A"}/100 ${scoreColor}`, `- Trend: ${health.trend}`, ""];
}

function formatDrift(drift: DigestData["drift"]): string[] {
  if (!drift) return [];
  return ["## Drift", `- Files changed: ${drift.filesChanged}`, `- Minutes since last commit: ${drift.minutesSinceLastCommit}`, ""];
}

function formatDebt(debt: DigestData["debt"]): string[] {
  if (!debt) return [];
  return ["## Knowledge Debt", `- Gaps: ${debt.gapCount}`, `- Health score: ${debt.healthScore}/100`, ""];
}

function hasAlerts(data: DigestData): boolean {
  return data.challenges.length > 0 || !!data.drift || (!!data.debt && data.debt.gapCount > 0);
}

function writeDigest(shitennoDir: string, data: DigestData): void {
  const daemonDir = join(shitennoDir, "daemon");
  if (!existsSync(daemonDir)) mkdirSync(daemonDir, { recursive: true });
  const digestPath = join(daemonDir, "proactive-digest.md");
  writeFileSync(digestPath, formatDigest(data), "utf-8");
  logger.info("proactive-digest", `Digest written: ${digestPath}`);
}

async function collectDigestData(shitennoDir: string): Promise<DigestData> {
  const data: DigestData = { generatedAt: new Date().toISOString(), challenges: [], health: null, drift: null, debt: null };
  if (!isDaemonRunning(shitennoDir)) return data;

  try {
    const ch = await queryDaemon<{ type: string; challenges: Array<{ type: string; severity: string; message: string }> }>(shitennoDir, { type: "query_challenges" });
    if (ch?.challenges) data.challenges = ch.challenges.map((c) => ({ type: c.type, severity: c.severity, description: c.message }));
  } catch (err) {
    logger.debug("proactive-digest", `Failed to query challenges: ${err}`);
  }
  try {
    const h = await queryDaemon<{ type: string; score: number | null; trend: string }>(shitennoDir, { type: "query_health" });
    if (h) data.health = { score: h.score, trend: h.trend };
  } catch (err) {
    logger.debug("proactive-digest", `Failed to query health: ${err}`);
  }
  try {
    const d = await queryDaemon<{ type: string; drift: DigestData["drift"] }>(shitennoDir, { type: "query_drift" });
    if (d?.drift) data.drift = d.drift;
  } catch (err) {
    logger.debug("proactive-digest", `Failed to query drift: ${err}`);
  }
  try {
    const debt = await queryDaemon<{ type: string; debt: DigestData["debt"] }>(shitennoDir, { type: "query_debt" });
    if (debt?.debt) data.debt = debt.debt;
  } catch (err) {
    logger.debug("proactive-digest", `Failed to query debt: ${err}`);
  }

  return data;
}

/**
 * Initialize the proactive digest timer.
 * Runs periodically, collects data from daemon, writes digest, publishes event.
 * Returns a stop function for cleanup.
 */
export function initProactiveDigest(shitennoDir: string): () => void {
  const intervalMs = Number(process.env["SHITENNO_PROACTIVE_INTERVAL_MS"]) || DEFAULT_DIGEST_INTERVAL_MS;

  const timer = setInterval(async () => {
    try {
      const data = await collectDigestData(shitennoDir);
      writeDigest(shitennoDir, data);
      getEventBus().publish("proactive.digest_ready", {
        challengeCount: data.challenges.length,
        healthScore: data.health?.score ?? null,
      });
    } catch (err) {
      logger.error("proactive-digest", `Digest generation failed: ${err}`);
    }
  }, intervalMs);

  // Unref the timer so it doesn't keep the process alive
  if (timer.unref) timer.unref();

  logger.info("proactive-digest", `Initialized — interval: ${intervalMs / 1000}s`);

  return () => clearInterval(timer);
}
