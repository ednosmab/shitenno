/**
 * dynamic-rules.ts — Dynamic FORBIDDEN_OPERATIONS Generation
 *
 * Generates rules based on project history:
 * - Git incidents (force pushes, reverts)
 * - Session history (recurring errors)
 * - Pattern detection (recurring issues)
 *
 * PRINCIPLE: Rules should be born from evidence, not assumptions.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { logger } from "./logger.js";

// ── Types (re-exported from domain entities) ────────────────────────────────

import type { RuleSeverity, DynamicRule } from "./domain/entities/engineering-state.js";

export type { RuleSeverity, DynamicRule } from "./domain/entities/engineering-state.js";

// ── Git Incident Detection ─────────────────────────────────────────────────

function runGitCountQuery(command: string, projectRoot: string): number {
  const output = execSync(command, { encoding: "utf-8", cwd: projectRoot, timeout: 10000 });
  return parseInt(output.trim(), 10);
}

interface GitIncidentRuleInput {
  id: string;
  count: number;
  label: string;
  advice: string;
  severity: RuleSeverity;
}

function buildGitIncidentRule(input: GitIncidentRuleInput): DynamicRule {
  const { id, count, label, advice, severity } = input;
  return {
    id,
    rule: `This project has ${count} ${label} in the last 180 days. ${advice}`,
    source: "git-incident",
    severity,
    evidence: `${count} ${label} detected in git log`,
    generatedAt: new Date().toISOString(),
    incidentCount: count,
  };
}

function detectGitIncidents(projectRoot: string): DynamicRule[] {
  const rules: DynamicRule[] = [];

  try {
    const forcePushCount = runGitCountQuery(
      'git log --oneline --all --grep="force push" --grep="forced push" --grep="\\+\\+" --since="180 days ago" 2>/dev/null | wc -l',
      projectRoot
    );
    if (forcePushCount > 0) {
      rules.push(buildGitIncidentRule({ id: "git-force-push", count: forcePushCount, label: "force push(es)", advice: 'Avoid "git push --force" — use --force-with-lease instead.', severity: "high" }));
    }

    const revertCount = runGitCountQuery(
      'git log --oneline --all --grep="revert" --since="180 days ago" 2>/dev/null | wc -l',
      projectRoot
    );
    if (revertCount > 2) {
      rules.push(buildGitIncidentRule({ id: "git-reverts", count: revertCount, label: "revert(s)", advice: "Ensure thorough testing before merging.", severity: "medium" }));
    }

    const hotfixCount = runGitCountQuery(
      'git log --oneline --all --grep="hotfix" --grep="hot-fix" --grep="urgent" --grep="critical" --since="180 days ago" 2>/dev/null | wc -l',
      projectRoot
    );
    if (hotfixCount > 3) {
      rules.push(buildGitIncidentRule({ id: "git-hotfixes", count: hotfixCount, label: "hotfix(es)", advice: "Consider adding more pre-merge validation.", severity: "medium" }));
    }
  } catch (error) {
    logger.debug("dynamic-rules", "Suppressed error", { error });
  }

  return rules;
}

// ── History Analysis ───────────────────────────────────────────────────────

const INCIDENT_KEYWORDS = ["erro", "bug", "falhou", "rollback", "incidente", "problema", "broken", "regression"];

function extractIncidentAreas(content: string): string[] {
  const areas: string[] = [];
  for (const keyword of INCIDENT_KEYWORDS) {
    if (content.includes(keyword)) {
      const areaMatches = content.match(/(src|packages|apps|lib)\/[\w/-]+/g) || [];
      areas.push(...areaMatches);
    }
  }
  return areas;
}

function detectHistoryIncidents(_projectRoot: string, shitennoDir: string): DynamicRule[] {
  const rules: DynamicRule[] = [];
  const historyDir = join(shitennoDir, "docs", "history");

  if (!existsSync(historyDir)) return rules;

  try {
    const files = readdirSync(historyDir).filter((f: string) => f.endsWith(".md"));
    const areaIncidents: Record<string, number> = {};

    for (const file of files) {
      const content = readFileSync(join(historyDir, file), "utf-8").toLowerCase();
      const areas = extractIncidentAreas(content);
      for (const area of areas) {
        areaIncidents[area] = (areaIncidents[area] || 0) + 1;
      }
    }

    for (const [area, count] of Object.entries(areaIncidents)) {
      if (count >= 3) {
        rules.push({
          id: `history-incident-${area.replace(/[^a-z0-9]/gi, "-")}`,
          rule: `Area "${area}" has ${count} incident(s) in session history. Apply extra caution when modifying.`,
          source: "history-analysis",
          severity: count >= 5 ? "high" : "medium",
          evidence: `${count} incident(s) found in session history for ${area}`,
          generatedAt: new Date().toISOString(),
          incidentCount: count,
        });
      }
    }
  } catch (error) {
    logger.debug("dynamic-rules", "Suppressed error", { error });
  }

  return rules;
}

// ── Main Function ──────────────────────────────────────────────────────────

export function generateDynamicRules(
  projectRoot: string,
  shitennoDir: string
): DynamicRule[] {
  const rules: DynamicRule[] = [];

  // Detect from git
  rules.push(...detectGitIncidents(projectRoot));

  // Detect from history
  rules.push(...detectHistoryIncidents(projectRoot, shitennoDir));

  // Sort by severity
  const severityOrder: Record<RuleSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  rules.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Deduplicate by id
  const seen = new Set<string>();
  return rules.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function dynamicRulesToMarkdown(rules: DynamicRule[]): string {
  if (rules.length === 0) return "";

  const lines = ["## Dynamic Rules (Auto-Generated from History)", ""];
  lines.push("*These rules are generated based on your project's actual incident history.*");
  lines.push("");

  for (const rule of rules) {
    const severityIcon = rule.severity === "critical" ? "🚨" : rule.severity === "high" ? "⚠️" : "ℹ️";
    lines.push(`### ${severityIcon} ${rule.id}`);
    lines.push(`**Rule:** ${rule.rule}`);
    lines.push(`**Evidence:** ${rule.evidence}`);
    lines.push(`**Source:** ${rule.source} | **Severity:** ${rule.severity} | **Incidents:** ${rule.incidentCount}`);
    lines.push("");
  }

  return lines.join("\n");
}
