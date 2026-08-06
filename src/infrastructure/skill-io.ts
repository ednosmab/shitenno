/**
 * skill-io.ts — File operations for skill management
 *
 * Extracted from commands/skill.ts to respect the no-restricted-imports rule.
 * Command files must not import node:fs directly.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sanitizePlanName } from "../domain/rules/path-safety.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateSkillResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface SkillMeta {
  name: string;
  filename: string;
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toTitleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) meta[key.trim()] = rest.join(":").trim().replace(/^>\s*/, "");
  }
  return { meta, body: match[2]!.trim() };
}

function generateSkillTemplate(name: string, description: string): string {
  const kebabName = toKebabCase(name);
  const titleName = toTitleCase(kebabName);

  return `---
name: ${kebabName}
description: ${description}
---

# ${titleName}

Describe what this skill does and when it should be activated.

---

## When to Use

- Scenario 1: ...
- Scenario 2: ...

## Instructions

1. Step one...
2. Step two...
3. Step three...

## Examples

\`\`\`typescript
// Example usage
\`\`\`

## References

- Link to related docs or ADRs
`;
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Create a new skill file with proper frontmatter and template body.
 */
export function createSkillFile(skillsDir: string, name: string, description: string): CreateSkillResult {
  const kebabName = toKebabCase(name);
  const safeName = sanitizePlanName(kebabName);
  if (!safeName) {
    return { success: false, error: `Invalid skill name: "${name}"` };
  }

  const filePath = join(skillsDir, `${safeName}.md`);

  if (existsSync(filePath)) {
    return { success: false, error: `Skill "${safeName}" already exists at ${filePath}` };
  }

  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  const content = generateSkillTemplate(kebabName, description);
  writeFileSync(filePath, content, "utf-8");

  return { success: true, filePath };
}

/**
 * List all skill files in a directory with their metadata.
 */
export function listSkillFiles(skillsDir: string): SkillMeta[] {
  if (!existsSync(skillsDir)) return [];

  const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  return files.map((filename) => {
    const raw = readFileSync(join(skillsDir, filename), "utf-8");
    const { meta } = parseFrontmatter(raw);
    return {
      name: meta.name ?? filename.replace(/\.md$/, ""),
      filename,
    };
  });
}

/**
 * Validate a skill file's frontmatter and body.
 */
export function validateSkillFile(filePath: string): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`], warnings: [] };
  }

  const raw = readFileSync(filePath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);

  // Check frontmatter exists
  if (Object.keys(meta).length === 0 && !raw.startsWith("---")) {
    errors.push("Missing YAML frontmatter. Skill files must start with --- delimited frontmatter.");
  }

  // Check name
  if (!meta.name) {
    errors.push("Missing required field 'name' in frontmatter.");
  }

  // Check description
  if (!meta.description) {
    errors.push("Missing required field 'description' in frontmatter.");
  }

  // Check body
  if (!body || body.trim().length === 0) {
    errors.push("Skill body is empty. Add content after the frontmatter.");
  }

  // Warnings
  if (body && !body.includes("##")) {
    warnings.push("Skill body has no markdown sections (## headings). Consider adding structured sections.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
