import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { collectContext } from "../application/context-collector.js";
import { detectKnowledgeDebt } from "../knowledge-debt/engine.js";
import { loadGrowthProfile } from "../infrastructure/growth-profile.js";
import type { ToolResponse } from "../domain/types/mcp-types.js";

type AuditReport = {
  healthScore: number;
  dimensionScores?: Record<string, number>;
  issues: Array<{ type: string; severity: number; description: string; location: string }>;
  suppressedIssues?: unknown[];
  optimizations?: unknown[];
  summary?: string;
  auditedAt?: string;
  level?: string;
  filesScanned?: number;
  detectorsRun?: string[];
};

function formatAuditReportSummary(report: AuditReport, latest: string): string {
  const lines: string[] = [
    `Health Score: ${report.healthScore}/100`,
    `Report: ${latest}`,
    `Audited: ${report.auditedAt ?? "unknown"}`,
    `Level: ${report.level ?? "unknown"}`,
    `Files scanned: ${report.filesScanned ?? "unknown"}`,
    "",
  ];

  if (report.dimensionScores) {
    lines.push("Dimension Scores:");
    for (const [dim, score] of Object.entries(report.dimensionScores)) {
      lines.push(`  ${dim}: ${score}`);
    }
    lines.push("");
  }

  const critical = report.issues.filter(i => i.severity === 3);
  const warnings = report.issues.filter(i => i.severity === 2);
  const info = report.issues.filter(i => i.severity === 1);

  lines.push(`Issues: ${critical.length} critical, ${warnings.length} warnings, ${info.length} info`);
  if (report.suppressedIssues && report.suppressedIssues.length > 0) {
    lines.push(`Suppressed: ${report.suppressedIssues.length}`);
  }
  if (report.optimizations && report.optimizations.length > 0) {
    lines.push(`Optimizations proposed: ${report.optimizations.length}`);
  }

  if (critical.length > 0) {
    lines.push("");
    lines.push("Critical Issues:");
    for (const issue of critical.slice(0, 5)) {
      lines.push(`  - [${issue.type}] ${issue.description}`);
      lines.push(`    Location: ${issue.location}`);
    }
  }

  return lines.join("\n");
}

function resolveLatestReport(
  reportsDir: string,
  dateFilter: string | undefined
): { latest: string; error?: ToolResponse } | { latest: string; error?: never } {
  const allFiles = readdirSync(reportsDir)
    .filter(f => f.startsWith("health-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (allFiles.length === 0) {
    return { latest: "", error: { content: [{ type: "text", text: "No audit reports found. Run 'shugo audit' first." }] } };
  }

  if (dateFilter) {
    const target = `health-${dateFilter}.json`;
    if (!allFiles.includes(target)) {
      const available = allFiles.map(f => f.replace("health-", "").replace(".json", "")).join(", ");
      return { latest: "", error: { content: [{ type: "text", text: `No audit report found for date '${dateFilter}'. Available dates: ${available || "none"}` }] } };
    }
    return { latest: target };
  }

  return { latest: allFiles[0]! };
}

export function handleGetAuditReport(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "json";
  const dateFilter = args.date as string | undefined;
  const reportsDir = join(shitennoDir, "reports");

  if (!existsSync(reportsDir)) {
    return { content: [{ type: "text", text: "No audit reports found. Run 'shugo audit' first." }] };
  }

  const { latest, error } = resolveLatestReport(reportsDir, dateFilter);
  if (error) return error;

  const reportPath = join(reportsDir, latest);
  let report: AuditReport;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf-8"));
  } catch (parseError) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError);
    return { content: [{ type: "text", text: `Failed to parse audit report '${latest}': ${msg}. The file may be corrupted. Run 'shugo audit' to regenerate.` }] };
  }

  if (format === "summary") {
    return { content: [{ type: "text", text: formatAuditReportSummary(report, latest) }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
}

export function handleGetKnowledgeDebt(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "json";

  const report = detectKnowledgeDebt(projectRoot, shitennoDir);

  if (format === "summary") {
    const lines: string[] = [
      report.summary,
      "",
      `Health Score: ${report.healthScore}/100`,
      "",
    ];

    if (report.gaps.length > 0) {
      lines.push("Gaps by severity:");
      for (const [sev, count] of Object.entries(report.gapsBySeverity)) {
        if (count > 0) lines.push(`  ${sev}: ${count}`);
      }
      lines.push("");

      const critical = report.gaps.filter(g => g.severity === "critical");
      if (critical.length > 0) {
        lines.push("Critical gaps:");
        for (const gap of critical) {
          lines.push(`  - [${gap.type}] ${gap.description}`);
        }
      }
    }

    if (report.recommendations.length > 0) {
      lines.push("Recommendations:");
      for (const rec of report.recommendations.slice(0, 5)) {
        lines.push(`  \u2192 ${rec}`);
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
}

export function handleGetChallenges(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "json";

  const profile = loadGrowthProfile(shitennoDir);
  if (!profile) {
    return { content: [{ type: "text", text: "No growth profile found. Run shugo assess first." }] };
  }

  const snapshot = collectContext(projectRoot, shitennoDir);
  const recommendations = snapshot.briefing?.recommendations ?? [];

  const challenges = recommendations.map((rec, idx) => ({
    original: rec,
    paradigmShift: {
      currentParadigm: "Following the recommendation as stated",
      newParadigm: "Understanding the underlying principle and applying it creatively",
      shiftDescription: `From surface-level action to deep understanding: ${rec}`,
      difficulty: "moderate" as const,
    },
    challengeLevel: profile.challengeLevel,
    index: idx,
  }));

  if (format === "summary") {
    const lines: string[] = [
      `Challenge Level: ${profile.challengeLevel}`,
      `Growth Capacity: ${profile.growthCapacity}`,
      `Recommendations analysed: ${challenges.length}`,
      "",
    ];

    lines.push(`${challenges.length} challenge(s) with paradigm shifts:`);
    for (const ch of challenges) {
      const shift = ch.paradigmShift;
      lines.push(`  [${ch.index + 1}] ${ch.original}`);
      lines.push(`      Shift: ${shift.currentParadigm} \u2192 ${shift.newParadigm}`);
      lines.push(`      Difficulty: ${shift.difficulty}`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(challenges, null, 2) }] };
}
