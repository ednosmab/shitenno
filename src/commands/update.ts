/**
 * update.ts — Update Command with Change Detection
 *
 * Detects changes in templates since last install/upgrade.
 * Shows diff and optionally applies updates.
 */

import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import {
  readManifest,
  writeManifest,
  scanTemplateHashes,
  diffManifests,
  updateManifest,
  type Manifest,
  type ManifestDiff,
} from "../manifest.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputSection, outputSuccess, outputError, outputWarning, outputInfo } from "../output.js";
import { logger } from "../logger.js";

const { copySync, ensureDirSync, removeSync } = fse;

// ── Types ────────────────────────────────────────────────────────────────────

interface UpdateOptions {
  dir?: string;
  apply?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  force?: boolean;
  json?: boolean;
}

interface UpdateData {
  currentManifest: Manifest;
  currentCliVersion: string;
  diff: ManifestDiff;
  hasChanges: boolean;
  versionMismatch: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTemplatesDir(): string {
  // Templates are in src/templates/base/ relative to the CLI package
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "templates", "base");
}

function displayDiff(diff: ManifestDiff, isJson: boolean): void {
  if (isJson) {
    outputJson(diff as unknown as Record<string, unknown>);
    return;
  }

  outputSection("Changes detected:");

  if (diff.added.length > 0) {
    outputSuccess(`    + ${diff.added.length} file(s) added`);
    for (const f of diff.added.slice(0, 10)) {
      output(chalk.green(`      + ${f}`));
    }
    if (diff.added.length > 10) {
      output(chalk.gray(`      ... and ${diff.added.length - 10} more`));
    }
  }

  if (diff.removed.length > 0) {
    outputError(`    - ${diff.removed.length} file(s) removed`);
    for (const f of diff.removed.slice(0, 10)) {
      output(chalk.red(`      - ${f}`));
    }
    if (diff.removed.length > 10) {
      output(chalk.gray(`      ... and ${diff.removed.length - 10} more`));
    }
  }

  if (diff.changed.length > 0) {
    outputWarning(`    ~ ${diff.changed.length} file(s) changed`);
    for (const f of diff.changed.slice(0, 10)) {
      output(chalk.yellow(`      ~ ${f}`));
    }
    if (diff.changed.length > 10) {
      output(chalk.gray(`      ... and ${diff.changed.length - 10} more`));
    }
  }

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    outputSuccess("    No changes detected. Everything is up to date.");
  }

  outputBlank();
}

function applyUpdates(
  targetDir: string,
  diff: ManifestDiff,

  options: UpdateOptions
): void {
  const templatesDir = getTemplatesDir();
  const shitennoDir = join(targetDir, SHITENNO_DIR_NAME);

  // Create backup if requested
  if (options.backup) {
    const backupDir = join(shitennoDir, "backups", new Date().toISOString().replace(/[:.]/g, "-"));
    ensureDirSync(backupDir);

    for (const file of [...diff.changed, ...diff.removed]) {
      const srcPath = join(shitennoDir, file);
      if (existsSync(srcPath)) {
        const destPath = join(backupDir, file);
        ensureDirSync(join(destPath, ".."));
        copySync(srcPath, destPath);
      }
    }

    output(chalk.gray(`  Backup created at: ${backupDir.replace(targetDir + "/", "")}`));
  }

  // Apply changes
  let filesUpdated = 0;

  // Copy new/changed files
  for (const file of [...diff.added, ...diff.changed]) {
    const srcPath = join(templatesDir, file);
    const destPath = join(shitennoDir, file);

    if (existsSync(srcPath)) {
      ensureDirSync(join(destPath, ".."));
      copySync(srcPath, destPath);
      filesUpdated++;
    }
  }

  // Remove deleted files
  for (const file of diff.removed) {
    const filePath = join(shitennoDir, file);
    if (existsSync(filePath)) {
      removeSync(filePath);
      filesUpdated++;
    }
  }

  outputSuccess(`  ✔ Updated ${filesUpdated} file(s)`);
}

function processUpdate(ctx: { shitennoDir: string }, currentManifest: Manifest): UpdateData {
  const packageJsonPath = join(__dirname, "..", "package.json");
  let currentCliVersion = "unknown";
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    currentCliVersion = pkg.version || "unknown";
  } catch (err) {
    logger.debug("update", `Failed to read package.json: ${err}`);
  }

  const spinner = ora("Scanning templates for changes...").start();
  const newHashes = scanTemplateHashes(ctx.shitennoDir);
  spinner.succeed("Scan complete");

  const newManifest: Manifest = {
    ...currentManifest,
    templateHashes: newHashes,
  };

  const diff = diffManifests(currentManifest, newManifest);
  const hasChanges =
    diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
  const versionMismatch = currentManifest.cliVersion !== currentCliVersion;

  return { currentManifest, currentCliVersion, diff, hasChanges, versionMismatch };
}

async function tryAutoCreateManifest(
  ctx: { shitennoDir: string; projectRoot: string },
  isJson: boolean
): Promise<UpdateData | null> {
  const spinner = ora("No manifest found — creating from current state...").start();
  try {
    const { createManifest } = await import("../manifest.js");
    const { loadMaturityProfile } = await import("../maturity-profile.js");
    const profile = loadMaturityProfile(ctx.shitennoDir);
    const capabilities = profile?.installedCapabilities ?? ["core"];
    const maturityScore = profile?.overallScore ?? 0;
    let cliVersion = "unknown";
    try {
      const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
      cliVersion = pkg.version || "unknown";
    } catch { /* ignore */ }
    const newManifest = createManifest(cliVersion, ctx.shitennoDir, capabilities, maturityScore);
    writeManifest(ctx.shitennoDir, newManifest);
    spinner.succeed("Manifest created. Re-running update check...");
    return processUpdate(ctx, newManifest);
  } catch (err) {
    spinner.fail(`Failed to create manifest: ${err}`);
    outputNoManifest(isJson);
    return null;
  }
}

function outputNoManifest(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "no_manifest", message: "No manifest found. Run 'shugo init' or 'shugo upgrade' first." });
  } else {
    outputWarning("  ⚠ No manifest found.");
    output(chalk.gray("  Run 'shugo init' or 'shugo upgrade' to create a manifest."));
    outputBlank();
  }
}

function outputUpToDate(data: UpdateData, isJson: boolean): void {
  if (isJson) {
    outputJson({
      status: "up_to_date",
      cliVersion: data.currentCliVersion,
      installedVersion: data.currentManifest.cliVersion,
      installedAt: data.currentManifest.installedAt,
    });
  } else {
    outputSuccess("  ✔ Everything is up to date!");
    output(chalk.gray(`  CLI version: ${data.currentCliVersion}`));
    output(chalk.gray(`  Last updated: ${data.currentManifest.installedAt}`));
    outputBlank();
  }
}

function outputDryRun(data: UpdateData, isJson: boolean): void {
  if (isJson) {
    outputJson({ dryRun: true, diff: data.diff });
  } else {
    output(chalk.gray("  Dry run — no changes applied."));
    outputBlank();
  }
}

function outputChangesSummary(data: UpdateData, isJson: boolean): void {
  if (isJson) {
    outputJson({
      status: "changes_detected",
      diff: data.diff,
      hint: "Run 'shugo update --apply' to apply changes",
    });
  } else {
    output(chalk.gray("  Run 'shugo update --apply' to apply these changes."));
    output(chalk.gray("  Run 'shugo update --dry-run' to preview without applying."));
    outputBlank();
  }
}

function applyUpdatesAndReport(
  targetDir: string,
  data: UpdateData,
  ctx: { shitennoDir: string },
  options: UpdateOptions
): void {
  const isJson = options.json === true;
  const applySpinner = ora("Applying updates...").start();
  try {
    applyUpdates(targetDir, data.diff, options);

    const updatedManifest = updateManifest(
      data.currentManifest,
      { cliVersion: data.currentCliVersion, shitennoDir: ctx.shitennoDir, capabilities: data.currentManifest.capabilities, maturityScore: data.currentManifest.maturityScore }
    );
    writeManifest(ctx.shitennoDir, updatedManifest);

    getEventBus().publish("system.updated", {
      filesChanged: data.diff.changed.length + data.diff.added.length + data.diff.removed.length,
      cliVersion: data.currentCliVersion,
    });

    applySpinner.succeed("Updates applied successfully!");

    if (isJson) {
      outputJson({
        status: "updated",
        cliVersion: data.currentCliVersion,
        filesChanged: data.diff.changed.length + data.diff.added.length + data.diff.removed.length,
      });
    } else {
      output(chalk.gray(`  CLI version: ${data.currentCliVersion}`));
      output(chalk.gray(`  Last updated: ${updatedManifest.installedAt}`));
      outputBlank();
    }
  } catch (error) {
    applySpinner.fail("Failed to apply updates");
    if (isJson) {
      outputJson({ error: "apply_failed", message: String(error) });
    } else {
      logger.error("update", `Error: ${error}`);
    }
  }
}

// ── Command ──────────────────────────────────────────────────────────────────

export const updateCommand = new Command("update")
  .description("Detect and apply updates to governance files")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--apply", "Apply detected updates (default: show diff only)")
  .option("--dry-run", "Show what would change without applying")
  .option("--backup", "Create backup before applying updates")
  .option("--force", "Apply updates even if CLI version matches")
  .option("--json", "Output results as JSON")
  .action(async (options: UpdateOptions) => {
    const isJson = options.json === true;
    const targetDir = resolve(options.dir || ".");

    if (!isJson) {
      output("");
      outputSection("shugo update — Change Detection");
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("update", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    const currentManifest = readManifest(ctx.shitennoDir);
    let data: UpdateData;

    if (!currentManifest) {
      const result = await tryAutoCreateManifest(ctx, isJson);
      if (!result) return;
      data = result;
    } else {
      data = processUpdate(ctx, currentManifest);
    }

    if (!data.hasChanges && !data.versionMismatch) {
      outputUpToDate(data, isJson);
      return;
    }

    if (!isJson && data.versionMismatch) {
      outputInfo(`  ℹ CLI version changed: ${data.currentManifest.cliVersion} → ${data.currentCliVersion}`);
      outputBlank();
    }
    if (!isJson) displayDiff(data.diff, false);

    if (options.apply || options.dryRun) {
      if (options.dryRun) { outputDryRun(data, isJson); return; }
      applyUpdatesAndReport(targetDir, data, ctx, options);
    } else {
      outputChangesSummary(data, isJson);
    }
  });
