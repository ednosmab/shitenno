import chalk from "chalk";
import { output, outputBlank } from "../../shared/output.js";
import { logger } from "../../shared/logger.js";
import { formatDualPath, formatDualPathJson, formatGrowthProgress } from "../../domain/types/dual-path-presenter.js";
import { createSemanticDualPath, formatSemanticDualPath, formatSemanticDualPathJson, runSemanticAnalysis } from "../../semantic/index.js";
import { detectFeedbackPatterns } from "../../feedback/core.js";
import { analyzeEvolution } from "../../application/auto-evolution.js";
import { outputJson } from "../../shared/formatting.js";

export function buildSemanticReport(ctx: { projectRoot: string; shitennoDir: string }): Record<string, unknown> {
  try {
    const { profile, patterns, insights, correlations } = runSemanticAnalysis(ctx.shitennoDir, ctx.projectRoot);
    return {
      patterns: patterns.map((p) => ({ id: p.id, type: p.type, domain: p.domain, confidence: p.confidence, description: p.description })),
      insights: insights.map((i) => ({ id: i.id, type: i.type, priority: i.priority, description: i.description, domains: i.domains })),
      correlations: correlations.map((c) => ({ id: c.id, type: c.type, strength: c.strength, description: c.description, confidence: c.confidence })),
      dualPaths: patterns.slice(0, 3).map((p) => formatSemanticDualPathJson(createSemanticDualPath(p, profile))),
      growthProfile: { growthCapacity: profile.growthCapacity, challengeLevel: profile.challengeLevel, domainChallengeLevels: profile.domainChallengeLevels },
    };
  } catch (err) {
    logger.warn("evolve", `Semantic analysis failed for JSON: ${err}`);
    return {};
  }
}

export function outputReportJson(
  ctx: { projectRoot: string; shitennoDir: string },
  report: ReturnType<typeof analyzeEvolution>,
  totalFeedback: number,
  patterns: ReturnType<typeof detectFeedbackPatterns>,
): void {
  outputJson({
    projectRoot: ctx.projectRoot,
    analyzedAt: report.analyzedAt,
    currentState: report.currentState,
    totalRecommendations: report.totalRecommendations,
    byType: report.byType,
    byPriority: report.byPriority,
    recommendations: report.recommendations,
    dualPaths: report.dualPaths.map((dp) => formatDualPathJson(dp.comfortable, dp.challenging, report.growthProfile)),
    growthProfile: { growthCapacity: report.growthProfile.growthCapacity, challengeLevel: report.growthProfile.challengeLevel, pattern: report.growthProfile.patterns[0]?.type || "balanced" },
    topNextSteps: report.topNextSteps,
    summary: report.summary,
    feedback: { totalInteractions: totalFeedback, patterns },
    semantic: buildSemanticReport(ctx),
  });
}

export function displaySemanticPatterns(profile: ReturnType<typeof runSemanticAnalysis>["profile"], patterns: ReturnType<typeof runSemanticAnalysis>["patterns"]): void {
  output(chalk.bold.cyan(`    📊 Semantic Patterns (${patterns.length})`));
  outputBlank();
  for (const pattern of patterns.slice(0, 3)) {
    output(chalk.gray(`    • ${pattern.description}`));
    output(chalk.gray(`      Domain: ${pattern.domain} | Confidence: ${Math.round(pattern.confidence * 100)}%`));
    output(formatSemanticDualPath(createSemanticDualPath(pattern, profile)));
  }
}

export function displaySemanticInsightsEvolve(insights: ReturnType<typeof runSemanticAnalysis>["insights"]): void {
  output(chalk.bold.magenta(`    🧠 Semantic Insights (${insights.length})`));
  outputBlank();
  for (const insight of insights.slice(0, 3)) {
    const icon = insight.priority === "urgent" ? "🚨" : insight.priority === "high" ? "⚠️" : "💡";
    output(`    ${icon} ${chalk.bold(insight.description)}`);
    output(chalk.gray(`      Priority: ${insight.priority} | Domains: ${insight.domains.join(", ")}`));
    for (const action of insight.suggestedActions.slice(0, 2)) output(chalk.gray(`        → ${action}`));
    outputBlank();
  }
}

export function displaySemanticCorrelationsEvolve(correlations: ReturnType<typeof runSemanticAnalysis>["correlations"]): void {
  output(chalk.bold.yellow(`    🔗 Cross-System Correlations (${correlations.length})`));
  outputBlank();
  for (const corr of correlations.slice(0, 3)) {
    const icon = corr.strength === "strong" ? "🔴" : corr.strength === "moderate" ? "🟡" : "🟢";
    output(`    ${icon} ${chalk.bold(corr.description)}`);
    output(chalk.gray(`      Type: ${corr.type} | Confidence: ${Math.round(corr.confidence * 100)}%`));
    outputBlank();
  }
}

export function displaySemanticEvolution(projectRoot: string, shitennoDir: string): void {
  try {
    const { profile, patterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
    if (patterns.length === 0 && insights.length === 0 && correlations.length === 0) return;
    output(chalk.bold.magenta("  ╔══════════════════════════════════════════════════╗"));
    output(chalk.bold.magenta("  ║         SEMANTIC EVOLUTION — Deep Analysis       ║"));
    output(chalk.bold.magenta("  ╚══════════════════════════════════════════════════╝"));
    outputBlank();
    if (patterns.length > 0) displaySemanticPatterns(profile, patterns);
    if (insights.length > 0) displaySemanticInsightsEvolve(insights);
    if (correlations.length > 0) displaySemanticCorrelationsEvolve(correlations);
  } catch (err) {
    logger.warn("evolve", `Semantic analysis failed: ${err}`);
  }
}

export interface EvolveReportOutput {
  report: ReturnType<typeof analyzeEvolution>;
  totalFeedback: number;
  patterns: ReturnType<typeof detectFeedbackPatterns>;
  projectRoot?: string;
  shitennoDir?: string;
}

export function outputReportHuman({ report, totalFeedback, patterns, projectRoot, shitennoDir }: EvolveReportOutput): void {
  output(chalk.bold("  Current State:"));
  output(`    Maturity: ${report.currentState.maturityScore}/100`);
  output(`    Knowledge Debt: ${report.currentState.knowledgeDebtScore}/100`);
  output(`    Capabilities: ${report.currentState.installedCapabilities.length} installed`);
  outputBlank();

  output(formatGrowthProgress(report.growthProfile));
  outputBlank();

  if (totalFeedback > 0) {
    output(chalk.bold("  Feedback History:"));
    output(`    Total interactions: ${totalFeedback}`);
    for (const p of patterns) output(chalk.gray(`    ⚠ ${p.description}`));
    outputBlank();
  }

  output(chalk.bold.cyan("  ╔══════════════════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║           DUAL PATH — Choose Your Way           ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════════════════╝"));
  outputBlank();

  for (const dualPath of report.dualPaths) {
    output(formatDualPath(dualPath.comfortable, dualPath.challenging, report.growthProfile));
  }

  if (report.topNextSteps.length > 0) {
    output(chalk.bold("  Top Next Steps:"));
    for (const step of report.topNextSteps) output(`    → ${step}`);
    outputBlank();
  }

  if (projectRoot && shitennoDir) displaySemanticEvolution(projectRoot, shitennoDir);

  output(chalk.gray("  Usage:"));
  output(chalk.gray("    shugo evolve --accept EVO-001 --comfortable   # Choose comfortable path"));
  output(chalk.gray("    shugo evolve --accept CHL-001 --challenging   # Choose challenging path"));
  output(chalk.gray("    shugo evolve --reject EVO-001 --reason \"Not now\""));
  outputBlank();
}
