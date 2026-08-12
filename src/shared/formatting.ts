/**
 * formatting.ts — Shared CLI formatting utilities
 *
 * Health bars, JSON output helpers, and display formatting.
 */

import chalk from "chalk";
import { output, outputBlank } from "./output.js";

// ── Health Score Constants ──────────────────────────────────────────────────

/** Severity-to-penalty mapping for health score calculations. */
export const HEALTH_SCORE_DEDUCTIONS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
} as const;

/** Calculate health penalty for a given severity. */
export function calculateHealthPenalty(severity: "critical" | "high" | "medium" | "low"): number {
  return HEALTH_SCORE_DEDUCTIONS[severity];
}

/**
 * Render an ASCII health bar for a score.
 *
 * @param score - Value to visualize
 * @param max - Maximum possible value (default: 100)
 * @param width - Bar width in characters (default: 20)
 * @returns Formatted string with bar + percentage
 */
export function healthBar(
  score: number,
  max: number = 100,
  width: number = 20,
  showPercentage: boolean = true
): string {
  const pct = Math.min(1, Math.max(0, score / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const barColor =
    pct >= 0.8 ? chalk.green : pct >= 0.5 ? chalk.yellow : chalk.red;

  const bar = barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  if (!showPercentage) return bar;

  const pctStr = `${Math.round(pct * 100)}%`;
  return `${bar} ${chalk.bold(pctStr)}`;
}

/**
 * Output JSON to stdout when --json flag is used.
 */
export function outputJson(data: Record<string, unknown>): void {
  output(JSON.stringify(data, null, 2), { force: true });
}

/**
 * Format a check result icon + color.
 */
export function statusIcon(
  status: "pass" | "warn" | "fail"
): { icon: string; color: typeof chalk.green } {
  switch (status) {
    case "pass":
      return { icon: "✔", color: chalk.green };
    case "warn":
      return { icon: "⚠", color: chalk.yellow };
    case "fail":
      return { icon: "✘", color: chalk.red };
  }
}

// ── Display Helpers (banner, section, kv) ──────────────────────────────────

/**
 * Render a boxed banner with command name and subtitle.
 * Replaces the duplicated 3-line `╔══╗` pattern across all commands.
 *
 * @param title - Command name (e.g. "shugo status")
 * @param subtitle - Description (e.g. "Health Check")
 */
export function banner(title: string, subtitle: string): void {
  const label = `${title} — ${subtitle}`;
  const width = label.length + 4;
  const line = "═".repeat(width);
  const inner = `  ${label}${" ".repeat(Math.max(0, width - 2 - label.length))}`;
  output(chalk.bold.cyan(`╔${line}╗`));
  output(chalk.bold.cyan(`║${inner}║`));
  output(chalk.bold.cyan(`╚${line}╝`));
}

/**
 * Render a section header with emoji.
 * Replaces duplicated `chalk.bold("  ⚠ Risk Status")` patterns.
 */
export function section(emoji: string, title: string): void {
  outputBlank();
  output(chalk.bold(`  ${emoji} ${title}`));
}

/**
 * Render a key-value pair with consistent formatting.
 * Replaces duplicated `console.log(chalk.gray(...))` patterns.
 */
export function kv(key: string, value: string, indent: number = 5): void {
  const pad = " ".repeat(indent);
  output(`${pad}${chalk.gray(key.padEnd(12))} ${chalk.cyan(value)}`);
}
