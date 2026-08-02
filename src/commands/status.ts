/**
 * commands/status.ts — Status command (thin orchestrator)
 *
 * Implementation details extracted into:
 * - status/health-checks.ts: runHealthChecks and all check* functions
 * - status/display.ts: displayHeader, displayResults, displayMaturityProfile, displayFooter, etc.
 * - status/async-displays.ts: displayFingerprint, displayBriefing, displayDaemonHealth, displayCapabilityEngine
 */

import { Command } from "commander";
import chalk from "chalk";
import { calculateComplexityScore, writeComplexityReport, type ComplexityReport } from "../scorer.js";
import { analyseProject, type ProjectAnalysis } from "../analyser.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { loadMaturityProfile, type MaturityProfile } from "../maturity-profile.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";

import { output, outputBlank } from "../output.js";
import { isDaemonRunning } from "../daemon-client.js";
import { runHealthChecks, type StatusCheck } from "./status/health-checks.js";
import {
  displayHeader, displayProjectRootText, displayResults, displayFixMode,
  displayMaturityProfile, displayFooter,
} from "./status/display.js";
import {
  displayFingerprint, displayBriefing, displayDaemonHealth, displayCapabilityEngine,
} from "./status/async-displays.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface StatusOutputData {
  ctx: { projectRoot: string; shitennoDir: string };
  checks: StatusCheck[];
  complexity: ComplexityReport;
  maturityProfile: MaturityProfile | null;
  installedCapabilities: string[];
  analysis: ProjectAnalysis;
  cacheHit: boolean;
  reportFile: string | undefined;
  growthProfile: ReturnType<typeof loadGrowthProfile>;
}

// ── Complexity ──────────────────────────────────────────────────────────────

async function resolveComplexity(
  options: { cache?: boolean },
  projectRoot: string,
  shitennoDir: string,
  analysis: ProjectAnalysis,
): Promise<{ complexity: ComplexityReport; cacheHit: boolean }> {
  let complexity: ComplexityReport;
  let cacheHit = false;
  if (options.cache !== false) {
    const cached = getCached<ComplexityReport>({ projectRoot, key: "complexity", computeChecksumsFn: () => computeKeyChecksums(projectRoot, shitennoDir) });
    if (cached) { complexity = cached; cacheHit = true; }
    else {
      complexity = await calculateComplexityScore(projectRoot, shitennoDir, analysis);
      setCache({ projectRoot, shitennoDir, key: "complexity", data: complexity, checksums: computeKeyChecksums(projectRoot, shitennoDir) });
    }
  } else {
    complexity = await calculateComplexityScore(projectRoot, shitennoDir, analysis);
  }
  return { complexity, cacheHit };
}

// ── JSON Output ─────────────────────────────────────────────────────────────

import { outputJson } from "../formatting.js";

function displayJsonOutput(data: StatusOutputData): void {
  outputJson({
    projectRoot: data.ctx.projectRoot,
    checks: data.checks.map((c) => ({ name: c.name, status: c.status, message: c.message })),
    complexity: {
      score: data.complexity.score, level: data.complexity.level,
      staticScore: data.complexity.staticScore, behaviorScore: data.complexity.behaviorScore,
      reasons: data.complexity.reasons, suggestions: data.complexity.suggestions,
      areaScores: data.complexity.areaScores,
    },
    maturity: data.maturityProfile ? {
      overallScore: data.maturityProfile.overallScore,
      dimensions: data.maturityProfile.dimensions,
      installedCapabilities: data.maturityProfile.installedCapabilities,
      recommendedCapabilities: data.maturityProfile.recommendedCapabilities,
    } : null,
    installedCapabilities: data.installedCapabilities,
    analysis: {
      packageCount: data.analysis.packageCount, appCount: data.analysis.appCount,
      sourceFileCount: data.analysis.sourceFileCount, dependencyCount: data.analysis.dependencyCount,
      monorepo: data.analysis.monorepo, hasTypeScript: data.analysis.hasTypeScript,
      hasTests: data.analysis.hasTests,
    },
    cacheHit: data.cacheHit, reportFile: data.reportFile || null, computedAt: data.complexity.computedAt,
    growthProfile: {
      growthCapacity: data.growthProfile.growthCapacity,
      challengeLevel: data.growthProfile.challengeLevel,
      pattern: data.growthProfile.patterns[0]?.type || "balanced",
      totalChoices: data.growthProfile.pathHistory.length,
    },
  });
}

// ── Complexity Display ──────────────────────────────────────────────────────

function displayComplexityReport(complexity: ComplexityReport): void {
  const levelColors: Record<string, typeof chalk.green> = { junior: chalk.green, pleno: chalk.cyan, senior: chalk.magenta, staff: chalk.yellow, principal: chalk.red };
  const color = levelColors[complexity.level] ?? chalk.white;
  output(chalk.bold("  📊 Complexity Report:"));
  output(`    Score: ${color(String(complexity.score))} — Level: ${color(complexity.level)}`);
  outputBlank();
}

// ── Main Command ────────────────────────────────────────────────────────────

export const statusCommand = new Command("status")
  .description("Check governance health status")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--fix", "Auto-fix governance issues (like doctor)")
  .action(async (options) => {
    const isJson = options.json === true;
    displayHeader(isJson);
    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;
    if (!checkLifecycleGate("status", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
    const checks = runHealthChecks(ctx.projectRoot, ctx.shitennoDir);
    const analysis = analyseProject(ctx.projectRoot);
    const { complexity, cacheHit } = await resolveComplexity(options, ctx.projectRoot, ctx.shitennoDir, analysis);
    const reportFile = writeComplexityReport(ctx.projectRoot, ctx.shitennoDir, complexity);
    const maturityProfile = loadMaturityProfile(ctx.shitennoDir);
    const installedCapabilities = maturityProfile?.installedCapabilities ?? ["core"];
    const growthProfile = loadGrowthProfile(ctx.shitennoDir);
    if (isJson) { displayJsonOutput({ ctx, checks, complexity, maturityProfile, installedCapabilities, analysis, cacheHit, reportFile: reportFile ?? undefined, growthProfile }); return; }
    displayProjectRootText(ctx.projectRoot);
    displayResults(checks);
    if (options.fix) displayFixMode(checks, isJson);
    displayMaturityProfile(maturityProfile, installedCapabilities);
    displayComplexityReport(complexity);
    await displayFingerprint(ctx.projectRoot, ctx.shitennoDir, analysis, maturityProfile?.overallScore);
    await displayBriefing(ctx.projectRoot, ctx.shitennoDir);
    if (isDaemonRunning(ctx.shitennoDir)) await displayDaemonHealth(ctx.shitennoDir);
    await displayCapabilityEngine(ctx.projectRoot, ctx.shitennoDir);
    output(formatGrowthProgress(growthProfile));
    outputBlank();
    displayFooter({ cacheHit, reportFile: reportFile ?? undefined, projectRoot: ctx.projectRoot, maturityProfile, complexity });
  });
