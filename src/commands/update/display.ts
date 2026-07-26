import chalk from "chalk";
import { outputJson } from "../../formatting.js";
import { output, outputBlank, outputSection, outputSuccess, outputError, outputWarning } from "../../output.js";
import type { ManifestDiff } from "../../manifest.js";

interface UpdateData {
  currentManifest: { cliVersion: string; installedAt: string };
  currentCliVersion: string;
  diff: ManifestDiff;
  hasChanges: boolean;
  versionMismatch: boolean;
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

export function outputNoManifest(isJson: boolean): void {
  if (isJson) {
    outputJson({ error: "no_manifest", message: "No manifest found. Run 'shugo init' or 'shugo upgrade' first." });
  } else {
    outputWarning("  ⚠ No manifest found.");
    output(chalk.gray("  Run 'shugo init' or 'shugo upgrade' to create a manifest."));
    outputBlank();
  }
}

export function outputUpToDate(data: UpdateData, isJson: boolean): void {
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

export function outputDryRun(data: UpdateData, isJson: boolean): void {
  if (isJson) {
    outputJson({ dryRun: true, diff: data.diff });
  } else {
    output(chalk.gray("  Dry run — no changes applied."));
    outputBlank();
  }
}

export function outputChangesSummary(data: UpdateData, isJson: boolean): void {
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
