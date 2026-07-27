import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import { invalidateCache } from "../cache.js";
import { outputJson } from "../formatting.js";
import { checkLifecycleGate } from "../shared.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputError } from "../output.js";
import { getFilesToSync, shouldPreserveCustomizations, mergeWithCustomizations } from "./sync/merge.js";

const { copySync, ensureDirSync, writeFileSync } = fse;

function printBanner(isJson: boolean): void {
  if (isJson) return;
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║      shugo sync — Update Project     ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

function outputMissingPath(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "missing_path", message: "shitenno path not specified. Use --shitenno-path or SHITENNO_GO_PATH env var." });
    return;
  }
  output(chalk.red("  ✘ shitenno path not specified."));
  output(chalk.gray("  Use --shitenno-path <path> or set SHITENNO_GO_PATH environment variable."));
  output(chalk.gray("  Example: shugo sync --shitenno-path /path/to/shitenno"));
  output(chalk.gray("  Or: SHITENNO_GO_PATH=/path/to/shitenno shugo sync"));
}

function outputMissingDir(shitennoDir: string, isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "missing_shitenno_dir", message: `shitenno directory not found: ${shitennoDir}` });
    return;
  }
  output(chalk.red(`  ✘ shitenno directory not found: ${shitennoDir}`));
}

function outputNotInitialized(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "not_initialized", message: "Run 'shugo init' first, then 'shugo sync' to update." });
    return;
  }
  output(chalk.yellow("  ⚠ This project doesn't seem to be initialized with shugo."));
  output(chalk.gray("  Run 'shugo init' first, then 'shugo sync' to update."));
}

function analyseChanges(filesToSync: string[], shitennoDir: string, targetDir: string): FileChange[] {
  const changes: FileChange[] = [];
  for (const file of filesToSync) {
    const shitennoFile = join(shitennoDir, file);
    const targetFile = join(targetDir, file);
    if (!existsSync(targetFile)) {
      changes.push({ path: file, action: "create" });
      continue;
    }
    const shitennoContent = readFileSync(shitennoFile, "utf-8");
    const targetContent = readFileSync(targetFile, "utf-8");
    if (shitennoContent !== targetContent) {
      changes.push({ path: file, action: "update" });
    } else {
      changes.push({ path: file, action: "skip", reason: "identical" });
    }
  }
  return changes;
}

function displayChangeSummary(changes: FileChange[]): void {
  output(chalk.bold("  Changes to apply:"));
  outputBlank();
  const createCount = changes.filter((c) => c.action === "create").length;
  const updateCount = changes.filter((c) => c.action === "update").length;
  const skipCount = changes.filter((c) => c.action === "skip").length;
  if (createCount > 0) output(chalk.green(`    + ${createCount} files to create`));
  if (updateCount > 0) output(chalk.yellow(`    ~ ${updateCount} files to update`));
  if (skipCount > 0) output(chalk.gray(`    - ${skipCount} files unchanged`));
  outputBlank();
  for (const change of changes) {
    if (change.action === "create") output(chalk.green(`    + ${change.path}`));
    else if (change.action === "update") output(chalk.yellow(`    ~ ${change.path}`));
  }
}

function outputDryRunResult(changes: FileChange[], isJson: boolean): void {
  const createCount = changes.filter((c) => c.action === "create").length;
  const updateCount = changes.filter((c) => c.action === "update").length;
  const skipCount = changes.filter((c) => c.action === "skip").length;
  if (isJson) {
    outputJson({ dryRun: true, createCount, updateCount, skipCount, changes: changes.map((c) => ({ path: c.path, action: c.action })) });
    return;
  }
  outputBlank();
  output(chalk.gray("  Dry run complete. No files were modified."));
}

function applyChanges(changes: FileChange[], shitennoDir: string, targetDir: string): void {
  for (const change of changes) {
    if (change.action === "skip") continue;
    const shitennoFile = join(shitennoDir, change.path);
    const targetFile = join(targetDir, change.path);
    if (change.action === "create") {
      ensureDirSync(resolve(targetFile, ".."));
      copySync(shitennoFile, targetFile);
      continue;
    }
    if (shouldPreserveCustomizations(change.path)) {
      const merged = mergeWithCustomizations(shitennoFile, targetFile);
      writeFileSync(targetFile, merged, "utf-8");
    } else {
      copySync(shitennoFile, targetFile);
    }
  }
}

function outputSyncResult(changes: FileChange[], isJson: boolean): void {
  const createCount = changes.filter((c) => c.action === "create").length;
  const updateCount = changes.filter((c) => c.action === "update").length;
  const skipCount = changes.filter((c) => c.action === "skip").length;
  if (isJson) {
    outputJson({
      dryRun: false,
      createCount,
      updateCount,
      skipCount,
      updated: changes.filter((c) => c.action !== "skip").map((c) => c.path),
    });
    return;
  }
  outputBlank();
  output(chalk.green("  ✔ Sync complete!"));
  outputBlank();
  output(chalk.gray("  Updated files:"));
  for (const change of changes) {
    if (change.action !== "skip") output(chalk.gray(`    - ${change.path}`));
  }
  outputBlank();
}

async function runSync(
  targetDir: string,
  shitennoDir: string,
  options: { dryRun?: boolean; force?: boolean; json?: boolean }
): Promise<void> {
  const isJson = options.json === true;
  const spinner = ora("Analysing changes...").start();
  try {
    const filesToSync = getFilesToSync(shitennoDir, targetDir);
    const changes = analyseChanges(filesToSync, shitennoDir, targetDir);
    spinner.stop();
    displayChangeSummary(changes);
    if (options.dryRun) {
      outputDryRunResult(changes, isJson);
      return;
    }
    if (!options.force && (changes.some((c) => c.action === "create") || changes.some((c) => c.action === "update"))) {
      outputBlank();
      const { confirm } = await import("inquirer").then((mod) =>
        mod.default.prompt([{ type: "confirm", name: "confirm", message: "Apply these changes?", default: true }])
      );
      if (!confirm) {
        output(chalk.gray("  Sync cancelled."));
        return;
      }
    }
    const applySpinner = ora("Applying changes...").start();
    applyChanges(changes, shitennoDir, targetDir);
    applySpinner.stop();
    invalidateCache({ projectRoot: targetDir });
    outputSyncResult(changes, isJson);
  } catch (error) {
    spinner.stop();
    outputError(chalk.red(`  ✘ Sync failed: ${error}`));
  }
}

interface FileChange {
  path: string;
  action: "create" | "update" | "skip";
  reason?: string;
}

export const syncCommand = new Command("sync")
  .description("Sync project governance files from shitenno")
  .option("-d, --dir <path>", "Target project directory (default: current)", ".")
  .option("-n, --shitenno-path <path>", "Path to shitenno directory")
  .option("--dry-run", "Show what would be changed without making changes")
  .option("--force", "Overwrite all files without asking")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const targetDir = resolve(options.dir);
    const isJson = options.json === true;

    if (existsSync(resolve(targetDir, SHITENNO_DIR_NAME))) {
      const gateShitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
      if (!checkLifecycleGate("sync", targetDir, gateShitennoDir, isJson)) return;
    }

    printBanner(isJson);

    let shitennoPath = options.shitennoPath || process.env.SHITENNO_GO_PATH;
    if (!shitennoPath && existsSync(resolve(targetDir, SHITENNO_DIR_NAME))) {
      shitennoPath = resolve(targetDir, SHITENNO_DIR_NAME);
    }

    if (!shitennoPath) {
      outputMissingPath(isJson);
      return;
    }

    const shitennoDir = resolve(shitennoPath);
    if (!existsSync(shitennoDir)) {
      outputMissingDir(shitennoDir, isJson);
      return;
    }

    if (!existsSync(resolve(targetDir, SHITENNO_DIR_NAME))) {
      outputNotInitialized(isJson);
      return;
    }

    await runSync(targetDir, shitennoDir, { dryRun: options.dryRun, force: options.force, json: isJson });
  });

export { getFilesToSync, shouldPreserveCustomizations, mergeWithCustomizations, mergeJsonFiles, mergeMarkdownFiles, extractSections } from "./sync/merge.js";
