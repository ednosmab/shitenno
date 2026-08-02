/**
 * commands/briefing/display.ts — Briefing display functions
 *
 * Extracted from commands/briefing.ts to keep modules focused.
 */

import chalk from "chalk";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { briefingToMarkdown, briefingToJson, type Briefing } from "../../briefing.js";
import { differentialBriefing, generateOptimizationHints, type BriefingDepth } from "../../token-optimizer.js";
import { outputJson, banner } from "../../formatting.js";
import { output, outputBlank, outputSection } from "../../output.js";
import { getPendingChallenges, getActionCommand, type PendingChallenge } from "../../challenge-responder.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DisplayFullBriefingOptions {
  briefing: Briefing;
  isJson: boolean;
  cacheHit: boolean;
  inputHash: string;
  depth: BriefingDepth;
  projectRoot: string;
  write: boolean;
  noInteractive?: boolean;
  shitennoDir?: string;
}

// ── Output Helpers ──────────────────────────────────────────────────────────

export function displayPendingChallenges(challenges: PendingChallenge[]): void {
  if (challenges.length === 0) return;
  outputBlank();
  outputSection("⚠️ Pending Challenges");
  for (const c of challenges) {
    const sevIcon = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
    output(`     ${sevIcon} ${c.id}: ${c.message || c.type} (${c.suggestedActions[0]})`);
  }
  outputBlank();
}

export function writeBriefingMarkdown(projectRoot: string, briefing: Briefing): string {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  if (!existsSync(shitennoDir)) {
    mkdirSync(shitennoDir, { recursive: true });
  }

  const filePath = join(shitennoDir, "BRIEFING.md");
  const content = briefingToMarkdown(briefing);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function displayProjectIdentity(briefing: Briefing, depth: BriefingDepth): void {
  outputSection("Project Identity");
  output(`     Domain:   ${chalk.cyan(briefing.project.domain)}`);
  output(`     Scale:    ${chalk.cyan(briefing.project.scale)}`);
  output(`     Stack:    ${briefing.project.stack.join(", ")}`);
  if (depth !== "minimal") output(`     Maturity: ${briefing.project.maturityScore}/100`);
  outputBlank();
}

export function displayRiskStatus(briefing: Briefing, depth: BriefingDepth): void {
  const riskColor = briefing.risks.overall === "critical" ? chalk.red :
                    briefing.risks.overall === "high" ? chalk.yellow :
                    briefing.risks.overall === "medium" ? chalk.hex("#FFA500") : chalk.green;
  outputSection("Risk Status");
  output(`     Overall:  ${riskColor(briefing.risks.overall)}`);
  if (briefing.risks.criticalAreas.length > 0) output(chalk.red(`     Critical: ${briefing.risks.criticalAreas.join(", ")}`));
  if (depth !== "minimal" && briefing.risks.highAreas.length > 0) output(chalk.yellow(`     High:     ${briefing.risks.highAreas.join(", ")}`));
  outputBlank();
}

export function displayTestCoverage(briefing: Briefing): void {
  outputSection("Test Coverage");
  output(`     Has Tests: ${briefing.tests.hasTests ? chalk.green("Yes") : chalk.red("No")}`);
  if (briefing.tests.areasWithoutTests.length > 0) output(chalk.yellow(`     Without Tests: ${briefing.tests.areasWithoutTests.length} area(s)`));
  outputBlank();
}

export function displayRecentActivity(briefing: Briefing): void {
  if (!briefing.recentActivity || briefing.recentActivity.events.length === 0) return;
  outputSection("Actividade Recente (24h)");
  for (const event of briefing.recentActivity.events.slice(0, 5)) {
    const time = event.timestamp.slice(11, 16);
    const color = event.type.includes("error") || event.type.includes("warning") ? chalk.red : chalk.gray;
    output(color(`     ${time} ${event.type}: ${event.summary}`));
  }
  output(chalk.gray(`     ${briefing.recentActivity.syncCount} sincronizações, ${briefing.recentActivity.errorCount} erros`));
  outputBlank();
}

export function displayRules(briefing: Briefing, depth: BriefingDepth): void {
  if (depth === "minimal") return;
  if (briefing.contextRules.length > 0) {
    outputSection(depth === "full" ? "Context Rules (Top)" : "Context Rules");
    for (const rule of briefing.contextRules) output(chalk.gray(`     • ${rule.rule}`));
    outputBlank();
  }
  if (depth === "full" && briefing.dynamicRules.length > 0) {
    outputSection("Dynamic Rules (From History)");
    for (const rule of briefing.dynamicRules) {
      const icon = rule.severity === "critical" ? "🚨" : rule.severity === "high" ? "⚠️" : "ℹ️";
      output(chalk.gray(`     ${icon} [${rule.severity}] ${rule.rule}`));
    }
    outputBlank();
  }
}

export function displayPatterns(briefing: Briefing): void {
  if (briefing.patterns.recurringErrors.length > 0) {
    outputSection("Recurring Error Hotspots");
    for (const area of briefing.patterns.recurringErrors) output(chalk.red(`     • ${area}`));
    outputBlank();
  }
  if (briefing.patterns.detected.length > 0) {
    outputSection("Detected Patterns");
    for (const p of briefing.patterns.detected) {
      const icon = p.severity >= 4 ? "🚨" : p.severity >= 2 ? "⚠️" : "ℹ️";
      output(chalk.gray(`     ${icon} [${p.type}] ${p.description}`));
    }
    outputBlank();
  }
}

export function displayRecommendations(briefing: Briefing, depth: BriefingDepth): void {
  const maxRecs = depth === "minimal" ? 1 : depth === "standard" ? 3 : briefing.recommendations.length;
  outputSection("Recommendations");
  for (const rec of briefing.recommendations.slice(0, maxRecs)) output(chalk.cyan(`     → ${rec}`));
  outputBlank();
}

export function displayTokenEconomy(briefing: Briefing, depth: BriefingDepth, cacheHit: boolean): void {
  if (depth === "minimal") {
    if (cacheHit) { output(chalk.gray("  Cached")); outputBlank(); }
    return;
  }
  if (cacheHit) { output(chalk.gray("  Used cached briefing")); outputBlank(); }
  outputSection("Token Economy");
  output(chalk.green(`     Saved: ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()} tokens vs manual discovery`));
  outputBlank();
}

export function displayBriefingByDepth(briefing: Briefing, cacheHit: boolean, depth: BriefingDepth): void {
  outputBlank();
  banner("shugo briefing", "Context Pipeline");
  outputBlank();
  const tokenLabel = depth === "minimal" ? "~200" : depth === "standard" ? "~500" : "~1000";
  output(chalk.gray(`  Depth: ${depth} (${tokenLabel} tokens)`));
  outputBlank();

  displayProjectIdentity(briefing, depth);
  displayRiskStatus(briefing, depth);
  if (depth !== "minimal") displayTestCoverage(briefing);
  if (depth !== "minimal") displayRecentActivity(briefing);
  displayRules(briefing, depth);
  if (depth === "full") displayPatterns(briefing);
  displayRecommendations(briefing, depth);
  displayTokenEconomy(briefing, depth, cacheHit);

  output(chalk.gray(`  Generated: ${briefing.generatedAt}`));
  outputBlank();
}

export function displayCompactBriefing(
  previousBriefing: Briefing,
  briefing: Briefing,
  isJson: boolean
): void {
  const compactDiff = differentialBriefing(previousBriefing, briefing);
  if (isJson) {
    outputJson({
      type: "diff",
      format: "compact",
      oldTimestamp: previousBriefing.generatedAt,
      newTimestamp: briefing.generatedAt,
      diff: compactDiff,
    });
  } else {
    output(chalk.cyan(`  Compact diff: ${compactDiff}`));
  }
}

export function displayFullBriefing(options: DisplayFullBriefingOptions): void {
  const { briefing, isJson, cacheHit, inputHash, depth, projectRoot, write, shitennoDir } = options;
  const hints = generateOptimizationHints(briefing);

  if (isJson) {
    const jsonData: Record<string, unknown> = {
      ...briefingToJson(briefing),
      cacheHit,
      inputHash,
      optimization: {
        depth,
        suggestedDepth: hints.suggestedDepth,
        tokenEstimates: hints.tokenEstimates,
        skipSections: hints.skipSections,
        compressSections: hints.compressSections,
      },
    };

    if (shitennoDir) {
      const challenges = getPendingChallenges(shitennoDir);
      if (challenges.length > 0) {
        jsonData.pendingChallenges = challenges.map((c) => ({
          id: c.id,
          type: c.type,
          severity: c.severity,
          message: c.message,
          generatedAt: c.generatedAt,
          suggestedActions: c.suggestedActions,
          suggestedCommand: getActionCommand(c.suggestedActions[0] ?? ""),
        }));
        jsonData.pendingChallengeCount = challenges.length;
      }
    }

    outputJson(jsonData);
    return;
  }

  if (write) {
    const filePath = writeBriefingMarkdown(projectRoot, briefing);
    output(chalk.green(`  Briefing written to ${filePath}`));
    outputBlank();
  }

  displayBriefingByDepth(briefing, cacheHit, depth);

  if (shitennoDir) {
    const challenges = getPendingChallenges(shitennoDir);
    if (challenges.length > 0) {
      displayPendingChallenges(challenges);
    }
  }
}
