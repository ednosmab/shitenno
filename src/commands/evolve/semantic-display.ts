import chalk from "chalk";
import { output, outputBlank } from "../../output.js";
import { logger } from "../../logger.js";
import { runSemanticAnalysis, formatSemanticDualPath, createSemanticDualPath } from "../../semantic/index.js";
import type { SemanticAnalysisResult } from "../../semantic/index.js";

export function displaySemanticPatterns(
  profile: SemanticAnalysisResult["profile"],
  patterns: SemanticAnalysisResult["patterns"],
): void {
  output(chalk.bold.cyan(`    📊 Semantic Patterns (${patterns.length})`));
  outputBlank();
  for (const pattern of patterns.slice(0, 3)) {
    output(chalk.gray(`    • ${pattern.description}`));
    output(chalk.gray(`      Domain: ${pattern.domain} | Confidence: ${Math.round(pattern.confidence * 100)}%`));
    output(formatSemanticDualPath(createSemanticDualPath(pattern, profile)));
  }
}

export function displaySemanticInsightsEvolve(insights: SemanticAnalysisResult["insights"]): void {
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

export function displaySemanticCorrelationsEvolve(correlations: SemanticAnalysisResult["correlations"]): void {
  output(chalk.bold.yellow(`    🔗 Cross-System Correlations (${correlations.length})`));
  outputBlank();
  for (const corr of correlations.slice(0, 3)) {
    const icon = corr.strength === "strong" ? "🔴" : corr.strength === "moderate" ? "🟡" : "🟢";
    output(`    ${icon} ${chalk.bold(corr.description)}`);
    output(chalk.gray(`      Type: ${corr.type} | Confidence: ${Math.round(corr.confidence * 100)}%`));
    outputBlank();
  }
}

export function displaySemanticEvolution(shitennoDir: string, projectRoot: string): void {
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
