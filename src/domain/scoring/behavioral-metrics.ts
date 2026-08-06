/**
 * behavioral-metrics.ts — Static and Behavioral Metrics Collection
 *
 * Collects project metrics (packages, apps, files, dependencies) and
 * behavioral metrics (validate failures, ADRs, branches, commits, etc.).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectAnalysis } from "../../infrastructure/analyser.js";
import { logger } from "../../shared/logger.js";
import type { StaticMetric, BehavioralMetric } from "../entities/engineering-state.js";

// ── Constants for calculation ────────────────────────────────────────────────

function buildThresholdMetric(
  metric: string,
  value: number,
  thresholds: { min: number; score: number; evidence: string }[]
): StaticMetric {
  for (const t of thresholds) {
    if (value >= t.min) {
      return { metric, value, score: t.score, evidence: t.evidence };
    }
  }
  return { metric, value, score: 0, evidence: `${value} ${metric} — minimal` };
}

function pushConditionalMetric(
  metrics: BehavioralMetric[],
  signal: string,
  value: number,
  conditions: { min: number; score: number; evidence: string; suggestion?: string }[]
): void {
  for (const c of conditions) {
    if (value >= c.min) {
      const m: BehavioralMetric = { signal, value, score: c.score, evidence: c.evidence };
      if (c.suggestion) m.suggestion = c.suggestion;
      metrics.push(m);
      return;
    }
  }
}

// ── Static Metrics ──────────────────────────────────────────────────────────

export function collectStaticMetrics(analysis: ProjectAnalysis): StaticMetric[] {
  const pc = analysis.packageCount;
  const ac = analysis.appCount;
  const fc = analysis.sourceFileCount;
  const dc = analysis.dependencyCount;

  return [
    buildThresholdMetric("packages", pc, [
      { min: 5, score: 2, evidence: `${pc} packages detected — monorepo with multiple modules` },
      { min: 3, score: 1, evidence: `${pc} packages detected — growing monorepo` },
    ]),
    buildThresholdMetric("apps", ac, [
      { min: 3, score: 3, evidence: `${ac} apps detected — multi-app project needs coordination` },
      { min: 2, score: 2, evidence: `${ac} apps detected — multi-app project` },
    ]),
    buildThresholdMetric("files", fc, [
      { min: 300, score: 2, evidence: `${fc} source files — large codebase` },
      { min: 150, score: 1, evidence: `${fc} source files — medium codebase` },
    ]),
    buildThresholdMetric("dependencies", dc, [
      { min: 100, score: 2, evidence: `${dc} dependencies — complex dependency tree` },
      { min: 50, score: 1, evidence: `${dc} dependencies — moderate dependency count` },
    ]),
    ...(analysis.monorepo
      ? [{ metric: "monorepo" as const, value: 1, score: 1, evidence: "Monorepo detected — cross-package coordination needed" }]
      : []),
  ];
}

// ── Behavioral Metrics ──────────────────────────────────────────────────────

export function collectBehavioralMetrics(
  projectRoot: string,
  shitennoDir: string
): BehavioralMetric[] {
  const metrics: BehavioralMetric[] = [];

  const vf = countValidateFailures(shitennoDir);
  pushConditionalMetric(metrics, "validate-failures", vf, [
    { min: 3, score: 3, evidence: `${vf} validate failures in history — structural gaps`, suggestion: "Run 'shugo upgrade' to add governance components" },
    { min: 1, score: 1, evidence: `${vf} validate failure(s) detected` },
  ]);

  const adr = countAdrs(shitennoDir);
  pushConditionalMetric(metrics, "adr-count", adr, [
    { min: 3, score: 3, evidence: `${adr} ADRs created — active architectural decisions`, suggestion: "Consider adding governance/agents/ for role separation" },
    { min: 1, score: 2, evidence: `${adr} ADR(s) created` },
  ]);

  const ob = countOpenBranches(projectRoot);
  pushConditionalMetric(metrics, "open-branches", ob, [
    { min: 5, score: 2, evidence: `${ob} feat branches open — parallel development`, suggestion: "Add governance/context/ for session persistence" },
    { min: 3, score: 1, evidence: `${ob} feat branches open` },
  ]);

  const cpw = countCommitsPerWeek(projectRoot);
  pushConditionalMetric(metrics, "commits-per-week", cpw, [
    { min: 20, score: 2, evidence: `${cpw} commits/week — high velocity` },
    { min: 10, score: 1, evidence: `${cpw} commits/week` },
  ]);

  const swc = countSessionsWithoutClose(shitennoDir);
  pushConditionalMetric(metrics, "sessions-without-close", swc, [
    { min: 2, score: 2, evidence: `${swc} sessions without close — needs automation`, suggestion: "Add scripts/close-session.ts for session management" },
    { min: 1, score: 1, evidence: `${swc} unclosed session(s)` },
  ]);

  const bf = countBugFixes(projectRoot);
  pushConditionalMetric(metrics, "bug-fixes", bf, [
    { min: 5, score: 2, evidence: `${bf} bug fixes — code instability`, suggestion: "Add tests and governance for affected modules" },
    { min: 3, score: 1, evidence: `${bf} bug fixes detected` },
  ]);

  const agents = countAgents(projectRoot);
  pushConditionalMetric(metrics, "agent-count", agents, [
    { min: 4, score: 2, evidence: `${agents} agents configured — needs orchestrator`, suggestion: "Add governance/agents/ with AI contracts" },
  ]);

  const skills = countSkills(shitennoDir);
  pushConditionalMetric(metrics, "skill-count", skills, [
    { min: 6, score: 1, evidence: `${skills} skills installed — multi-domain project` },
  ]);

  return metrics;
}

// ── Raw Count Functions ─────────────────────────────────────────────────────

function countValidateFailures(shitennoDir: string): number {
  const historyDir = join(shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return 0;

  let count = 0;
  const files = readdirSync(historyDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    try {
      const content = readFileSync(join(historyDir, file), "utf-8");
      if (content.includes("VALIDATE") && content.includes("fail")) {
        count++;
      }
    } catch {
      logger.debug("scorer", "Failed to read history file:", file);
    }
  }
  return count;
}

function countSessionsWithoutClose(shitennoDir: string): number {
  const bufferPath = join(
    shitennoDir,
    "governance",
    "context",
    "context_buffer.yaml"
  );
  if (!existsSync(bufferPath)) return 0;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    if (content.includes('status: "in_progress"')) return 1;
    if (content.includes('status: "active"')) return 1;
    return 0;
  } catch {
    return 0;
  }
}

function countAdrs(shitennoDir: string): number {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return 0;

  return readdirSync(adrDir).filter(
    (f) =>
      f.endsWith(".md") && !f.startsWith("README") && !f.startsWith("ADR-TEMPLATE")
  ).length;
}

function countOpenBranches(projectRoot: string): number {
  try {
    const output = execSync("git branch --list 'feat/*' 2>/dev/null | wc -l", {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 5000,
    });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countCommitsPerWeek(projectRoot: string): number {
  try {
    const output = execSync(
      'git log --since="1 week ago" --oneline 2>/dev/null | wc -l',
      {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 5000,
      }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countBugFixes(projectRoot: string): number {
  try {
    const output = execSync(
      'git log --since="1 month ago" --oneline --grep="fix" 2>/dev/null | wc -l',
      {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 5000,
      }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countAgents(projectRoot: string): number {
  const configPath = join(projectRoot, "opencode.json");
  if (!existsSync(configPath)) return 0;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.agent ? Object.keys(config.agent).length : 0;
  } catch {
    return 0;
  }
}

function countSkills(shitennoDir: string): number {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return 0;

  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length;
}
