/**
 * scaffold/skills.ts — Skills Selection and Copying
 */

import { copySync, existsSync } from "fs-extra";
import { join } from "node:path";
import type { Capability } from "../maturity-profile.js";
import { SHITENNO_DIR_NAME } from "../constants.js";

export function selectSkills(capabilities: Capability[]): string[] {
  const coreSkills = [
    "senior-engineer",
    "tdd-agent",
    "tdd_workflow",
    "clean_code_standards",
    "solid_principles",
    "architectural_integrity",
    "design_patterns",
    "error_handling_observability",
    "pnpm_management",
    "optimistic_ui",
    "codebase_hygiene_git",
  ];

  const archSkills = [
    "ddd_patterns",
    "domain_driven_design_(ddd)",
  ];

  const govSkills = [
    "operacao_no_shitenno",
    "quick-board-enforcement",
    "system-first",
  ];

  const aiSkills = [
    "animation_protocol",
    "ci_cd_pipeline",
    "responsividade",
    "state_management_protocol",
    "ui_ux_principles",
  ];

  const advancedSkills = [
    "nextjs_performance_seo",
    "postgresql_performance",
    "security_xss_prevention",
  ];

  const selected = [...coreSkills];

  if (capabilities.includes("architecture")) selected.push(...archSkills);
  if (capabilities.includes("governance")) selected.push(...govSkills);
  if (capabilities.includes("ai")) selected.push(...aiSkills);
  if (capabilities.includes("compliance") || capabilities.includes("metrics")) selected.push(...advancedSkills);

  return selected;
}

export function copySkills(ctx: {
  targetDir: string;
  baseDir: string;
  capabilities: Capability[];
  allDirs: Set<string>;
  result: { filesCreated: string[] };
}): void {
  if (!ctx.capabilities.includes("knowledge") || !ctx.allDirs.has(`${SHITENNO_DIR_NAME}/docs/skills`)) return;
  const skillsDir = join(ctx.baseDir, "docs/skills");
  const selectedSkills = selectSkills(ctx.capabilities);
  for (const skill of selectedSkills) {
    const srcPath = join(skillsDir, `${skill}.md`);
    if (!existsSync(srcPath)) continue;
    const destPath = join(ctx.targetDir, SHITENNO_DIR_NAME, "docs", "skills", `${skill}.md`);
    copySync(srcPath, destPath);
    ctx.result.filesCreated.push(`${SHITENNO_DIR_NAME}/docs/skills/${skill}.md`);
  }
}
