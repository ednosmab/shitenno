/**
 * commands/validate/display.ts — Validation display functions
 *
 * Extracted from commands/validate.ts to keep modules focused.
 */

import chalk from "chalk";
import { statusIcon } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import type { ValidationResult } from "./checks.js";
import { attemptFixes } from "./fixers.js";

// ── Display ─────────────────────────────────────────────────────────────────

export function displayValidationResults(
  results: ValidationResult[],
  fix: boolean,
  targetDir: string
): void {
  output(chalk.bold("  Validation Results:"));
  outputBlank();

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const result of results) {
    const { icon, color } = statusIcon(result.status);
    if (result.status === "pass") passCount++;
    else if (result.status === "warn") warnCount++;
    else failCount++;

    output(`    ${color(icon)} ${chalk.bold(result.name)}: ${color(result.message)}`);
  }

  outputBlank();
  output(chalk.bold("  Summary:"));
  output(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  outputBlank();

  if (failCount > 0 && fix) {
    output(chalk.yellow("  Attempting to fix issues..."));
    outputBlank();

    const fixResults = attemptFixes(targetDir, results);

    if (fixResults.length > 0) {
      output(chalk.green("  Fixed:"));
      for (const fix of fixResults) {
        output(chalk.green(`    ✔ ${fix}`));
      }
      outputBlank();
    }
  }

  if (failCount > 0) {
    output(chalk.red("  Some checks failed. Run 'shugo validate --fix' to attempt repairs."));
  } else if (warnCount > 0) {
    output(chalk.yellow("  Session is valid with warnings."));
  } else {
    output(chalk.green("  Session is valid!"));
  }

  outputBlank();
}
