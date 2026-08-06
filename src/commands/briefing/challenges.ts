/**
 * commands/briefing/challenges.ts — Interactive challenge prompt
 *
 * Extracted from commands/briefing.ts to keep modules focused.
 */

import chalk from "chalk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { output, outputBlank } from "../../shared/output.js";
import { logger } from "../../shared/logger.js";
import { markChallengeResolved, undoChallengeResolution, getActionCommand, type PendingChallenge } from "../../infrastructure/challenge-responder.js";

// ── Interactive Challenge Prompt ────────────────────────────────────────────

export function buildChallengeChoices(challenges: PendingChallenge[]): Array<{ name: string; value: { challengeIndex: number; action: string; execute?: boolean } }> {
  const choices: Array<{ name: string; value: { challengeIndex: number; action: string; execute?: boolean } }> = [];
  for (let idx = 0; idx < challenges.length; idx++) {
    const c = challenges[idx]!;
    const sevIcon = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
    for (const action of c.suggestedActions) {
      const cmd = getActionCommand(action);
      choices.push({ name: `${sevIcon} [${c.id}] ${action}`, value: { challengeIndex: idx, action, execute: false } });
      if (cmd) choices.push({ name: `   ↳ Execute now: ${cmd}`, value: { challengeIndex: idx, action, execute: true } });
    }
  }
  choices.push({ name: "   Skip all challenges", value: { challengeIndex: -1, action: "skip", execute: false } });
  choices.push({ name: "   ↩ Undo last resolution", value: { challengeIndex: -2, action: "undo", execute: false } });
  return choices;
}

export async function handleChallengeSelection(
  shitennoDir: string,
  selection: { challengeIndex: number; action: string; execute?: boolean },
): Promise<void> {
  if (selection.execute) {
    const cmd = getActionCommand(selection.action);
    if (!cmd) return;
    const inquirer = await import("inquirer");
    const { confirm } = await inquirer.default.prompt([{ type: "confirm", name: "confirm", message: `Execute: ${cmd}?`, default: false }]);
    if (!confirm) { output(chalk.gray("  Skipped.")); return; }
    const { execSync } = await import("node:child_process");
    try {
      output(chalk.gray(`  Running: ${cmd}`));
      execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
      output(chalk.green(`  ✓ Command completed`));
    } catch (error) { output(chalk.red(`  ✗ Command failed: ${error}`)); }
  } else {
    markChallengeResolved(shitennoDir, selection.challengeIndex, selection.action);
    output(chalk.green(`  ✓ Challenge resolved: ${selection.action}`));
  }
  outputBlank();
}

export function findLastResolvedChallenge(shitennoDir: string): number {
  try {
    const stateRaw = readFileSync(join(shitennoDir, "daemon", "daemon-state.json"), "utf-8");
    const state = JSON.parse(stateRaw) as Record<string, unknown>;
    const chs = state.challenges as Array<Record<string, unknown>>;
    for (let i = chs.length - 1; i >= 0; i--) { if (chs[i]?.resolved === true) return i; }
  } catch (err) {
    logger.debug("briefing", `Failed to read daemon state for challenge count: ${err}`);
  }
  return -1;
}

export async function promptForChallenges(shitennoDir: string, noInteractive: boolean): Promise<void> {
  const { getPendingChallenges } = await import("../../infrastructure/challenge-responder.js");
  const challenges = getPendingChallenges(shitennoDir);
  if (challenges.length === 0 || noInteractive) return;
  const inquirer = await import("inquirer");
  const choices = buildChallengeChoices(challenges);
  const { selection } = await inquirer.default.prompt([{ type: "list", name: "selection", message: "Pending challenges — what would you like to do?", choices, pageSize: 30 }]);

  if (selection.challengeIndex >= 0) {
    await handleChallengeSelection(shitennoDir, selection);
  } else if (selection.action === "undo") {
    const resolvedIdx = findLastResolvedChallenge(shitennoDir);
    if (resolvedIdx < 0) { output(chalk.gray("  No resolved challenges to undo.")); } else {
      const undone = undoChallengeResolution(shitennoDir, resolvedIdx);
      output(undone ? chalk.yellow(`  ↩ Undone: ${undone.type} (${undone.id})`) : chalk.red("  Failed to undo resolution."));
    }
    outputBlank();
  }
}
