/**
 * evolve.ts — Evolution Recommendations Command
 *
 * Shows evolution recommendations and allows accept/feedback.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { output, outputBlank } from "../shared/output.js";
import { analyzeEvolution, writeEvolutionReport } from "../application/auto-evolution.js";
import { detectFeedbackPatterns, getAllFeedbackSummaries } from "../feedback/core.js";
import { recordFeedback, recordDimensionFeedback, type PerformanceMetric } from "../application/feedback-loops.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import { outputJson } from "../shared/formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";
import { recordPathChoice } from "../infrastructure/growth-profile.js";
import { printDaemonBanner } from "../interface/cli/daemon-context-banner.js";
import { outputReportHuman, outputReportJson } from "./evolve/semantic-display.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FeedbackRecordInput {
  recId: string;
  action: "accepted" | "rejected";
  reason: string | undefined;
  pathChoice: "comfortable" | "challenging" | undefined;
}

function recordFeedbackData(
  ctx: { shitennoDir: string },
  input: FeedbackRecordInput,
): void {
  const { recId, action, reason, pathChoice } = input;
  recordFeedback(ctx.shitennoDir, {
    recommendationId: recId,
    action,
    reason,
    context: {
      maturityScore: 0,
      installedCapabilities: [],
      knowledgeDebt: 0,
    },
    pathChoice,
  });

  const recTypeToMetric: Record<string, PerformanceMetric> = {
    capability: "scope_management",
    knowledge: "architectural_vision",
    governance: "decision_making",
    automation: "sustainable_velocity",
  };
  const metric = recTypeToMetric[recId.split("-")[0] ?? ""] ?? "decision_making";
  recordDimensionFeedback(ctx.shitennoDir, {
    recommendationId: recId,
    action,
    reason,
    dimension: metric,
    evidence: `User ${action} recommendation: ${recId}`,
    context: {
      maturityScore: 0,
      installedCapabilities: [],
      knowledgeDebt: 0,
    },
    pathChoice,
  });

  if (pathChoice) {
    recordPathChoice(ctx.shitennoDir, {
      pathChosen: pathChoice,
      context: {
        command: "evolve",
        recommendationType: "evolution_recommendation",
        maturityScore: 0,
      },
    });
  }
}

function handleFeedback(ctx: { shitennoDir: string }, options: { accept?: string; reject?: string; reason?: string; comfortable?: boolean; challenging?: boolean }, isJson: boolean): void {
  const recId = options.accept || options.reject || "";
  const action = options.accept ? "accepted" : "rejected";
  const reason = options.reason || undefined;

  let pathChoice: "comfortable" | "challenging" | undefined;
  if (options.comfortable) {
    pathChoice = "comfortable";
  } else if (options.challenging) {
    pathChoice = "challenging";
  }

  recordFeedbackData(ctx, { recId, action, reason, pathChoice });

  if (isJson) {
    outputJson({ feedback: { recommendationId: recId, action, reason, pathChoice } });
  } else {
    const icon = action === "accepted" ? chalk.green("✔") : chalk.red("✘");
    output(`  ${icon} Recommendation ${recId} ${action}`);
    if (pathChoice) {
      output(`    Path: ${pathChoice === "comfortable" ? chalk.green("Comfortable") : chalk.yellow("Challenging")}`);
    }
    if (reason) output(`    Reason: ${chalk.gray(reason)}`);
    outputBlank();
  }
}

function printBanner(): void {
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║    shugo evolve — Recommendations    ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

function initializeCommand(options: { json?: boolean; dir?: string }) {
  const isJson = options.json === true;
  if (!isJson) printBanner();
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return null;
  void printDaemonBanner(ctx.shitennoDir, isJson);
  if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.shitennoDir, isJson)) return null;
  return { ctx, isJson };
}

// ── Command ──────────────────────────────────────────────────────────────────

export const evolveCommand = new Command("evolve")
  .description("Show evolution recommendations and manage feedback")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .option("--accept <id>", "Accept a recommendation (record feedback)")
  .option("--reject <id>", "Reject a recommendation (record feedback)")
  .option("--reason <text>", "Reason for accept/reject")
  .option("--comfortable", "Choose the comfortable path (within current thinking)")
  .option("--challenging", "Choose the challenging path (beyond current thinking)")
  .action(async (options) => {
    const result = initializeCommand(options);
    if (!result) return;
    const { ctx, isJson } = result;

    if (options.accept || options.reject) {
      handleFeedback(ctx, options, isJson);
      return;
    }

    const spinner = isJson ? null : ora("Analyzing evolution recommendations...").start();

    try {
      const report = analyzeEvolution(ctx.projectRoot, ctx.shitennoDir);
      writeEvolutionReport(ctx.shitennoDir, report);

      const patterns = detectFeedbackPatterns(ctx.shitennoDir);
      const summaries = getAllFeedbackSummaries(ctx.shitennoDir);
      const totalFeedback = Object.values(summaries).reduce((acc, s) => acc + s.totalInteractions, 0);

      const bus = getEventBus();
      bus.publish("evolution.recommended", {
        totalRecommendations: report.totalRecommendations,
        byPriority: report.byPriority,
      });

      if (spinner) spinner.succeed(`Found ${report.totalRecommendations} recommendation(s)`);

      if (isJson) {
        outputReportJson(ctx, report, totalFeedback, patterns);
        return;
      }

      outputReportHuman({ report, totalFeedback, patterns, projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir });
    } catch (error) {
      if (spinner) spinner.fail("Evolution analysis failed");
      if (isJson) {
        outputJson({ error: "evolution_failed", message: String(error) });
      } else {
        const { logger } = await import("../shared/logger.js") as { logger: { error: (name: string, msg: string) => void } };
        logger.error("evolve", `Evolution analysis failed: ${error}`);
      }
      outputBlank();
    }
  });
