/**
 * run.ts — Full Analysis Pipeline
 *
 * Chains all analysis stages into a single command.
 * Stages: analyze → score → detect → audit → evolve
 *
 * PRINCIPLE: One command to understand the full project state.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Pipeline, createPipelineContext, type PipelineContext, type PipelineStage } from "../application/pipeline.js";
import { output, outputBlank, outputError } from "../shared/output.js";
import { muteLogs } from "../shared/logger.js";
import { outputJson } from "../shared/formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";

// ── Stages (lazy-loaded) ────────────────────────────────────────────────────

const analyzeStage: PipelineStage = {
  name: "analyze",
  description: "Analyse project structure",
  execute: async (ctx: PipelineContext) => {
    const { analyseProject } = await import("../infrastructure/analyser.js");
    const analysis = analyseProject(ctx.projectRoot);
    ctx.analysis = analysis;
    return ctx;
  },
};

const scoreStage: PipelineStage = {
  name: "score",
  description: "Calculate complexity score",
  execute: async (ctx: PipelineContext) => {
    if (!ctx.analysis) return ctx;
    const { calculateComplexityScore, writeComplexityReport } = await import("../application/scorer.js");
    type AnalyseProjectResult = Awaited<ReturnType<typeof import("../infrastructure/analyser.js").analyseProject>>;
    const analysis = ctx.analysis as AnalyseProjectResult;
    const complexity = await calculateComplexityScore(ctx.projectRoot, ctx.shitennoDir, analysis);
    writeComplexityReport(ctx.projectRoot, ctx.shitennoDir, complexity);
    ctx.complexityReport = complexity as import("../application/scorer.js").ComplexityReport;
    return ctx;
  },
};

const detectStage: PipelineStage = {
  name: "detect",
  description: "Detect patterns in history",
  execute: async (ctx: PipelineContext) => {
    const { detectPatterns, writePatternReport } = await import("../infrastructure/pattern-detector.js");
    const report = detectPatterns(ctx.projectRoot, ctx.shitennoDir);
    writePatternReport(ctx.shitennoDir, report);
    ctx.patternReport = report;
    return ctx;
  },
};

const auditStage: PipelineStage = {
  name: "audit",
  description: "Audit governance health",
  execute: async (ctx: PipelineContext) => {
    const { auditHealth, writeHealthReport } = await import("../application/health-auditor.js");
    const report = await auditHealth(ctx.projectRoot, ctx.shitennoDir);
    writeHealthReport(ctx.shitennoDir, report);
    ctx.healthReport = report;
    return ctx;
  },
};

const evolveStage: PipelineStage = {
  name: "evolve",
  description: "Generate evolution recommendations",
  execute: async (ctx: PipelineContext) => {
    if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.shitennoDir, false)) {
      output(chalk.yellow("  ⚠ Skipping evolve stage (requires 'governed' state)"));
      return { ...ctx, __lastStageSkipped: true };
    }
    const { consolidateEngineeringState } = await import("../application/engineering-state.js");
    const { analyzeEvolution, writeEvolutionReport } = await import("../application/auto-evolution.js");
    const state = consolidateEngineeringState(ctx.projectRoot, ctx.shitennoDir);
    const report = analyzeEvolution(state, ctx.projectRoot, ctx.shitennoDir);
    writeEvolutionReport(ctx.shitennoDir, report);
    ctx.evolutionReport = report;
    return { ...ctx, __lastStageSkipped: false };
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function displayBanner(): void {
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║    shugo run — Full Analysis         ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

function displaySpinnerResult(spinner: ReturnType<typeof ora> | null, result: PipelineContext): void {
  if (!spinner) return;
  const successCount = result.stageResults.filter((s) => s.status === "success").length;
  const skippedCount = result.stageResults.filter((s) => s.status === "skipped").length;
  const failCount = result.stageResults.filter((s) => s.status === "failed").length;
  spinner.succeed(
    `Pipeline complete — ${successCount} succeeded` +
    (skippedCount > 0 ? `, ${skippedCount} skipped` : "") +
    (failCount > 0 ? `, ${failCount} failed` : "")
  );
}

function displayJsonSummary(projectRoot: string, result: PipelineContext): void {
  const complexity = result.complexityReport;
  const patterns = result.patternReport;
  const health = result.healthReport;
  const evolution = result.evolutionReport;
  outputJson({
    projectRoot,
    stages: result.stageResults,
    complexity: complexity ? {
      score: complexity.score,
      level: complexity.level,
    } : null,
    patterns: patterns ? {
      count: patterns.patterns.length,
      candidateRules: patterns.candidateRules.length,
    } : null,
    health: health ? {
      score: health.healthScore,
      issues: health.issues.length,
    } : null,
    evolution: evolution ? {
      recommendations: evolution.totalRecommendations,
    } : null,
    errors: result.errors.map((e) => ({ stage: e.stage, error: e.error.message })),
    duration: result.completedAt
      ? new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()
      : 0,
  });
}

function stageIcon(status: string): string {
  if (status === "success") return chalk.green("✔");
  if (status === "skipped") return chalk.yellow("⊘");
  return chalk.red("✘");
}

function complexityColor(level: string) {
  if (level === "junior") return chalk.green;
  if (level === "pleno") return chalk.yellow;
  return chalk.red;
}

function displayHumanSummary(result: PipelineContext): void {
  output(chalk.bold("  Pipeline Results:"));
  outputBlank();

  for (const sr of result.stageResults) {
    output(`    ${stageIcon(sr.status)} ${sr.stage} ${chalk.gray(`(${sr.duration}ms)`)}`);
  }
  outputBlank();

  const complexity = result.complexityReport;
  if (complexity) {
    const color = complexityColor(complexity.level);
    output(chalk.bold("  Summary:"));
    output(`    Complexity: ${color(complexity.score + "/20")} — ${color(complexity.level)}`);
  }

  const patterns = result.patternReport;
  if (patterns) {
    output(`    Patterns:  ${patterns.patterns.length} detected, ${patterns.candidateRules.length} candidate rules`);
  }

  const health = result.healthReport;
  if (health) {
    const color = health.healthScore >= 70 ? chalk.green : health.healthScore >= 40 ? chalk.yellow : chalk.red;
    output(`    Health:    ${color(health.healthScore + "/100")}`);
  }

  const evolution = result.evolutionReport;
  if (evolution) {
    output(`    Evolution: ${evolution.totalRecommendations} recommendation(s)`);
  }

  if (result.errors.length > 0) {
    outputBlank();
    output(chalk.red(`  ${result.errors.length} stage(s) failed:`));
    for (const e of result.errors) {
      output(chalk.red(`    - ${e.stage}: ${e.error.message}`));
    }
  }

  outputBlank();
}

function handlePipelineError(error: unknown, spinner: ReturnType<typeof ora> | null, isJson: boolean): void {
  if (spinner) spinner.fail("Pipeline failed");
  if (isJson) {
    outputJson({ error: "pipeline_failed", message: String(error) });
  } else {
    outputError(chalk.red(`  Error: ${error}`));
  }
  outputBlank();
}

// ── Command ──────────────────────────────────────────────────────────────────

export const runCommand = new Command("run")
  .description("Run the full analysis pipeline (analyze → score → detect → audit → evolve)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;
    if (isJson) muteLogs();
    if (!isJson) displayBanner();

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;
    if (!checkLifecycleGate("run", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    const pipeline = new Pipeline()
      .addStage(analyzeStage)
      .addStage(scoreStage)
      .addStage(detectStage)
      .addStage(auditStage)
      .addStage(evolveStage);

    const pipelineCtx = createPipelineContext(ctx.projectRoot, ctx.shitennoDir);
    const spinner = isJson ? null : ora("Running analysis pipeline...").start();

    try {
      const result = await pipeline.execute(pipelineCtx);
      displaySpinnerResult(spinner, result);
      if (isJson) { displayJsonSummary(ctx.projectRoot, result); return; }
      displayHumanSummary(result);
    } catch (error) {
      handlePipelineError(error, spinner, isJson);
    }
  });
