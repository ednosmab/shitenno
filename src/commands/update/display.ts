import chalk from "chalk";
import fse from "fs-extra";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type ManifestDiff } from "../../manifest.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { outputJson } from "../../formatting.js";
import { output, outputBlank, outputSection, outputSuccess, outputError, outputWarning } from "../../output.js";

const { copySync, ensureDirSync, removeSync } = fse;

export function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "..", "templates", "base");
}

export function displayDiff(diff: ManifestDiff, isJson: boolean): void {
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

export function applyUpdates(
  targetDir: string,
  diff: ManifestDiff,
  options: { backup?: boolean }
): void {
  const templatesDir = getTemplatesDir();
  const shitennoDir = join(targetDir, SHITENNO_DIR_NAME);

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

  let filesUpdated = 0;

  for (const file of [...diff.added, ...diff.changed]) {
    const srcPath = join(templatesDir, file);
    const destPath = join(shitennoDir, file);

    if (existsSync(srcPath)) {
      ensureDirSync(join(destPath, ".."));
      copySync(srcPath, destPath);
      filesUpdated++;
    }
  }

  for (const file of diff.removed) {
    const filePath = join(shitennoDir, file);
    if (existsSync(filePath)) {
      removeSync(filePath);
      filesUpdated++;
    }
  }

  outputSuccess(`  ✔ Updated ${filesUpdated} file(s)`);
}

export function outputNoManifest(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "no_manifest", message: "No manifest found. Run 'shugo init' or 'shugo upgrade' first." });
  } else {
    outputWarning("  ⚠ No manifest found.");
    output(chalk.gray("  Run 'shugo init' or 'shugo upgrade' to create a manifest."));
    outputBlank();
  }
}

export function outputUpToDate(data: { currentCliVersion: string; currentManifest: { cliVersion: string; installedAt: string } }, isJson: boolean): void {
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

export function outputDryRun(data: { diff: ManifestDiff }, isJson: boolean): void {
  if (isJson) {
    outputJson({ dryRun: true, diff: data.diff });
  } else {
    output(chalk.gray("  Dry run — no changes applied."));
    outputBlank();
  }
}

export function outputChangesSummary(data: { diff: ManifestDiff }, isJson: boolean): void {
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

export function outputUpdateResult(data: { currentCliVersion: string; diff: ManifestDiff }, isJson: boolean, updatedManifest: { installedAt: string }): void {
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
}
