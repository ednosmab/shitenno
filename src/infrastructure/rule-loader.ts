/**
 * rule-loader.ts — Adaptive Rule Loader
 *
 * Parses AGENTS.md rules and filters them based on project complexity.
 * Only rules whose required capabilities are active will be loaded.
 *
 * Flow: detectComplexity() → parseRules() → filterRulesByCapabilities()
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { detectComplexity, type ProjectComplexity } from "./complexity-detector.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  number: number;
  title: string;
  requires: string[];
  content: string;
}

export interface ActiveRulesResult {
  rules: Rule[];
  complexity: ProjectComplexity;
  capabilities: string[];
  loadedCount: number;
  totalCount: number;
}

// ── Registry Loading ───────────────────────────────────────────────────────

/**
 * Parse the REGISTRY.md file to get rule → capability mappings.
 */
function loadRegistry(shitennoDir: string): Map<number, string[]> {
  const registryPath = join(shitennoDir, "docs", "REGISTRY.md");
  const map = new Map<number, string[]>();

  if (!existsSync(registryPath)) return map;

  const content = readFileSync(registryPath, "utf-8");
  const rowRegex = /^\|\s*#(\d+)\s*\|\s*\w+\s*\|\s*`([^`]+)`\s*\|\s*.+\|$/gm;
  let match;

  while ((match = rowRegex.exec(content)) !== null) {
    const num = parseInt(match[1]!, 10);
    const requires = match[2]!.split(",").map((s) => s.trim());
    map.set(num, requires);
  }

  return map;
}

// ── Rule Parsing ───────────────────────────────────────────────────────────

/**
 * Parse rules from AGENTS.md.
 * Looks for numbered rules in format: "N. **TITLE**..."
 */
export function parseRules(agentsPath: string): Rule[] {
  if (!existsSync(agentsPath)) return [];

  const content = readFileSync(agentsPath, "utf-8");
  const rules: Rule[] = [];

  // Match lines like: "1. **COMMIT_PERMISSION**..." or "1. **Rule Title**"
  const ruleRegex = /^(\d+)\.\s+\*\*(.+?)\*\*[:\s]*(.*)/gm;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const number = parseInt(match[1]!, 10);
    const title = match[2]!;
    const rest = match[3] ?? "";

    // Check for explicit (requires: ...) in the rule text
    const requiresMatch = rest.match(/\(requires:\s*(.+?)\)/);
    const requires = requiresMatch
      ? requiresMatch[1]!.split(",").map((r) => r.trim())
      : ["core"]; // Default: core only

    rules.push({
      id: `RULE_${number}`,
      number,
      title,
      requires,
      content: match[0],
    });
  }

  return rules;
}

// ── Filtering ──────────────────────────────────────────────────────────────

/**
 * Filter rules based on installed capabilities.
 * A rule is included only if ALL its required capabilities are active.
 */
export function filterRulesByCapabilities(
  rules: Rule[],
  installedCapabilities: string[]
): Rule[] {
  return rules.filter((rule) =>
    rule.requires.every((req) => installedCapabilities.includes(req))
  );
}

// ── Main API ───────────────────────────────────────────────────────────────

/**
 * Get active rules for the current project.
 *
 * @param projectRoot - Root directory of the project
 * @param shitennoDir - Path to shitenno/ directory
 * @returns Filtered rules, complexity info, and counts
 */
export function getActiveRules(
  projectRoot: string,
  shitennoDir: string
): ActiveRulesResult {
  const complexity = detectComplexity(projectRoot);
  const agentsPath = join(shitennoDir, "docs", "AGENTS.md");

  // Load registry for capability metadata
  const registry = loadRegistry(shitennoDir);

  // Parse all rules from AGENTS.md
  const allRules = parseRules(agentsPath);

  // Enrich rules with registry capabilities if available
  const enrichedRules = allRules.map((rule) => {
    const registryRequires = registry.get(rule.number);
    if (registryRequires && rule.requires.length === 1 && rule.requires[0] === "core") {
      return { ...rule, requires: registryRequires };
    }
    return rule;
  });

  // Filter by active capabilities
  const activeRules = filterRulesByCapabilities(enrichedRules, complexity.recommendedCapabilities);

  return {
    rules: activeRules,
    complexity: complexity.level,
    capabilities: complexity.recommendedCapabilities,
    loadedCount: activeRules.length,
    totalCount: enrichedRules.length,
  };
}
