/**
 * history.ts — History Command
 *
 * Shows historical snapshots of Engineering State.
 *
 * Usage: shugo history [--from <date>] [--to <date>] [--diff]
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized } from "../shared.js";
import { outputJson } from "../formatting.js";
import { listSnapshots, getSnapshotAt, diffSnapshots } from "../engineering-state/index.js";
import { output, outputBlank } from "../output.js";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../constants.js";

function displaySnapshotList(snapshots: Array<{ timestamp: string }>): void {
  output(chalk.bold(`\nEngineering State History (${snapshots.length} snapshots)\n`));
  for (const snapshot of snapshots) output(`  ${chalk.cyan(snapshot.timestamp)}`);
}

function displayDiffs(shitennoDir: string, snapshots: Array<{ id: string; timestamp: string }>): void {
  if (snapshots.length < 2) return;
  output(chalk.bold("\nDiffs:\n"));
  for (let i = 1; i < snapshots.length; i++) {
    const prevMeta = snapshots[i - 1];
    const currMeta = snapshots[i];
    if (!prevMeta || !currMeta) continue;
    const prev = getSnapshotAt(shitennoDir, prevMeta.timestamp);
    const curr = getSnapshotAt(shitennoDir, currMeta.timestamp);
    if (prev && curr) {
      const delta = diffSnapshots(prev, curr);
      const healthColor = delta.healthScoreChange >= 0 ? chalk.green : chalk.red;
      const entropyColor = delta.entropyChange <= 0 ? chalk.green : chalk.red;
      output(`  ${chalk.cyan(prevMeta.timestamp)} → ${chalk.cyan(currMeta.timestamp)}`);
      output(`    Health: ${healthColor(`${delta.healthScoreChange >= 0 ? "+" : ""}${delta.healthScoreChange}`)}`);
      output(`    Entropy: ${entropyColor(`${delta.entropyChange >= 0 ? "+" : ""}${delta.entropyChange}`)}`);
      output(`    Assets: +${delta.assetsAdded}/-${delta.assetsRemoved}`);
      if (delta.capabilitiesChanged) output(`    ${chalk.yellow("Capabilities changed")}`);
      outputBlank();
    }
  }
}

export const historyCommand = new Command("history")
  .description("Show engineering state history")
  .option("--from <date>", "Start date (ISO format)")
  .option("--to <date>", "End date (ISO format)")
  .option("--diff", "Show diff between consecutive snapshots")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const result = guardNotInitialized({}, options.json ?? false);
    if (result) return;
    const projectRoot = process.cwd();
    const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
    const range = options.from || options.to ? { from: options.from || "2000-01-01", to: options.to || new Date().toISOString() } : undefined;
    const snapshots = listSnapshots(shitennoDir, range);
    if (snapshots.length === 0) { output(chalk.yellow("No snapshots found.")); return; }
    if (options.json) { outputJson({ snapshots: snapshots.map((s) => ({ id: s.id, timestamp: s.timestamp })), count: snapshots.length }); return; }
    displaySnapshotList(snapshots);
    if (options.diff) displayDiffs(shitennoDir, snapshots);
  });
