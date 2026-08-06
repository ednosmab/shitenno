/**
 * commands/init/report.ts — Display helpers for the existing-project flow
 *
 * Shows the Phase 1 discovery report + Phase 2 consent prompts.
 */

import chalk from "chalk";
import { output, outputBlank } from "../../shared/output.js";
import type { DiscoveryResult } from "./discovery.js";

/**
 * Display the read-only discovery report (Phase 1 result) so the user can make
 * an informed consent decision. Nothing has been written at this point.
 */
export function displayDiscoveryReport(discovery: DiscoveryResult): void {
  const { inventory, healthScore, issuesBySeverity } = discovery;

  output(chalk.bold("\n  ─── Discovery report (read-only, nothing written) ───"));
  outputBlank();

  output(chalk.bold("  What already exists:"));

  if (inventory.opencodeJson.present) output(`    • opencode.json ${chalk.gray("(agent config — will be preserved)")}`);
  else output(`    • opencode.json ${chalk.gray("not detected")}`);

  if (inventory.agentsFile.present) {
    output(`    • ${inventory.agentsFile.file} ${chalk.gray("(agent rules file — will be preserved)")}`);
  } else {
    output("    • AGENTS.md/CLAUDE.md " + chalk.gray("not detected"));
  }

  output(
    inventory.adrDirs.length > 0
      ? `    • ADR directories: ${inventory.adrDirs.map((d) => chalk.cyan(d)).join(", ")}`
      : "    • ADR directories " + chalk.gray("not detected"),
  );
  output(
    inventory.plansDirs.length > 0
      ? `    • Plans directories: ${inventory.plansDirs.map((d) => chalk.cyan(d)).join(", ")}`
      : "    • Plans directories " + chalk.gray("not detected"),
  );
  output(
    inventory.contributing.present
      ? "    • CONTRIBUTING.md present"
      : "    • CONTRIBUTING.md " + chalk.gray("not detected"),
  );
  output(
    inventory.codeowners.present
      ? "    • CODEOWNERS present"
      : "    • CODEOWNERS " + chalk.gray("not detected"),
  );
  output(
    inventory.cis.length > 0
      ? `    • CI configuration: ${inventory.cis.map((c) => chalk.cyan(c)).join(", ")}`
      : "    • CI configuration " + chalk.gray("not detected"),
  );

  outputBlank();
  output(chalk.bold("  Health report:"));
  output(`    Health score: ${chalk.bold(String(healthScore))}/100`);
  output(
    `    Issues: ${chalk.red(`${issuesBySeverity[3]} severe`)} · ${chalk.yellow(`${issuesBySeverity[2]} moderate`)} · ${chalk.gray(`${issuesBySeverity[1]} low`)}`,
  );
  outputBlank();
}

/**
 * Display the worktree isolation caveat about git hooks.
 *
 * `git worktree` does NOT isolate `.git/hooks` — hooks are per-repository.
 * If Level 2 installs hooks, they apply immediately to the original branch
 * even before the worktree branch is merged back.
 */
export function displayHooksCaveat(): void {
  output(chalk.yellow("  ⚠ Note: git worktree does not isolate .git/hooks."));
  output(chalk.gray("    Hooks are per-repository. If Level 2 installs hooks, they take effect"));
  output(chalk.gray("    on the original branch immediately, even before the branch is merged."));
  outputBlank();
}