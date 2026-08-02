/**
 * rule-manifest.ts — Declarative Rule Selection by Task Metadata
 *
 * PRINCIPLE: Explicit field matching, no inference.
 * Same input -> same rule set, always (deterministic).
 *
 * This module is a thin wrapper around manifest-resolver.ts with
 * unconditionalMandatory: true (mandatory rules always apply, ignoring `when`).
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
export type RuleManifestEntry = ManifestEntry;

export function loadManifest(manifestPath: string): RuleManifestEntry[] {
  const raw = readFileSync(manifestPath, "utf-8");
  const parsed = parseYaml(raw) as { rules: RuleManifestEntry[] };
  return parsed.rules;
}

/**
 * Resolve which rules apply to a task, ordered by priority
 * (0 = highest). Mandatory rules always apply regardless of `when`.
 */
export function resolveRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): RuleManifestEntry[] {
  return resolveEntries(manifest, taskMeta, { unconditionalMandatory: true });
}

/**
 * Separate rules into mandatory and contextual groups.
 * Useful for positional injection in prompts and MCP responses.
 */
export function partitionRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): { mandatory: RuleManifestEntry[]; contextual: RuleManifestEntry[] } {
  return partitionEntries(manifest, taskMeta, { unconditionalMandatory: true });
}
