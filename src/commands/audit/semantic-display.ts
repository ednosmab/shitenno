/**
 * commands/audit/semantic-display.ts — Semantic audit display functions
 *
 * Extracted from audit/display.ts to keep modules under 300 lines.
 */

import chalk from "chalk";
import { output, outputBlank } from "../../output.js";
import { runSemanticAnalysis } from "../../semantic/index.js";
import { logger } from "../../logger.js";

// ── Semantic Audit Patterns ─────────────────────────────────────────────────

export function displaySemanticAuditPatterns(patterns: ReturnType<typeof runSemanticAnalysis>["patterns"]): void {
  output(chalk.bold.cyan(`    📊 Detected Patterns (${patterns.length})`));
  outputBlank();
  for (const pattern of patterns.slice(0, 5)) {
    const icon = pattern.type === "architectural_shift" ? "🏗️" :
                 pattern.type === "scope_drift" ? "🔄" :
                 pattern.type === "security_degradation" ? "🔒" :
                 pattern.type === "tech_debt_accumulation" ? "📦" :
                 pattern.type === "capability_gap" ? "🧩" : "📉";
    output(`    ${icon} ${chalk.bold(pattern.description)}`);
    output(chalk.gray(`      Domain: ${pattern.domain} | Confidence: ${Math.round(pattern.confidence * 100)}% | Type: ${pattern.type}`));
    for (const action of pattern.suggestedActions.slice(0, 2)) output(chalk.gray(`        → ${action}`));
    outputBlank();
  }
}

// ── Semantic Audit Insights ─────────────────────────────────────────────────

export function displaySemanticAuditInsights(insights: ReturnType<typeof runSemanticAnalysis>["insights"]): void {
  output(chalk.bold.magenta(`    🧠 Semantic Insights (${insights.length})`));
  outputBlank();
  for (const insight of insights.slice(0, 5)) {
    const icon = insight.priority === "urgent" ? "🚨" : insight.priority === "high" ? "⚠️" : "💡";
    const color = insight.priority === "urgent" ? chalk.red : insight.priority === "high" ? chalk.yellow : chalk.gray;
    output(`    ${icon} ${chalk.bold(insight.description)}`);
    output(chalk.gray(`      Priority: ${color(insight.priority)} | Domains: ${insight.domains.join(", ")}`));
    for (const action of insight.suggestedActions.slice(0, 2)) output(chalk.gray(`        → ${action}`));
    outputBlank();
  }
}

// ── Semantic Audit Correlations ──────────────────────────────────────────────

export function displaySemanticAuditCorrelations(correlations: ReturnType<typeof runSemanticAnalysis>["correlations"]): void {
  output(chalk.bold.yellow(`    🔗 Cross-System Correlations (${correlations.length})`));
  outputBlank();
  for (const corr of correlations.slice(0, 5)) {
    const icon = corr.strength === "strong" ? "🔴" : corr.strength === "moderate" ? "🟡" : "🟢";
    output(`    ${icon} ${chalk.bold(corr.description)}`);
    output(chalk.gray(`      Type: ${corr.type} | Confidence: ${Math.round(corr.confidence * 100)}% | Strength: ${corr.strength}`));
    outputBlank();
  }
}

// ── Semantic Audit (main) ───────────────────────────────────────────────────

export function displaySemanticAudit(projectRoot: string, shitennoDir: string): void {
  try {
    const { profile, patterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
    if (patterns.length === 0 && insights.length === 0 && correlations.length === 0) return;
    output(chalk.bold.magenta("  ╔══════════════════════════════════════════════════╗"));
    output(chalk.bold.magenta("  ║        SEMANTIC AUDIT — Cross-System Analysis     ║"));
    output(chalk.bold.magenta("  ╚══════════════════════════════════════════════════╝"));
    outputBlank();
    if (patterns.length > 0) displaySemanticAuditPatterns(patterns);
    if (insights.length > 0) displaySemanticAuditInsights(insights);
    if (correlations.length > 0) displaySemanticAuditCorrelations(correlations);
    output(chalk.gray(`    Growth: capacity=${Math.round(profile.growthCapacity * 100)}% | challenge=${Math.round(profile.challengeLevel * 100)}% | choices=${profile.semanticChoices.length}`));
    outputBlank();
  } catch (err) {
    logger.warn("audit", `Semantic analysis failed: ${err}`);
  }
}

// ── Semantic Data Collection (for JSON output) ──────────────────────────────

export function collectSemanticData(projectRoot: string, shitennoDir: string): Record<string, unknown> {
  try {
    const { profile: semanticProfile, patterns: semanticPatterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
    return {
      patterns: semanticPatterns.map((p) => ({ id: p.id, type: p.type, domain: p.domain, confidence: p.confidence, description: p.description })),
      insights: insights.map((i) => ({ id: i.id, type: i.type, priority: i.priority, description: i.description, domains: i.domains })),
      correlations: correlations.map((c) => ({ id: c.id, type: c.type, strength: c.strength, description: c.description, confidence: c.confidence })),
      growthProfile: { growthCapacity: semanticProfile.growthCapacity, challengeLevel: semanticProfile.challengeLevel, domainChallengeLevels: semanticProfile.domainChallengeLevels },
    };
  } catch (err) {
    logger.warn("audit", `Semantic analysis failed for JSON: ${err}`);
    return {};
  }
}
