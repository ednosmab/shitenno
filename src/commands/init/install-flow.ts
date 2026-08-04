/**
 * commands/init/install-flow.ts — Existing-project installation flow
 *
 * Orchestrates the safe installation flow for projects that already exist:
 *   Phase 1 — read-only discovery (inventory + health)
 *   Phase 2 — report + consent (Level 1 / Level 2 / abort)
 *   Phase 3 — isolated git worktree
 *   Phase 4 — apply per consent level (all writes happen in the worktree)
 *
 * Nothing is written to the user's working directory during the flow.
 */

import chalk from "chalk";
import { resolve } from "node:path";
import { output, outputBlank, outputError } from "../../output.js";
import type { ProjectTypeOptions } from "./project-type.js";
import { discoverProject, type DiscoveryResult } from "./discovery.js";
import { displayDiscoveryReport, displayHooksCaveat } from "./report.js";
import { promptConsentLevel, getConsentFilePath, recordConsent } from "./consent.js";
import { ensureWorktree, removeWorktree, WORKTREE_BRANCH, type WorktreeSetup } from "./worktree.js";
import { applyByLevel } from "./apply.js";

function abort(message: string): void {
  outputError(chalk.red(`  ✘ ${message}`));
  output(chalk.gray("  Installation aborted — no files were modified."));
  outputBlank();
  process.exitCode = 1;
}

async function obtainConsent(options: ProjectTypeOptions): Promise<1 | 2 | undefined> {
  try {
    return (await promptConsentLevel(options))?.level;
  } catch (err) {
    abort(err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

function announceDecision(level: 1 | 2): void {
  output(
    chalk.bold(
      `  Consent: Level ${level} — ${
        level === 1
          ? "observation only (.shitenno/ created, nothing else touched)"
          : "full integration (agent config managed, original files backed up)"
      }`,
    ),
  );
  outputBlank();
  if (level === 2) displayHooksCaveat();
}

async function prepareWorktree(targetDir: string): Promise<WorktreeSetup | undefined> {
  try {
    const worktree = await ensureWorktree(targetDir);
    if (worktree.reused) {
      output(chalk.gray(`  ♻ Reusing existing isolated worktree at ${worktree.path}`));
    } else {
      output(chalk.gray(`  ✓ Isolated worktree created at ${worktree.path} (branch ${WORKTREE_BRANCH})`));
    }
    outputBlank();
    return worktree;
  } catch (err) {
    abort(`Could not set up the isolated worktree: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

async function applyToWorktree(
  targetDir: string,
  worktreePath: string,
  discovery: DiscoveryResult,
  level: 1 | 2,
): Promise<boolean> {
  try {
    const summary = await applyByLevel(worktreePath, discovery, level, {
      enableMcpRegistration: level === 2,
      backupSourceDir: targetDir,
      projectRoot: targetDir,
    });
    output(chalk.green(`  ✓ Shitenno applied at Level ${level} inside the isolated worktree.`));
    if (summary.backups.length > 0) {
      output(chalk.gray(`    Backups: ${summary.backups.join(", ")} → .shitenno/backup/pre-init/`));
    }
    return true;
  } catch (err) {
    outputError(chalk.red(`  Installation failed: ${err instanceof Error ? err.message : String(err)}`));
    await removeWorktree(worktreePath, resolve(targetDir));
    process.exitCode = 1;
    return false;
  }
}

/**
 * Run the full installation flow for an existing project.
 */
export async function runExistingInstallFlow(
  targetDir: string,
  options: ProjectTypeOptions,
): Promise<void> {
  outputBlank();
  output(chalk.bold.cyan("  Existing project — running read-only assessment before any change."));
  outputBlank();

  // ── Phase 1: read-only discovery ─────────────────────────────────────────
  output(chalk.gray("  Scanning pre-existing governance artifacts (read-only)..."));
  const discovery = await discoverProject(targetDir);
  displayDiscoveryReport(discovery);

  // ── Phase 2: consent ─────────────────────────────────────────────────────
  const level = await obtainConsent(options);
  if (!level) return;
  announceDecision(level);

  // ── Phase 3: isolated worktree ───────────────────────────────────────────
  const worktree = await prepareWorktree(targetDir);
  if (!worktree) return;

  // Persist consent BEFORE applying — audit trail for the decision.
  const consentPath = await getConsentFilePath(targetDir);
  if (consentPath) recordConsent(consentPath, targetDir, level);

  // ── Phase 4: apply per consent level (inside the worktree) ───────────────
  const applied = await applyToWorktree(targetDir, worktree.path, discovery, level);
  if (!applied) return;

  outputBlank();
  output(chalk.gray("  The original branch was never touched. Review the isolated branch:"));
  output(chalk.gray(`    cd ${worktree.path}`));
  output(chalk.gray("  When satisfied, merge it back via a normal PR."));
  outputBlank();
}
