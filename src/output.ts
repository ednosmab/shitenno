/**
 * output.ts — Centralized stdout output for CLI commands
 *
 * PRINCIPLE: All user-facing CLI output (tables, banners, status messages,
 * formatted text) should go through this module. This ensures:
 *   1. Consistent output behavior across all commands
 *   2. Easy testing (capture output without mocking console.log)
 *   3. Respect for --quiet flag (suppress informational output)
 *   4. Clean separation: output() = stdout (user-facing),
 *      logger.* = stderr (diagnostic/debug)
 */

import chalk from "chalk";

// ── Global JSON Mode Gate ─────────────────────────────────────────────────

let globalJsonMode = false;

/**
 * Enable or disable global JSON mode. When enabled, all output() calls
 * are suppressed to prevent human-readable text from polluting JSON streams.
 * Must be set as early as possible (CLI bootstrap) before any hooks fire.
 */
export function setGlobalJsonMode(enabled: boolean): void {
  globalJsonMode = enabled;
}

/**
 * Check if quiet mode is enabled (suppresses informational output).
 * In quiet mode, only error-level output is shown.
 */
function isQuiet(): boolean {
  return process.env.SHITENNO_QUIET === "1";
}

/**
 * Write a line to stdout (user-facing output).
 * Respects --quiet flag and global JSON mode for non-essential messages.
 *
 * @param msg - The message to output.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function output(msg: string, opts?: { quiet?: boolean }): void {
  if (globalJsonMode || (opts?.quiet && isQuiet())) return;
  process.stdout.write(msg + "\n");
}

/**
 * Write a line to stdout with a newline.
 *
 * @param msg - The message to output.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function outputLine(msg: string, opts?: { quiet?: boolean }): void {
  output(msg, opts);
}

/**
 * Write multiple lines to stdout.
 *
 * @param lines - Array of lines to output.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function outputLines(lines: string[], opts?: { quiet?: boolean }): void {
  for (const line of lines) {
    output(line, opts);
  }
}

/**
 * Output a section header (bold, with separator).
 *
 * @param title - The section title.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function outputSection(title: string, opts?: { quiet?: boolean }): void {
  if (opts?.quiet && isQuiet()) return;
  output("");
  output(chalk.bold(title));
  output(chalk.gray("─".repeat(title.length)));
}

/**
 * Output a success message (green checkmark).
 *
 * @param msg - The success message.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function outputSuccess(msg: string, opts?: { quiet?: boolean }): void {
  if (opts?.quiet && isQuiet()) return;
  output(`${chalk.green("✓")} ${msg}`);
}

/**
 * Output a warning message (yellow triangle).
 *
 * @param msg - The warning message.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function outputWarning(msg: string, opts?: { quiet?: boolean }): void {
  if (opts?.quiet && isQuiet()) return;
  output(`${chalk.yellow("⚠")} ${msg}`);
}

/**
 * Output an error message (red X).
 *
 * @param msg - The error message.
 */
export function outputError(msg: string): void {
  output(`${chalk.red("✗")} ${msg}`);
}

/**
 * Output an info message (blue i).
 *
 * @param msg - The info message.
 * @param opts - Options: { quiet: true } suppresses in quiet mode.
 */
export function outputInfo(msg: string, opts?: { quiet?: boolean }): void {
  if (opts?.quiet && isQuiet()) return;
  output(`${chalk.blue("ℹ")} ${msg}`);
}

/**
 * Output an empty line.
 */
export function outputBlank(): void {
  output("");
}
