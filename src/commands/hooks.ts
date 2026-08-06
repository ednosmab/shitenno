import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { banner } from "../shared/formatting.js";
import { output, outputBlank } from "../shared/output.js";

const HOOKS_DIR = ".husky";
const POST_COMMIT_HOOK = "post-commit";
const POST_MERGE_HOOK = "post-merge";

const SHUGO_HOOK_LINE = "shugo detect --auto 2>/dev/null &";

export function ensureHooksDir(projectRoot: string): string {
  const hooksPath = join(projectRoot, HOOKS_DIR);
  if (!existsSync(hooksPath)) {
    mkdirSync(hooksPath, { recursive: true });
  }
  return hooksPath;
}

export function appendToHook(hooksPath: string, hookName: string, line: string): { added: boolean; alreadyExists: boolean } {
  const hookPath = join(hooksPath, hookName);
  let content = "";

  if (existsSync(hookPath)) {
    content = readFileSync(hookPath, "utf-8");
    if (content.includes(line)) {
      return { added: false, alreadyExists: true };
    }
    // Ensure newline before appending
    if (!content.endsWith("\n")) {
      content += "\n";
    }
  } else {
    // Create new hook with shebang
    content = "#!/bin/sh\n";
  }

  content += `\n# Shitenno hook\n${line}\n`;
  writeFileSync(hookPath, content, { mode: 0o755 });
  return { added: true, alreadyExists: false };
}

export function removeFromHook(hooksPath: string, hookName: string, line: string): { removed: boolean; notFound: boolean } {
  const hookPath = join(hooksPath, hookName);
  if (!existsSync(hookPath)) {
    return { removed: false, notFound: true };
  }

  const content = readFileSync(hookPath, "utf-8");
  if (!content.includes(line)) {
    return { removed: false, notFound: true };
  }

  // Simple line removal (preserves other content)
  const newContent = content
    .split("\n")
    .filter((l) => l.trim() !== line.trim() && l.trim() !== "# Shitenno hook")
    .join("\n");

  writeFileSync(hookPath, newContent, { mode: 0o755 });
  return { removed: true, notFound: false };
}

export const hooksCommand = new Command("hooks")
  .description("Install or uninstall Shugo git hooks (Husky compatible)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--uninstall", "Remove Shugo hooks from existing git hooks")
  .action((options) => {
    outputBlank();
    banner("shugo hooks", "Git Hooks Management");
    outputBlank();

    const projectRoot = options.dir ? resolve(options.dir) : process.cwd();

    // Validate .git exists — hooks are meaningless outside a git repo
    if (!existsSync(join(projectRoot, ".git"))) {
      output(chalk.red("  ✘ Not a git repository. Initialize git first: git init"));
      outputBlank();
      return;
    }

    const hooksPath = ensureHooksDir(projectRoot);

    if (options.uninstall) {
      output(chalk.bold("  Uninstalling Shugo hooks..."));
      const postCommit = removeFromHook(hooksPath, POST_COMMIT_HOOK, SHUGO_HOOK_LINE);
      const postMerge = removeFromHook(hooksPath, POST_MERGE_HOOK, SHUGO_HOOK_LINE);

      if (postCommit.removed || postMerge.removed) {
        output(chalk.green("  ✓ Shugo hooks removed."));
      } else {
        output(chalk.yellow("  No Shugo hooks found to remove."));
      }
    } else {
      output(chalk.bold("  Installing Shugo hooks..."));
      
      // 1. Post-commit (append)
      const pc = appendToHook(hooksPath, POST_COMMIT_HOOK, SHUGO_HOOK_LINE);
      if (pc.added) {
        output(chalk.green(`  ✓ Added to ${POST_COMMIT_HOOK}`));
      } else {
        output(chalk.gray(`  • ${POST_COMMIT_HOOK} already configured`));
      }

      // 2. Post-merge (append or create)
      const pm = appendToHook(hooksPath, POST_MERGE_HOOK, SHUGO_HOOK_LINE);
      if (pm.added) {
        output(chalk.green(`  ✓ Created/Updated ${POST_MERGE_HOOK}`));
      } else {
        output(chalk.gray(`  • ${POST_MERGE_HOOK} already configured`));
      }

      outputBlank();
      output(chalk.gray("  Hooks are managed by Husky (if installed) or run directly."));
    }
    outputBlank();
  });
