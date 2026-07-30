/**
 * skill.ts — `shugo skill` CLI command
 *
 * Manages skill files: create, list, validate.
 * Skills are markdown files with YAML frontmatter in .shitenno/docs/skills/.
 *
 * File operations are delegated to skill-io.ts to respect
 * the no-restricted-imports ESLint rule for command files.
 */

import { Command } from "commander";
import { join } from "node:path";
import chalk from "chalk";
import { output, outputBlank } from "../output.js";
import { outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { createSkillFile, listSkillFiles, validateSkillFile } from "../skill-io.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── CLI Command ────────────────────────────────────────────────────────────

export function skillCommand(): Command {
  const cmd = new Command("skill")
    .description("Manage skill files (create, list, validate)")
    .action(() => {
      cmd.help();
    });

  // ── skill create ────────────────────────────────────────────────────────
  cmd
    .command("create <name>")
    .description("Create a new skill file with template")
    .requiredOption("--description <text>", "Skill description")
    .option("--json", "Output as JSON")
    .action((name: string, opts: { description: string; json?: boolean }) => {
      const isJson = opts.json ?? false;
      const ctx = guardNotInitialized({}, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("skill", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

      const skillsDir = join(ctx.shitennoDir, "docs", "skills");
      const result = createSkillFile(skillsDir, name, opts.description);

      if (isJson) {
        outputJson(result as unknown as Record<string, unknown>);
        return;
      }

      if (result.success) {
        output(chalk.green(`  ✔ Skill created: ${result.filePath}`));
        output(chalk.dim(`    Edit the file to add your instructions.`));
      } else {
        output(chalk.red(`  ✘ ${result.error}`));
      }
    });

  // ── skill list ──────────────────────────────────────────────────────────
  cmd
    .command("list")
    .description("List all skill files")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const isJson = opts.json ?? false;
      const ctx = guardNotInitialized({}, isJson);
      if (!ctx) return;

      const skillsDir = join(ctx.shitennoDir, "docs", "skills");
      const skills = listSkillFiles(skillsDir);

      if (isJson) {
        outputJson({ skills, count: skills.length });
        return;
      }

      if (skills.length === 0) {
        output(chalk.dim("  No skills found."));
        return;
      }

      output(chalk.bold.cyan(`  Skills (${skills.length}):`));
      outputBlank();
      for (const skill of skills) {
        output(`  ${chalk.green("●")} ${chalk.bold(skill.name)} ${chalk.dim(`(${skill.filename})`)}`);
      }
    });

  // ── skill validate ──────────────────────────────────────────────────────
  cmd
    .command("validate [name]")
    .description("Validate skill file(s) — all skills if no name given")
    .option("--json", "Output as JSON")
    .action((name: string | undefined, opts: { json?: boolean }) => {
      const isJson = opts.json ?? false;
      const ctx = guardNotInitialized({}, isJson);
      if (!ctx) return;

      const skillsDir = join(ctx.shitennoDir, "docs", "skills");

      if (name) {
        // Validate single skill
        const kebabName = toKebabCase(name);
        const filePath = join(skillsDir, `${kebabName}.md`);
        const result = validateSkillFile(filePath);

        if (isJson) {
          outputJson({ name: kebabName, ...result });
          return;
        }

        if (result.valid) {
          output(chalk.green(`  ✔ ${kebabName} — valid`));
        } else {
          output(chalk.red(`  ✘ ${kebabName} — invalid`));
          for (const err of result.errors) {
            output(chalk.red(`    • ${err}`));
          }
        }
        for (const warn of result.warnings) {
          output(chalk.yellow(`    ⚠ ${warn}`));
        }
      } else {
        // Validate all skills
        const skills = listSkillFiles(skillsDir);
        let validCount = 0;
        let invalidCount = 0;

        const results = skills.map((skill) => {
          const filePath = join(skillsDir, skill.filename);
          const result = validateSkillFile(filePath);
          if (result.valid) validCount++;
          else invalidCount++;
          return { name: skill.name, ...result };
        });

        if (isJson) {
          outputJson({ results, validCount, invalidCount, total: skills.length });
          return;
        }

        output(chalk.bold.cyan(`  Skill Validation (${skills.length} files):`));
        outputBlank();
        for (const r of results) {
          if (r.valid) {
            output(chalk.green(`  ✔ ${r.name}`));
          } else {
            output(chalk.red(`  ✘ ${r.name}`));
            for (const err of r.errors) {
              output(chalk.red(`    • ${err}`));
            }
          }
        }
        outputBlank();
        output(chalk.dim(`  ${validCount} valid, ${invalidCount} invalid`));
      }
    });

  return cmd;
}
