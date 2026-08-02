/**
 * Validator: check that all docs have valid YAML frontmatter with category and lifecycle.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import {
  ROOT_DOCS,
  type ValidatorContext,
  type FixAction,
  pass,
  warn,
  error,
  dryLog,
  walkDir,
} from "./shared.js";

const VALID_CATEGORIES = [
  "architecture",
  "domain",
  "implementation",
  "engineering",
  "evolution",
  "philosophy",
  "adr",
  "reference",
  "product",
];

const VALID_LIFECYCLES = ["Draft", "Active", "Deprecated", "Historical", "Archived"];

function determineCategory(relPath: string): string {
  if (relPath.startsWith("architecture/")) return "architecture";
  if (relPath.startsWith("domain/")) return "domain";
  if (relPath.startsWith("implementation/")) return "implementation";
  if (relPath.startsWith("engineering/")) return "engineering";
  if (relPath.startsWith("evolution/")) return "evolution";
  if (relPath.startsWith("handbook/philosophy/")) return "philosophy";
  if (relPath.startsWith("adr/")) return "adr";
  if (relPath.startsWith("reference/")) return "reference";
  if (relPath.startsWith("plans/")) return "product";
  if (relPath.startsWith("history/")) return "reference";
  if (relPath.startsWith("backlog/")) return "product";
  if (relPath.startsWith("feedback/")) return "engineering";
  if (relPath.startsWith("tests/")) return "engineering";
  if (relPath.startsWith("handbook/02-commands/")) return "reference";
  if (relPath.startsWith("handbook/03-architecture/")) return "architecture";
  return "product";
}

function determineLifecycle(relPath: string): string {
  if (relPath.startsWith("history/")) return "Historical";
  if (relPath.startsWith("feedback/")) return "Historical";
  if (relPath.startsWith("backlog/")) return "Draft";
  return "Active";
}

function parseFrontmatter(content: string): { valid: boolean; fields: Record<string, string> } {
  const lines = content.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { valid: false, fields: {} };
  }

  const fields: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") break;
    const match = lines[i].match(/^(\w+):\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }
  return { valid: true, fields };
}

function buildFrontmatter(category: string, lifecycle: string): string {
  return `---\ncategory: ${category}\nlifecycle: ${lifecycle}\n---\n\n`;
}

export function checkDocsFrontmatter(ctx: ValidatorContext) {
  console.log("\n📋 Checking docs frontmatter (category + lifecycle)...\n");

  const files = walkDir(ROOT_DOCS).filter((f) => f.endsWith(".md") && !f.endsWith("README.md"));
  let passCount = 0;
  let errorCount = 0;

  for (const relPath of files) {
    const fullPath = resolve(ROOT_DOCS, relPath);
    const content = readFileSync(fullPath, "utf-8");
    const { valid, fields } = parseFrontmatter(content);

    if (!valid) {
      const category = determineCategory(relPath);
      const lifecycle = determineLifecycle(relPath);
      const fixAction: FixAction = {
        file: relPath,
        description: `Add frontmatter with category=${category}, lifecycle=${lifecycle}`,
        apply: () => {
          const current = readFileSync(fullPath, "utf-8");
          writeFileSync(fullPath, buildFrontmatter(category, lifecycle) + current, "utf-8");
        },
      };
      ctx.fixActions.push(fixAction);

      if (ctx.DRY_RUN) {
        dryLog(ctx, `${relPath} — missing frontmatter (category: ${category}, lifecycle: ${lifecycle})`);
      } else if (ctx.FIX) {
        fixAction.apply();
        pass(ctx, `${relPath} — frontmatter added`);
      } else {
        error(ctx, `${relPath} — missing YAML frontmatter (category + lifecycle)`, relPath, true);
      }
      errorCount++;
    } else {
      const missingFields: string[] = [];
      if (!fields.category) missingFields.push("category");
      if (!fields.lifecycle) missingFields.push("lifecycle");

      if (missingFields.length > 0) {
        const category = fields.category || determineCategory(relPath);
        const lifecycle = fields.lifecycle || determineLifecycle(relPath);
        const fixAction: FixAction = {
          file: relPath,
          description: `Add missing fields: ${missingFields.join(", ")}`,
          apply: () => {
            const current = readFileSync(fullPath, "utf-8");
            const lines = current.split("\n");
            const closingIdx = lines.indexOf("---", 1);
            const additions = missingFields
              .map((f) => `${f}: ${f === "category" ? category : lifecycle}`)
              .join("\n");
            lines.splice(closingIdx, 0, additions);
            writeFileSync(fullPath, lines.join("\n"), "utf-8");
          },
        };
        ctx.fixActions.push(fixAction);

        if (ctx.DRY_RUN) {
          dryLog(ctx, `${relPath} — missing fields: ${missingFields.join(", ")}`);
        } else if (ctx.FIX) {
          fixAction.apply();
          pass(ctx, `${relPath} — fields added`);
        } else {
          error(ctx, `${relPath} — missing frontmatter fields: ${missingFields.join(", ")}`, relPath, true);
        }
        errorCount++;
      } else {
        if (!VALID_CATEGORIES.includes(fields.category)) {
          error(ctx, `${relPath} — invalid category: "${fields.category}"`, relPath, false);
          errorCount++;
        } else if (!VALID_LIFECYCLES.includes(fields.lifecycle)) {
          error(ctx, `${relPath} — invalid lifecycle: "${fields.lifecycle}"`, relPath, false);
          errorCount++;
        } else {
          passCount++;
        }
      }
    }
  }

  if (errorCount === 0) {
    pass(ctx, `All ${passCount} docs have valid frontmatter`);
  }
}
