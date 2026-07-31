/**
 * reporter.ts — Taint Analysis Reporter
 *
 * Converts taint analysis results into HealthIssue format
 * for integration with the shugo audit system.
 */

import type { TaintIssue, TaintIssueType } from "./types.js";
/** Local HealthIssue interface to avoid circular dependency */
export interface HealthIssue {
  type:
    | "tainted_input" | "open_redirect" | "ssrf" | "log_injection"
    | "code_injection" | "command_injection" | "path_traversal"
    | "sql_injection" | "nosql_injection" | "xss_risk" | "ssti"
    | string; // Allow other issue types from health-auditor
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  recommendation: string;
}

/** Convert a TaintIssue to a HealthIssue */
export function taintIssueToHealthIssue(issue: TaintIssue): HealthIssue {
  const typeMap: Record<TaintIssueType, HealthIssue["type"]> = {
    tainted_input: "tainted_input",
    open_redirect: "open_redirect",
    ssrf: "ssrf",
    log_injection: "log_injection",
    code_injection: "unsafe_eval",
    command_injection: "hardcoded_secret",
    path_traversal: "path_traversal",
    sql_injection: "sql_injection",
    nosql_injection: "nosql_injection",
    xss_risk: "xss_risk",
    ssti: "ssti",
  };

  return {
    type: typeMap[issue.type] ?? "tainted_input",
    severity: issue.severity,
    description: issue.description,
    location: issue.location,
    recommendation: issue.recommendation,
  };
}

/** Group taint issues by file */
export function groupByFile(issues: TaintIssue[]): Map<string, TaintIssue[]> {
  const grouped = new Map<string, TaintIssue[]>();
  for (const issue of issues) {
    const file = issue.location.split(":")[0] ?? "unknown";
    const existing = grouped.get(file) ?? [];
    existing.push(issue);
    grouped.set(file, existing);
  }
  return grouped;
}

/** Get summary statistics */
export function getTaintSummary(issues: TaintIssue[]): {
  total: number;
  critical: number;
  warnings: number;
  info: number;
  byType: Record<TaintIssueType, number>;
  byFile: number;
} {
  const byType: Record<string, number> = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] ?? 0) + 1;
  }

  const grouped = groupByFile(issues);

  return {
    total: issues.length,
    critical: issues.filter((i) => i.severity === 3).length,
    warnings: issues.filter((i) => i.severity === 2).length,
    info: issues.filter((i) => i.severity === 1).length,
    byType: byType as Record<TaintIssueType, number>,
    byFile: grouped.size,
  };
}
