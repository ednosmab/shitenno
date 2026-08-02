/**
 * console.ts — shugo console command
 *
 * Visualizes token economy metrics over time:
 * - Total tokens saved
 * - Cache hit rate
 * - Success/failure trends
 * - Monthly projections
 *
 * Usage:
 *   shugo console                # Full console
 *   shugo console --json         # JSON output
 *   shugo console --period <d>   # Period in days (default: 30)
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getFeedbackRecords, computeFeedbackSummary } from "../session-feedback.js";
import { getSessionMetrics } from "../session-tracker.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";
import { output, outputBlank, outputSection } from "../output.js";

// ── Display Helpers ────────────────────────────────────────────────────────

function healthBar(value: number, max: number, width = 20): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  const color = value >= max * 0.7 ? chalk.green : value >= max * 0.4 ? chalk.yellow : chalk.red;
  return color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

// ── Console Display ────────────────────────────────────────────────────────

function displaySessionOverview(summary: ReturnType<typeof computeFeedbackSummary>, periodDays: number): void {
  outputSection(`Session Overview (last ${periodDays} days)`);
  output(`     Total sessions: ${chalk.cyan(String(summary.totalSessions))}`);
  output(`     Success rate:   ${chalk.cyan(Math.round(summary.successRate * 100) + "%")}`);
  output(`     ${chalk.green("✓ Success:")} ${summary.byOutcome.success}  ${chalk.red("✗ Failure:")} ${summary.byOutcome.failure}  ${chalk.yellow("⚠ Partial:")} ${summary.byOutcome.partial}`);
  outputBlank();
}

function displayTokenEconomy(summary: ReturnType<typeof computeFeedbackSummary>): void {
  outputSection("Token Economy");
  output(`     Total saved (estimated):    ${chalk.green("~" + summary.tokenEconomy.totalTokensSaved.toLocaleString() + " tokens")}`);
  output(`     Avg per session (estimated): ${chalk.green("~" + summary.tokenEconomy.avgTokensSaved.toLocaleString() + " tokens")}`);
  output(`     Cache hits:     ${chalk.cyan(String(summary.tokenEconomy.cacheHits))} / ${summary.totalSessions}`);
  output(`     Cache hit rate: ${healthBar(summary.tokenEconomy.cacheHitRate * 100, 100)} ${Math.round(summary.tokenEconomy.cacheHitRate * 100)}%`);
  outputBlank();
}

function displayMonthlyProjection(summary: ReturnType<typeof computeFeedbackSummary>): void {
  outputSection("Monthly Projection (10 sessions)");
  output(`     Tokens saved (estimated):   ${chalk.green("~" + summary.tokenEconomy.monthlyProjection.toLocaleString())}`);
  const monthlyCost = (summary.tokenEconomy.monthlyProjection / 1_000_000) * 5;
  output(`     Cost saved (estimated, heuristic baseline):     ${chalk.green("~$" + monthlyCost.toFixed(2) + "/month")}`);
  outputBlank();
}

function displayFailureHotspots(summary: ReturnType<typeof computeFeedbackSummary>): void {
  if (summary.failureHotspots.length > 0) {
    outputSection("Failure Hotspots");
    for (const area of summary.failureHotspots) {
      output(chalk.red(`     • ${area}`));
    }
    outputBlank();
  }
}

function displayDuration(summary: ReturnType<typeof computeFeedbackSummary>): void {
  if (summary.avgSuccessDuration !== null) {
    outputSection("Session Duration");
    output(`     Avg (success):  ${chalk.cyan(summary.avgSuccessDuration + " min")}`);
    outputBlank();
  }
}

function displaySessionTracker(sessionMetrics: ReturnType<typeof getSessionMetrics>): void {
  if (sessionMetrics.totalSessions > 0) {
    outputSection("Session Tracker");
    output(`     Total sessions: ${chalk.cyan(String(sessionMetrics.totalSessions))}`);
    output(`     Avg duration:   ${chalk.cyan(sessionMetrics.avgDuration + " min")}`);
    output(`     Total commands: ${chalk.cyan(String(sessionMetrics.totalCommands))}`);
    if (Object.keys(sessionMetrics.commandFrequency).length > 0) {
      const topCmds = Object.entries(sessionMetrics.commandFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      output(chalk.gray("     Top commands:"));
      for (const [cmd, count] of topCmds) {
        output(chalk.gray(`       ${cmd}: ${count}`));
      }
    }
    outputBlank();
  }
}

function displaySessionScore(summary: ReturnType<typeof computeFeedbackSummary>): void {
  const healthScore = Math.round(
    (summary.successRate * 40) +
    (summary.tokenEconomy.cacheHitRate * 30) +
    (summary.totalSessions > 0 ? 30 : 0)
  );
  outputSection("Session Score");
  output(`     Score: ${healthBar(healthScore, 100)} ${healthScore}/100`);
  outputBlank();
}

function displayRecommendations(summary: ReturnType<typeof computeFeedbackSummary>): void {
  outputSection("Recommendations");
  if (summary.tokenEconomy.cacheHitRate < 0.5) {
    output(chalk.cyan("     → Use `shugo briefing` more often to improve cache hit rate"));
  }
  if (summary.byOutcome.failure > summary.byOutcome.success) {
    output(chalk.cyan("     → Review failure hotspots and add test coverage"));
  }
  if (summary.totalSessions < 5) {
    output(chalk.cyan("     → More sessions = more data = better recommendations"));
  }
  if (summary.tokenEconomy.cacheHitRate >= 0.8 && summary.successRate >= 0.8) {
    output(chalk.green("     ✓ Excellent! Token economy is optimized"));
  }
  outputBlank();
}

function displayConsole(
  summary: ReturnType<typeof computeFeedbackSummary>,
  sessionMetrics: ReturnType<typeof getSessionMetrics>,
  periodDays: number
): void {
  outputBlank();
  outputSection("shugo console — Token Economy");
  outputBlank();
  displaySessionOverview(summary, periodDays);
  displayTokenEconomy(summary);
  displayMonthlyProjection(summary);
  displayFailureHotspots(summary);
  displayDuration(summary);
  displaySessionTracker(sessionMetrics);
  displaySessionScore(summary);
  displayRecommendations(summary);
}

// ── Command ────────────────────────────────────────────────────────────────

export function consoleCommand(): Command {
  const cmd = new Command("console")
    .description("Token economy console with session metrics")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--period <days>", "Period in days", "30")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;
      const periodDays = parseInt(String(options.period || "30"), 10);

      if (!isJson) {
        output("");
        outputSection("shugo console — Token Economy");
        outputBlank();
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("console", ctx.projectRoot, ctx.shitennoDir, isJson)) {
        return;
      }

      const records = getFeedbackRecords(ctx.shitennoDir);
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
      const filteredRecords = records.filter((r) => r.timestamp >= since);
      const summary = computeFeedbackSummary(filteredRecords);
      const sessionMetrics = getSessionMetrics(ctx.shitennoDir, periodDays);

      if (isJson) {
        outputJson({
          periodDays,
          totalRecords: records.length,
          filteredRecords: filteredRecords.length,
          sessionTracker: sessionMetrics,
          ...summary,
        });
        return;
      }

      displayConsole(summary, sessionMetrics, periodDays);

      getEventBus().publish("analysis.complete", {
        type: "console",
        sessions: summary.totalSessions,
        tokensSaved: summary.tokenEconomy.totalTokensSaved,
        cacheHitRate: summary.tokenEconomy.cacheHitRate,
      });
    });

  return cmd;
}
