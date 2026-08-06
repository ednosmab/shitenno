/**
 * commands/init/upgrade.ts — Phase 7: Level 1 → Level 2 upgrade
 *
 * A project that consented to Level 1 (observation) may later run `shugo init`
 * again and be offered the upgrade to Level 2 — without re-running the full
 * assessment from zero. The latest record in `.git/shitenno/consent.json`
 * (written in Phase 2) is the source of truth for the current level.
 */

import { resolve } from "node:path";
import inquirer from "inquirer";
import { existsSync } from "node:fs";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { output, outputBlank } from "../../shared/output.js";
import { discoverProject } from "./discovery.js";
import {
  getConsentFilePath,
  readLatestConsent,
  recordConsent,
  readDeclaredConsentLevel,
} from "./consent.js";
import { ensureWorktree } from "./worktree.js";
import { applyByLevel } from "./apply.js";
import { displayHooksCaveat } from "./report.js";
import type { ProjectTypeOptions } from "./project-type.js";

export type UpgradeOutcome =
  | "upgraded"
  | "already-level-2"
  | "no-consent"
  | "not-initialized"
  | "declined"
  | "no-git";

/**
 * Decide whether the upgrade to Level 2 is approved — from a declared level
 * (flag/answers file) or an interactive confirm. Never assumed by default.
 */
async function approveUpgrade(options: ProjectTypeOptions): Promise<boolean> {
  const declared = await readDeclaredConsentLevel(options);
  if (declared.error) {
    output(`  ✘ ${declared.error}`);
    outputBlank();
    return false;
  }
  if (declared.level !== null) return declared.level === 2;
  if (options.answersFile) {
    output('  ✘ The answers file must define "consentLevel": 2 to approve the Level 2 upgrade.');
    outputBlank();
    return false;
  }
  if (!process.stdin.isTTY) return false;
  const { upgrade } = await inquirer.prompt<{ upgrade: boolean }>([
    {
      type: "confirm",
      name: "upgrade",
      message:
        "This project is at Level 1 (observation). Upgrade to Level 2 (full integration, original files backed up)?",
      default: false,
    },
  ]);
  return upgrade;
}

/**
 * Apply the Level 2 install inside an isolated worktree and append the new
 * consent record. Returns true on success.
 */
async function performUpgrade(targetDir: string, consentPath: string): Promise<boolean> {
  const discovery = await discoverProject(targetDir);
  let worktree;
  try {
    worktree = await ensureWorktree(targetDir);
  } catch (err) {
    output(`  ✘ Could not set up the isolated worktree: ${err instanceof Error ? err.message : String(err)}`);
    outputBlank();
    return false;
  }

  output(`  ✓ Isolated worktree: ${worktree.path}`);
  outputBlank();
  displayHooksCaveat();

  try {
    await applyByLevel(worktree.path, discovery, 2, {
      enableMcpRegistration: true,
      backupSourceDir: resolve(targetDir),
      projectRoot: resolve(targetDir),
    });
  } catch (err) {
    output(`  ✘ Upgrade failed: ${err instanceof Error ? err.message : String(err)}`);
    outputBlank();
    return false;
  }

  recordConsent(consentPath, resolve(targetDir), 2);
  output("  ✓ Upgraded to Level 2 — agent config files are now managed, originals backed up.");
  output("    Review the isolated branch and merge it via a normal PR when satisfied.");
  outputBlank();
  return true;
}

/**
 * Offer the Level 1 → Level 2 upgrade when the project is initialized at
 * Level 1 and consent history exists. Returns the outcome of the flow.
 */
export async function runUpgradeFlow(
  targetDir: string,
  options: ProjectTypeOptions,
): Promise<UpgradeOutcome> {
  if (!existsSync(resolve(targetDir, SHITENNO_DIR_NAME))) return "not-initialized";

  const consentPath = await getConsentFilePath(targetDir);
  if (!consentPath) return "no-git";

  const latest = readLatestConsent(consentPath);
  if (!latest) return "no-consent";
  if (latest.level === 2) return "already-level-2";

  if (!(await approveUpgrade(options))) {
    output("  Upgrade declined — staying at Level 1. Nothing was modified.");
    outputBlank();
    return "declined";
  }

  const upgraded = await performUpgrade(targetDir, consentPath);
  return upgraded ? "upgraded" : "declined";
}