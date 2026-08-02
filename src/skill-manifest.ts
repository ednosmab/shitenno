/**
 * skill-manifest.ts — Declarative Skill Selection by Task Metadata
 *
 * PRINCIPLE: Explicit field matching, no inference.
 * Same input -> same skill set, always (deterministic).
 *
 * This module uses manifest-resolver.ts with unconditionalMandatory: false
 * (mandatory skills still need `when` to match; `mandatory` only means
 * "not optional once in scope", not "always in scope").
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import {
  resolveEntries,
  partitionEntries,
  type ManifestEntry,
  type TaskMetadata,
} from "./manifest-resolver.js";

export type { TaskMetadata };
export type SkillManifestEntry = ManifestEntry;

export function loadSkillManifest(manifestPath: string): SkillManifestEntry[] {
  const raw = readFileSync(manifestPath, "utf-8");
  return (parseYaml(raw) as { skills: SkillManifestEntry[] }).skills;
}

/**
 * Resolve which skills apply to a task, ordered by priority (0 = highest).
 * Mandatory skills still need `when` to match (unlike rules).
 */
export function resolveSkills(
  manifest: SkillManifestEntry[],
  taskMeta: TaskMetadata
): SkillManifestEntry[] {
  return resolveEntries(manifest, taskMeta, { unconditionalMandatory: false });
}

/**
 * Separate skills into mandatory and contextual groups.
 * Useful for positional injection in MCP responses.
 */
export function partitionSkills(
  manifest: SkillManifestEntry[],
  taskMeta: TaskMetadata
): { mandatory: SkillManifestEntry[]; contextual: SkillManifestEntry[] } {
  return partitionEntries(manifest, taskMeta, { unconditionalMandatory: false });
}
