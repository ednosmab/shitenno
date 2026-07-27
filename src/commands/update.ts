/**
 * update.ts — Update Command with Change Detection
 *
 * Detects changes in templates since last install/upgrade.
 * Shows diff and optionally applies updates.
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
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
import { output, outputBlank, outputSection, outputInfo } from "../output.js";
import { logger } from "../logger.js";
import {
  displayDiff, applyUpdates, outputNoManifest, outputUpToDate,
  outputDryRun, outputChangesSummary, outputUpdateResult,
} from "./update/display.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function applyUpdatesAndReport(
  targetDir: string,
  data: UpdateData,
  ctx: { shitennoDir: string },
  options: UpdateOptions
): void {
  const isJson = options.json === true;
  const applySpinner = ora("Applying updates...").start();
  try {
    applyUpdates(targetDir, data.diff, { backup: options.backup });

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
    outputUpdateResult(data, isJson, updatedManifest);
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
    const targetDir = join(options.dir || ".");

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
