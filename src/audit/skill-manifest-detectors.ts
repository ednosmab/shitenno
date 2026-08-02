/**
 * skill-manifest-detectors.ts — Audit detectors for skill manifest consistency
 *
 * Layer 2 of PLAN_skill_routing_verification.md:
 * Detects skills that exist as files but have no manifest entry,
 * and manifest entries that point to non-existent files.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { HealthIssue } from "./types.js";
import { loadSkillManifest } from "../skill-manifest.js";

/**
 * Detect skills that exist as files but have no entry in skill-manifest.yaml —
 * meaning they can never be resolved by getSkills(taskMeta) or getBriefing,
 * only reached by an agent that already knows the exact name to ask for.
 * This is the exact failure mode that left tdd_workflow unreferenced in practice.
 */
export function detectOrphanSkillFiles(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skillsDir = join(shitennoDir, "docs", "skills");
  const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");

  if (!existsSync(skillsDir)) return issues;

  let manifestIds = new Set<string>();
  if (existsSync(manifestPath)) {
    try {
      manifestIds = new Set(loadSkillManifest(manifestPath).map((s) => s.id));
    } catch (err) {
      logger.debug("skill-manifest-detectors", "Failed to parse skill-manifest.yaml:", err);
    }
  }

  const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const id = file.replace(".md", "");
    if (!manifestIds.has(id)) {
      issues.push({
        type: "orphan_skill",
        severity: 2,
        description: `Skill "${id}" exists in docs/skills/ but has no entry in skill-manifest.yaml — it will never be auto-resolved for any task, only fetched by an agent that already knows its exact name.`,
        location: `shitenno/docs/skills/${file}`,
        recommendation: `Add an entry for "${id}" to governance/skill-manifest.yaml with an appropriate \`when\` clause, or remove the skill if it's no longer relevant.`,
        confidence: 0.95,
      });
    }
  }

  return issues;
}

/**
 * Inverse check: every manifest entry must point at a file that exists.
 * Catches typos and stale references after a skill file is renamed/deleted.
 */
export function detectBrokenSkillManifestEntries(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");
  if (!existsSync(manifestPath)) return issues;

  let entries: ReturnType<typeof loadSkillManifest> = [];
  try {
    entries = loadSkillManifest(manifestPath);
  } catch (err) {
    logger.debug("skill-manifest-detectors", "Failed to parse skill-manifest.yaml:", err);
    return issues;
  }

  for (const entry of entries) {
    if (!existsSync(join(shitennoDir, entry.path))) {
      issues.push({
        type: "broken_skill_manifest_entry",
        severity: 3,
        description: `skill-manifest.yaml entry "${entry.id}" points to "${entry.path}", which does not exist.`,
        location: "shitenno/governance/skill-manifest.yaml",
        recommendation: `Fix the path for "${entry.id}" or remove the entry.`,
        confidence: 1.0,
      });
    }
  }

  return issues;
}
