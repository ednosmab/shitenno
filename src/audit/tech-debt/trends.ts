/**
 * trends.ts — Tech Debt Trend and Tracking Detectors
 *
 * Detects debt trends, hotspot files, domain imbalance, and accumulation rate.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";

// ── 31.4 Debt Trend ─────────────────────────────────────────────────────────

export function detectDebtTrend(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditDir = join(projectRoot, "audit-history");

  if (!existsSync(auditDir)) return issues;

  const historyFiles = readdirSync(auditDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(-2); // Last 2 snapshots

  if (historyFiles.length < 2) return issues;

  const prevFile = historyFiles[0];
  const currFile = historyFiles[1];
  if (!prevFile || !currFile) return issues;

  const prev = JSON.parse(readFileSync(join(auditDir, prevFile), "utf-8"));
  const curr = JSON.parse(readFileSync(join(auditDir, currFile), "utf-8"));

  const prevCount = prev.issues?.length || 0;
  const currCount = curr.issues?.length || 0;

  if (currCount > prevCount * 1.2) {
    issues.push({
      type: "debt_increasing",
      severity: 2,
      description: `Dívida técnica crescendo: ${prevCount} → ${currCount} issues (+${Math.round(((currCount - prevCount) / prevCount) * 100)}%)`,
      location: "audit-history",
      recommendation: "Investigar causas raiz do crescimento da dívida técnica.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 31.5 Hotspot Files ──────────────────────────────────────────────────────

export function detectHotspotFiles(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const issuesByFile = new Map<string, number>();
  for (const issue of existingIssues) {
    const file = issue.location.split(":")[0] || "unknown";
    issuesByFile.set(file, (issuesByFile.get(file) || 0) + 1);
  }

  const hotspots = Array.from(issuesByFile.entries())
    .filter(([, count]) => count > 5)
    .sort((a, b) => b[1] - a[1]);

  for (const [file, count] of hotspots.slice(0, 3)) {
    if (file && count) {
      issues.push({
        type: "debt_hotspot",
        severity: count > 10 ? 3 : 2,
        description: `Hotspot de dívida técnica: ${file} com ${count} issues`,
        location: file,
        recommendation: `Priorizar refatoração de ${file} — alto acumulo de issues.`,
        confidence: 0.85,
      });
    }
  }

  return issues;
}

// ── 31.6 Debt by Domain ─────────────────────────────────────────────────────

export function detectDebtByDomain(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const domainCount = new Map<string, number>();
  for (const issue of existingIssues) {
    const domain = issue.location.split("/")[0] || "root";
    domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
  }

  const total = existingIssues.length;
  const maxDomainCount = Math.max(...domainCount.values());
  const maxPercentage = (maxDomainCount / total) * 100;

  if (maxPercentage > 50) {
    const dominantDomain = Array.from(domainCount.entries())
      .find(([, count]) => count === maxDomainCount)?.[0] || "unknown";

    issues.push({
      type: "debt_domain_imbalance",
      severity: 2,
      description: `Dívida técnica concentrada em "${dominantDomain}" (${maxPercentage.toFixed(0)}% do total)`,
      location: "project-wide",
      recommendation: `Balancear esforço de correção — "${dominantDomain}" concentra maioria dos issues.`,
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.8 Debt Accumulation Rate ─────────────────────────────────────────────

export function detectDebtAccumulationRate(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditDir = join(projectRoot, "audit-history");

  if (!existsSync(auditDir)) return issues;

  const historyFiles = readdirSync(auditDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(-2);

  if (historyFiles.length < 2) return issues;

  const prevFile = historyFiles[0];
  const currFile = historyFiles[1];
  if (!prevFile || !currFile) return issues;

  const prev = JSON.parse(readFileSync(join(auditDir, prevFile), "utf-8"));
  const curr = JSON.parse(readFileSync(join(auditDir, currFile), "utf-8"));

  const prevCount = prev.issues?.length || 0;
  const currCount = curr.issues?.length || 0;

  if (prevCount > 0) {
    const growthRate = ((currCount - prevCount) / prevCount) * 100;

    if (growthRate > 20) {
      issues.push({
        type: "debt_accelerating",
        severity: growthRate > 50 ? 3 : 2,
        description: `Taxa de acumulação de dívida acelerando: +${growthRate.toFixed(0)}% entre auditorias`,
        location: "audit-history",
        recommendation: "Implementar gates de qualidade no CI/CD para frear acumulação.",
        confidence: 0.9,
      });
    }
  }

  return issues;
}
