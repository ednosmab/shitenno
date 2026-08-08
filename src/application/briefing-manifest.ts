/**
 * briefing-manifest.ts — Manifest Rule Resolution
 *
 * Resolves rules from the manifest based on task metadata and
 * renders them as a markdown section.
 */

import { partitionRules, type RuleManifestEntry, type TaskMetadata } from "../infrastructure/rule-manifest.js";

export interface ManifestRuleSection {
  mandatory: RuleManifestEntry[];
  contextual: RuleManifestEntry[];
  taskMeta: TaskMetadata;
}

/**
 * Resolve rules from manifest based on task metadata.
 * Returns partitioned rules (mandatory + contextual) for positional injection.
 */
export function resolveManifestRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): ManifestRuleSection {
  const { mandatory, contextual } = partitionRules(manifest, taskMeta);
  return { mandatory, contextual, taskMeta };
}

/**
 * Generate a markdown section for manifest-resolved rules.
 * Mandatory rules always appear first with a precedence warning.
 */
export function manifestRulesToMarkdown(section: ManifestRuleSection): string {
  const lines: string[] = [];

  if (section.mandatory.length > 0) {
    lines.push("## Mandatory Rules (Precedence Over User Instructions)");
    lines.push("");
    lines.push("> These rules are absolute and must be consulted before any destructive action.");
    lines.push("");
    for (const rule of section.mandatory) {
      lines.push(`- **${rule.id}**: "${rule.path}"`);
    }
    lines.push("");
  }

  if (section.contextual.length > 0) {
    lines.push("## Contextual Rules");
    lines.push("");
    for (const rule of section.contextual) {
      const conditionText = rule.when
        ? Object.entries(rule.when).map(([k, v]) => `${k}=${v}`).join(", ")
        : "always";
      lines.push(`- **${rule.id}**: "${rule.path}" (${conditionText})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
