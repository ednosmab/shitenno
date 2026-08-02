import chalk from "chalk";
import { outputJson } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";

interface FileChange {
  path: string;
  action: "create" | "update" | "skip";
  reason?: string;
}

export function printBanner(isJson: boolean): void {
  if (isJson) return;
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║      shugo sync — Update Project     ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

export function outputMissingPath(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "missing_path", message: "shitenno path not specified. Use --shitenno-path or SHITENNO_GO_PATH env var." });
    return;
  }
  output(chalk.red("  ✘ shitenno path not specified."));
  output(chalk.gray("  Use --shitenno-path <path> or set SHITENNO_GO_PATH environment variable."));
  output(chalk.gray("  Example: shugo sync --shitenno-path /path/to/shitenno"));
  output(chalk.gray("  Or: SHITENNO_GO_PATH=/path/to/shitenno shugo sync"));
}

export function outputMissingDir(shitennoDir: string, isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "missing_shitenno_dir", message: `shitenno directory not found: ${shitennoDir}` });
    return;
  }
  output(chalk.red(`  ✘ shitenno directory not found: ${shitennoDir}`));
}

export function outputNotInitialized(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "not_initialized", message: "Run 'shugo init' first, then 'shugo sync' to update." });
    return;
  }
  output(chalk.yellow("  ⚠ This project doesn't seem to be initialized with shugo."));
  output(chalk.gray("  Run 'shugo init' first, then 'shugo sync' to update."));
}

export function displayChangeSummary(changes: FileChange[]): void {
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

export function outputDryRunResult(changes: FileChange[], isJson: boolean): void {
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

export function outputSyncResult(changes: FileChange[], isJson: boolean): void {
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
