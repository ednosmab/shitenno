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

    // Auto-detect shitenno path: explicit option > env var > target dir itself
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

export function getFilesToSync(shitennoDir: string, _targetDir: string): string[] {
  const files: string[] = [];

  // Core files
  const coreFiles = [
    "docs/AGENTS.md",
    "docs/opencode-context.md",
    "docs/Shitenno_GUIDE.md",
    "opencode.json",
    "scripts/validate-session.ts",
    "scripts/close-session.ts",
  ];

  for (const file of coreFiles) {
    if (existsSync(join(shitennoDir, file))) {
      files.push(file);
    }
  }

  // Skills
  const skillsDir = join(shitennoDir, "docs/skills");
  if (existsSync(skillsDir)) {
    const skillFiles = fse.readdirSync(skillsDir).filter((f: string) =>
      f.endsWith(".md")
    );
    for (const skill of skillFiles) {
      files.push(`docs/skills/${skill}`);
    }
  }

  return files;
}

export function shouldPreserveCustomizations(filePath: string): boolean {
  // Files that should preserve project-specific customizations
  const preserveList = [
    "docs/AGENTS.md",
    "docs/opencode-context.md",
    "docs/Shitenno_GUIDE.md",
    "opencode.json",
  ];
  return preserveList.includes(filePath);
}

export function mergeWithCustomizations(
  shitennoFile: string,
  targetFile: string
): string {
  const shitennoContent = readFileSync(shitennoFile, "utf-8");
  const targetContent = readFileSync(targetFile, "utf-8");

  // JSON files: merge preserving project-specific values
  if (shitennoFile.endsWith(".json")) {
    return mergeJsonFiles(shitennoContent, targetContent);
  }

  // Markdown files: preserve custom sections, update/add shugo sections
  if (shitennoFile.endsWith(".md")) {
    return mergeMarkdownFiles(shitennoContent, targetContent);
  }

  // For other files, use shugo content
  return shitennoContent;
}

export function mergeJsonFiles(shitennoContent: string, targetContent: string): string {
  try {
    const shugo = JSON.parse(shitennoContent);
    const target = JSON.parse(targetContent);

    const preserved: Record<string, unknown> = {};

    if (target.agent && shugo.agent) {
      preserved.agent = { ...shugo.agent };
      for (const [agentName, agentConfig] of Object.entries(target.agent)) {
        if (!preserved.agent || typeof preserved.agent !== "object") continue;
        const preservedAgent = preserved.agent[agentName as keyof typeof preserved.agent] as Record<string, unknown> | undefined;
        if (!preservedAgent) continue;
        const targetAgent = agentConfig as Record<string, unknown>;
        if (targetAgent.model) preservedAgent.model = targetAgent.model;
        if (targetAgent.permission) preservedAgent.permission = targetAgent.permission;
      }
    }

    if (target.mcp) preserved.mcp = target.mcp;

    return JSON.stringify({ ...shugo, ...preserved }, null, 2);
  } catch {
    return shitennoContent;
  }
}

export function mergeMarkdownFiles(shitennoContent: string, targetContent: string): string {
  // Extract sections from both files
  const shitennoSections = extractSections(shitennoContent);
  const targetSections = extractSections(targetContent);

  // Start with shugo content as base
  let result = shitennoContent;

  // For each section in target, check if it's a custom section
  for (const [sectionTitle, sectionContent] of Object.entries(targetSections)) {
    // If section doesn't exist in shugo, it's custom - preserve it
    if (!shitennoSections[sectionTitle]) {
      // Add custom section at the end
      result += `\n\n${sectionContent}`;
    }
    // If section exists but content differs, check if it's personalized
    else if (shitennoSections[sectionTitle] !== sectionContent) {
      // Check if target section contains personalized content (not placeholders)
      if (!sectionContent.includes("[PERSONALIZAR:") && !sectionContent.includes("[Adicionar")) {
        // Preserve user's personalized content
        result = result.replace(shitennoSections[sectionTitle], sectionContent);
      }
    }
  }

  return result;
}

export function extractSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split("\n");
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check if line is a heading (## or ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections[currentSection] = currentContent.join("\n");
      }
      // Start new section
      currentSection = headingMatch[2]?.trim() ?? "";
      currentContent = [line];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join("\n");
  }

  return sections;
}
