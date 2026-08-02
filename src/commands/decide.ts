/**
 * decide.ts — Decision Engine CLI Command
 *
 * The `shugo decide` command. Evaluates proposed actions using specialized evaluators.
 *
 * Usage:
 *   shugo decide "Upgrade authentication module" --category security --risk high
 *   shugo decide "Add unit tests" --category quality --impact high --goal GOAL-abc123
 *   shugo decide "Refactor database layer" --category architecture --introduces-debt --debt-severity low
 *   shugo decide --list
 *   shugo decide --show DEC-abc123
 *   shugo decide --stats
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import {
  DecisionEngine,
  FileDecisionRepository,
  type DecisionRecommendation,
  type RiskLevel,
} from "../prioritization/evaluators.js";
import { outputJson } from "../formatting.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputSection, outputError } from "../output.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): DecisionEngine {
  const shitennoDir = join(dir, SHITENNO_DIR_NAME);
  return new DecisionEngine(new FileDecisionRepository(shitennoDir));
}

const RECO_COLORS: Record<DecisionRecommendation, (s: string) => string> = {
  proceed: (s) => chalk.green(s),
  proceed_with_caution: (s) => chalk.yellow(s),
  defer: (s) => chalk.gray(s),
  block: (s) => chalk.red.bold(s),
};

function formatDecision(d: { id: string; request: { action: string; category: string }; recommendation: DecisionRecommendation; compositeScore: number; confidence: number }): string {
  const reco = RECO_COLORS[d.recommendation](d.recommendation.padEnd(20));
  return `  ${chalk.bold(d.id)}  ${reco}  score=${d.compositeScore}  conf=${d.confidence}%  ${d.request.category}: ${d.request.action.slice(0, 50)}`;
}

function buildDecisionRequest(action: string, opts: Record<string, unknown>) {
  return {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    action,
    category: opts.category as string,
    targetGoalId: opts.goal as string,
    context: {
      riskLevel: opts.risk as RiskLevel,
      impact: opts.impact as string,
      introducesDebt: opts.introducesDebt === true,
      debtSeverity: opts.debtSeverity as string,
    },
    timestamp: new Date().toISOString(),
  };
}

function outputDecisionJson(decision: unknown) {
  outputJson(decision as Record<string, unknown>);
}

function outputDecisionPretty(decision: {
  id: string;
  request: { action: string; category: string };
  compositeScore: number;
  recommendation: DecisionRecommendation;
  confidence: number;
  scores: Array<{
    evaluator: string;
    score: number;
    reasoning: string;
    concerns?: string[];
    mitigations?: string[];
  }>;
}) {
  outputBlank();
  outputSection("Decision Engine Result");
  output(chalk.dim("  " + "─".repeat(60)));
  output(`  ${chalk.bold("ID:")}\t\t${decision.id}`);
  output(`  ${chalk.bold("Action:")}\t${decision.request.action}`);
  output(`  ${chalk.bold("Category:")}\t${decision.request.category}`);
  outputBlank();
  outputSection("Evaluator Scores:");
  for (const score of decision.scores) {
    const bar =
      chalk.cyan("█".repeat(Math.round(score.score / 10))) +
      chalk.dim("░".repeat(10 - Math.round(score.score / 10)));
    output(
      `    ${score.evaluator.padEnd(14)} ${bar} ${score.score}/100 — ${score.reasoning}`,
    );
    if (score.concerns) {
      for (const c of score.concerns) {
        output(chalk.red(`      ⚠ ${c}`));
      }
    }
    if (score.mitigations) {
      for (const m of score.mitigations) {
        output(chalk.cyan(`      → ${m}`));
      }
    }
  }
  outputBlank();
  outputSection("Result:");
  output(`  Composite Score:  ${chalk.bold(String(decision.compositeScore))}/100`);
  output(`  Recommendation:   ${RECO_COLORS[decision.recommendation](decision.recommendation.toUpperCase())}`);
  output(`  Confidence:       ${decision.confidence}%`);
  outputBlank();
}

function registerEvaluateCommand(cmd: Command) {
  cmd
    .argument("[action]", "Action to evaluate")
    .option("--category <cat>", "Action category (security, quality, architecture, etc.)", "general")
    .option("--risk <level>", "Risk level: low, medium, high, critical", "medium")
    .option("--impact <level>", "Impact level: minimal, low, medium, high, critical", "medium")
    .option("--goal <id>", "Target goal ID")
    .option("--introduces-debt", "Action introduces technical debt")
    .option("--debt-severity <level>", "Debt severity: low, medium, high", "low")
    .option("--json", "Output as JSON")
    .action(async (action: string | undefined, opts: Record<string, unknown>) => {
      if (!action) {
        cmd.help();
        return;
      }
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      void printDaemonBanner(ctx.shitennoDir, isJson);
      const engine = getEngine(ctx.projectRoot);
      const request = buildDecisionRequest(action, opts);
      const decision = await engine.decide(request);
      if (isJson) {
        outputDecisionJson(decision);
        return;
      }
      outputDecisionPretty(decision);
    });
}

function registerListCommand(cmd: Command) {
  cmd
    .command("list")
    .description("List past decisions")
    .option("--category <cat>", "Filter by category")
    .option("--recommendation <reco>", "Filter by recommendation")
    .option("--since <date>", "Show decisions since date (ISO)")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      void printDaemonBanner(ctx.shitennoDir, isJson);
      const engine = getEngine(ctx.projectRoot);
      const decisions = engine.list({
        category: opts.category as string,
        recommendation: opts.recommendation as DecisionRecommendation,
        since: opts.since as string,
      });
      if (isJson) {
        outputJson(decisions as unknown as Record<string, unknown>);
        return;
      }
      outputBlank();
      if (decisions.length === 0) {
        output(chalk.dim("  No decisions recorded."));
      } else {
        outputSection(`Decisions (${decisions.length})`);
        output(chalk.dim("  " + "─".repeat(80)));
        for (const d of decisions) {
          output(formatDecision(d));
        }
      }
      outputBlank();
    });
}

function registerShowCommand(cmd: Command) {
  cmd
    .command("show")
    .description("Show decision details")
    .argument("<id>", "Decision ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      void printDaemonBanner(ctx.shitennoDir, isJson);
      const engine = getEngine(ctx.projectRoot);
      const decision = engine.get(id);
      if (!decision) {
        if (isJson) {
          outputJson({ error: "Decision not found" });
        } else {
          outputError(`Decision not found: ${id}`);
        }
        return;
      }
      if (isJson) {
        outputJson(decision as unknown as Record<string, unknown>);
        return;
      }
      outputBlank();
      output(chalk.bold(`  ${decision.id}`));
      output(`  Action:     ${decision.request.action}`);
      output(`  Category:   ${decision.request.category}`);
      output(`  Decided:    ${decision.decidedAt}`);
      outputBlank();
      outputSection("Evaluator Scores:");
      for (const score of decision.scores) {
        output(`    ${score.evaluator.padEnd(14)} ${score.score}/100 — ${score.reasoning}`);
      }
      outputBlank();
      output(`  Composite:  ${decision.compositeScore}/100`);
      output(`  Recommendation: ${RECO_COLORS[decision.recommendation](decision.recommendation)}`);
      output(`  Confidence: ${decision.confidence}%`);
      outputBlank();
    });
}

function registerStatsCommand(cmd: Command) {
  cmd
    .command("stats")
    .description("Show decision statistics")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      void printDaemonBanner(ctx.shitennoDir, isJson);
      const engine = getEngine(ctx.projectRoot);
      const all = engine.list();
      const byReco: Record<string, number> = {};
      let totalScore = 0;
      let totalConf = 0;
      for (const d of all) {
        byReco[d.recommendation] = (byReco[d.recommendation] ?? 0) + 1;
        totalScore += d.compositeScore;
        totalConf += d.confidence;
      }
      const stats = {
        total: all.length,
        byRecommendation: byReco,
        avgCompositeScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
        avgConfidence: all.length > 0 ? Math.round(totalConf / all.length) : 0,
      };
      if (isJson) {
        outputJson(stats as unknown as Record<string, unknown>);
        return;
      }
      outputBlank();
      outputSection("Decision Statistics");
      output(chalk.dim("  " + "─".repeat(40)));
      output(`  Total:       ${stats.total}`);
      output(`  Avg Score:   ${stats.avgCompositeScore}/100`);
      output(`  Avg Confidence: ${stats.avgConfidence}%`);
      outputBlank();
      for (const [reco, count] of Object.entries(stats.byRecommendation)) {
        output(`  ${RECO_COLORS[reco as DecisionRecommendation](reco)}: ${count}`);
      }
      outputBlank();
    });
}

export function decideCommand(): Command {
  const cmd = new Command("decide")
    .description("Evaluate proposed actions using specialized evaluators")
    .option("-d, --dir <path>", "Project directory");
  registerEvaluateCommand(cmd);
  registerListCommand(cmd);
  registerShowCommand(cmd);
  registerStatsCommand(cmd);
  return cmd;
}
