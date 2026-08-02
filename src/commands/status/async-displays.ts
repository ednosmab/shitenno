/**
 * commands/status/async-displays.ts — Async display functions (use dynamic imports)
 *
 * Extracted from commands/status.ts to keep modules focused.
 */

import chalk from "chalk";
import { output, outputBlank } from "../../output.js";
import { queryDaemon, isDaemonRunning } from "../../daemon-client.js";
import { logger } from "../../logger.js";

// ── Fingerprint Display ─────────────────────────────────────────────────────

import type { ProjectAnalysis } from "../../analyser.js";

export async function displayFingerprint(
  projectRoot: string,
  shitennoDir: string,
  analysis: ProjectAnalysis,
  overallScore: number | undefined,
): Promise<void> {
  const { loadFingerprint, isFingerprintStale, generateProjectFingerprint, saveFingerprint } = await import("../../project-fingerprint.js");
  const staleFingerprint = isFingerprintStale(shitennoDir);
  let fingerprint = loadFingerprint(shitennoDir);
  if (!fingerprint || staleFingerprint) {
    fingerprint = generateProjectFingerprint(projectRoot, analysis, overallScore);
    saveFingerprint(shitennoDir, fingerprint);
  }
  if (fingerprint) {
    output(chalk.bold("  🔍 Project Fingerprint:"));
    output(chalk.gray(`    Domain:    ${fingerprint.domain}`));
    output(chalk.gray(`    Scale:     ${fingerprint.scale}`));
    output(chalk.gray(`    Stack:     ${fingerprint.stack.slice(0, 5).join(", ")}${fingerprint.stack.length > 5 ? ` (+${fingerprint.stack.length - 5})` : ""}`));
    output(chalk.gray(`    Hash:      ${fingerprint.hash}`));
    outputBlank();
  }
}

// ── Briefing Display ────────────────────────────────────────────────────────

export async function displayBriefing(projectRoot: string, shitennoDir: string): Promise<void> {
  try {
    const { collectContext } = await import("../../context-collector.js");
    const { computeInputHash, getCachedBriefing } = await import("../../briefing-cache.js");
    let briefing;
    if (isDaemonRunning(shitennoDir)) {
      const result = await queryDaemon<{ type: string; data: typeof briefing }>(shitennoDir, { type: "query_briefing" });
      if (result?.data) briefing = result.data;
    }
    if (!briefing) {
      const snapshot = collectContext(projectRoot, shitennoDir);
      const inputHash = computeInputHash({
        fingerprintHash: snapshot.fingerprint.hash,
        riskMapHash: snapshot.riskMap.generatedAt,
        contextRuleCount: snapshot.contextRules.length,
        dynamicRuleCount: snapshot.dynamicRules.length,
        maturityScore: snapshot.maturityProfile?.overallScore ?? null,
      });
      const cached = getCachedBriefing(shitennoDir, inputHash);
      briefing = cached?.briefing ?? snapshot.briefing;
    }
    output(chalk.bold("  📋 Pre-Session Briefing:"));
    output(chalk.gray(`    Domain: ${briefing.project.domain} | Scale: ${briefing.project.scale} | Risk: ${briefing.risks.overall}`));
    if (briefing.risks.criticalAreas.length > 0) output(chalk.red(`    ⚠ Critical areas: ${briefing.risks.criticalAreas.join(", ")}`));
    if (briefing.tests.areasWithoutTests.length > 0) output(chalk.yellow(`    🧪 Areas without tests: ${briefing.tests.areasWithoutTests.length}`));
    for (const rec of briefing.recommendations.slice(0, 2)) output(chalk.cyan(`    → ${rec}`));
    outputBlank();
  } catch (error) {
    logger.debug("status", "Suppressed error", { error });
  }
}

// ── Daemon Health Display ───────────────────────────────────────────────────

export async function displayDaemonHealth(shitennoDir: string): Promise<void> {
  try {
    const health = await queryDaemon<{
      type: string; score: number | null; trend: string; uptimeSeconds: number;
      pid: number; activeSessions: number; lastCommand: string | null;
    }>(shitennoDir, { type: "query_health" });
    if (health) {
      const icon = health.trend === "critical" ? "🔴" : health.trend === "degrading" ? "🟡" : "🟢";
      output(chalk.bold("  🔍 Daemon Health:"));
      output(`    ${icon} Score: ${health.score ?? "N/A"}/100  Trend: ${health.trend}`);
      output(chalk.gray(`    Uptime: ${Math.round((health.uptimeSeconds ?? 0) / 60)}min | PID: ${health.pid} | Sessions: ${health.activeSessions}`));
      if (health.lastCommand) output(chalk.gray(`    Last command: ${health.lastCommand}`));
      outputBlank();
    }
    const challenges = await queryDaemon<{
      type: string; challenges: Array<{ type: string; severity: string; message: string }>;
    }>(shitennoDir, { type: "query_challenges" });
    if (challenges?.challenges?.length) {
      const visible = challenges.challenges.filter((c) => c.message);
      if (visible.length > 0) {
        output(chalk.bold("  🎯 Pending Challenges:"));
        for (const c of visible.slice(0, 5)) {
          const sev = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
          output(`    ${sev} ${c.message}`);
        }
        outputBlank();
      }
    }
  } catch { /* daemon may not be running */ }
}

// ── Capability Engine Display ───────────────────────────────────────────────

export async function displayCapabilityEngine(projectRoot: string, shitennoDir: string): Promise<void> {
  try {
    const { evaluateCapabilities } = await import("../../capability-engine.js");
    const { subscribeToEngineeringState } = await import("../../engineering-state/index.js");
    const { getState, unsubscribe } = subscribeToEngineeringState(projectRoot, shitennoDir);
    const state = getState();
    unsubscribe();
    const engineResult = evaluateCapabilities(state, shitennoDir);
    output(chalk.bold("  ⚙ Capability Engine:"));
    output(chalk.gray(`    Overall: ${engineResult.overallScore}% | Installed: ${engineResult.byMaturity.installed.length + engineResult.byMaturity.configured.length + engineResult.byMaturity.active.length + engineResult.byMaturity.optimized.length} | Dormant: ${engineResult.byMaturity.dormant.length}`));
    const activeCaps = [...engineResult.byMaturity.active, ...engineResult.byMaturity.optimized];
    if (activeCaps.length > 0) output(chalk.green(`    Active: ${activeCaps.map((c) => c.name).join(", ")}`));
    outputBlank();
  } catch (error) {
    logger.debug("status", "Suppressed error", { error });
  }
}
