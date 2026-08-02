/**
 * dual-path-presenter.ts — Dual Path Output Formatter
 *
 * Formats the two paths (comfortable and challenging) for human-readable output
 * and JSON output. Shows growth progress and provides clear context.
 *
 * PRINCIPLE: The system shows two paths and trusts the user's intention to choose.
 */

import chalk from "chalk";
import type { EvolutionRecommendation } from "./auto-evolution.js";
import type { GrowthProfile } from "./growth-profile.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Formatted dual path for display. */
export interface FormattedDualPath {
  comfortable: string;
  challenging: string;
  progress: string;
}

/** JSON-serializable dual path. */
export interface DualPathJson {
  comfortable: {
    id: string;
    title: string;
    description: string;
    confidence: number;
    pathType: "comfortable";
  };
  challenging: {
    id: string;
    title: string;
    description: string;
    confidence: number;
    pathType: "challenging";
    paradigmShift?: string;
    knowledgeGap?: string;
  };
  growthProfile: {
    growthCapacity: number;
    challengeLevel: number;
    pattern: string;
  };
  progress: {
    totalChoices: number;
    challengingRatio: number;
    adaptation: string;
  };
}

// ── Formatting Functions ────────────────────────────────────────────────────

function formatComfortablePath(comfortable: EvolutionRecommendation): string[] {
  const lines: string[] = [];
  lines.push(chalk.green("  ┌─ PATH A: COMFORTABLE ─────────────────────────────┐"));
  lines.push(chalk.green("  │") + ` Within your current thinking`);
  lines.push(chalk.green("  │"));
  lines.push(chalk.green("  │") + ` ${chalk.bold(comfortable.title)}`);
  lines.push(chalk.green("  │") + ` ${chalk.gray(comfortable.description)}`);
  lines.push(chalk.green("  │"));
  lines.push(chalk.green("  │") + ` Impact: ${chalk.cyan(comfortable.expectedImpact)}`);
  lines.push(chalk.green("  │") + ` Confidence: ${formatConfidence(comfortable.confidence)}`);
  lines.push(chalk.green("  │"));
  lines.push(chalk.green("  │") + ` ${chalk.gray(comfortable.action)}`);
  lines.push(chalk.green("  └──────────────────────────────────────────────────┘"));
  lines.push("");
  return lines;
}

function formatChallengingPath(challenging: EvolutionRecommendation): string[] {
  const lines: string[] = [];
  lines.push(chalk.yellow("  ┌─ PATH B: CHALLENGING ────────────────────────────┐"));
  lines.push(chalk.yellow("  │") + ` Beyond your current thinking`);
  lines.push(chalk.yellow("  │"));
  lines.push(chalk.yellow("  │") + ` ${chalk.bold(challenging.title)}`);
  lines.push(chalk.yellow("  │") + ` ${chalk.gray(challenging.description)}`);
  lines.push(chalk.yellow("  │"));
  lines.push(chalk.yellow("  │") + ` Impact: ${chalk.cyan(challenging.expectedImpact)}`);
  lines.push(chalk.yellow("  │") + ` Confidence: ${formatConfidence(challenging.confidence)}`);
  lines.push(chalk.yellow("  │"));

  const paradigmShift = challenging.evidence.find((e) => e.startsWith("Paradigm shift:"));
  if (paradigmShift) {
    lines.push(chalk.yellow("  │"));
    lines.push(chalk.yellow("  │") + ` ${chalk.magenta("Paradigm Shift:")}`);
    lines.push(chalk.yellow("  │") + `   ${chalk.gray(paradigmShift.replace("Paradigm shift: ", ""))}`);
  }

  const knowledgeGap = challenging.evidence.find((e) => e.startsWith("Knowledge gap:"));
  if (knowledgeGap) {
    lines.push(chalk.yellow("  │"));
    lines.push(chalk.yellow("  │") + ` ${chalk.blue("Knowledge Gap:")}`);
    lines.push(chalk.yellow("  │") + `   ${chalk.gray(knowledgeGap.replace("Knowledge gap: ", ""))}`);
  }

  lines.push(chalk.yellow("  │"));
  lines.push(chalk.yellow("  │") + ` ${chalk.gray(challenging.action)}`);
  lines.push(chalk.yellow("  └──────────────────────────────────────────────────┘"));
  lines.push("");
  return lines;
}

export function formatDualPath(
  comfortable: EvolutionRecommendation,
  challenging: EvolutionRecommendation,
  profile: GrowthProfile
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.cyan("  ╔══════════════════════════════════════════════════╗"));
  lines.push(chalk.bold.cyan("  ║           DUAL PATH — Choose Your Way           ║"));
  lines.push(chalk.bold.cyan("  ╚══════════════════════════════════════════════════╝"));
  lines.push("");

  lines.push(...formatComfortablePath(comfortable));
  lines.push(...formatChallengingPath(challenging));

  lines.push(formatGrowthProgress(profile));
  lines.push("");
  lines.push(chalk.gray("  Choose: --comfortable or --challenging"));
  lines.push("");

  return lines.join("\n");
}

/** Format dual path for JSON output. */
export function formatDualPathJson(
  comfortable: EvolutionRecommendation,
  challenging: EvolutionRecommendation,
  profile: GrowthProfile
): DualPathJson {
  const paradigmShift = challenging.evidence.find((e) => e.startsWith("Paradigm shift:"));
  const knowledgeGap = challenging.evidence.find((e) => e.startsWith("Knowledge gap:"));

  const totalChoices = profile.pathHistory.length;
  const challengingCount = profile.pathHistory.filter(
    (c) => c.pathChosen === "challenging"
  ).length;

  return {
    comfortable: {
      id: comfortable.id,
      title: comfortable.title,
      description: comfortable.description,
      confidence: comfortable.confidence,
      pathType: "comfortable",
    },
    challenging: {
      id: challenging.id,
      title: challenging.title,
      description: challenging.description,
      confidence: challenging.confidence,
      pathType: "challenging",
      ...(paradigmShift
        ? { paradigmShift: paradigmShift.replace("Paradigm shift: ", "") }
        : {}),
      ...(knowledgeGap
        ? { knowledgeGap: knowledgeGap.replace("Knowledge gap: ", "") }
        : {}),
    },
    growthProfile: {
      growthCapacity: profile.growthCapacity,
      challengeLevel: profile.challengeLevel,
      pattern: profile.patterns[0]?.type || "balanced",
    },
    progress: {
      totalChoices,
      challengingRatio: totalChoices > 0 ? challengingCount / totalChoices : 0,
      adaptation: getAdaptationDescription(profile),
    },
  };
}

/** Format growth progress indicator. */
export function formatGrowthProgress(profile: GrowthProfile): string {
  const lines: string[] = [];
  const capacity = profile.growthCapacity;
  const level = profile.challengeLevel;

  lines.push(chalk.bold("  Growth Progress:"));
  lines.push(`    Capacity: ${formatCapacityBar(capacity)} ${Math.round(capacity * 100)}%`);
  lines.push(`    Challenge: ${formatCapacityBar(level)} ${Math.round(level * 100)}%`);

  if (profile.patterns.length > 0) {
    const pattern = profile.patterns[0];
    if (pattern) {
      lines.push(`    Pattern: ${chalk.gray(pattern.description)}`);
    }
  }

  if (profile.pathHistory.length > 0) {
    const total = profile.pathHistory.length;
    const challenging = profile.pathHistory.filter(
      (c) => c.pathChosen === "challenging"
    ).length;
    lines.push(`    Choices: ${total} total (${challenging} challenging, ${total - challenging} comfortable)`);
  }

  return lines.join("\n");
}

// ── Helper Functions ────────────────────────────────────────────────────────

function formatConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return chalk.green(`${pct}%`);
  if (pct >= 50) return chalk.yellow(`${pct}%`);
  return chalk.red(`${pct}%`);
}

function formatCapacityBar(value: number): string {
  const width = 20;
  const filled = Math.round(value * width);
  const empty = width - filled;
  const barColor =
    value >= 0.7 ? chalk.green : value >= 0.4 ? chalk.yellow : chalk.red;
  return barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

function getAdaptationDescription(profile: GrowthProfile): string {
  const capacity = profile.growthCapacity;

  if (capacity >= 0.7) {
    return "System shows challenging alternatives more frequently";
  } else if (capacity >= 0.4) {
    return "System balances comfort and challenge";
  } else {
    return "System focuses on building comfort before challenging";
  }
}
