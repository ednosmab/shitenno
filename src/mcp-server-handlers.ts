import { collectContext } from "./context-collector.js";
import { generateRiskMap, type RiskMap } from "./risk-map.js";
import {
  briefingToJson,
  briefingToSummary,
  briefingToMarkdown,
  type Briefing,
} from "./briefing.js";
import { loadRules } from "./rule-engine.js";
import { generateDynamicRules } from "./dynamic-rules.js";
import { getEngineeringState } from "./engineering-state/index.js";
import { readCache, computeInputHash, setCachedBriefing } from "./briefing-cache.js";
import { recordOutcome, createFileStorage } from "./session-feedback.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { queryDaemon, isDaemonRunning } from "./daemon-client.js";
import { sanitizePlanName } from "./path-safety.js";
import { listAdrs, getAdr, listSkills, getSkill } from "./knowledge-loader.js";
import { loadManifest, partitionRules } from "./rule-manifest.js";
import { loadSkillManifest, partitionSkills, type TaskMetadata } from "./skill-manifest.js";
import { logger } from "./logger.js";
import { recordSkillResolution } from "./context-buffer-writer.js";
import { detectKnowledgeDebt } from "./knowledge-debt/engine.js";
import { loadGrowthProfile } from "./growth-profile.js";
import { readMaturityHistory } from "./maturity-profile/telemetry.js";
import { readBuffer } from "./context-buffer-writer/buffer-io.js";

import type { ToolResponse } from "./mcp-types.js";

function formatBriefingMarkdown(
  briefing: Briefing,
  mandatorySkills: Array<{ id: string; name: string; content: string }>
): string {
  let md = briefingToMarkdown(briefing);
  if (mandatorySkills.length > 0) {
    md += "\n\n## Mandatory Skills (auto-attached)\n\n";
    for (const s of mandatorySkills) {
      md += `### ${s.name}\n${s.content}\n\n`;
    }
  }
  return md;
}

function formatBriefingJson(
  briefing: Briefing,
  json: Record<string, unknown>,
  mandatorySkills: Array<{ id: string; name: string; content: string }>,
  depth: string
): string {
  if (mandatorySkills.length > 0) {
    json.mandatorySkills = mandatorySkills.map((s) => ({
      id: s.id,
      name: s.name,
      content: s.content,
    }));
  }
  if (depth === "minimal") {
    return JSON.stringify({
      project: briefing.project,
      risks: briefing.risks,
      recommendations: briefing.recommendations.slice(0, 1),
      mandatorySkills: mandatorySkills.map((s) => ({ id: s.id, name: s.name })),
    }, null, 2);
  }
  if (depth === "full") {
    return JSON.stringify({
      ...json,
      quickBoard: briefing.quickBoard,
      tokenEconomy: briefing.tokenEconomy,
    }, null, 2);
  }
  return JSON.stringify(json, null, 2);
}

export async function handleGetBriefing(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";
  const depth = (args.depth as string) ?? "standard";
  const task = args.task as string | undefined;

  let briefing: Briefing;
  if (isDaemonRunning(shitennoDir)) {
    const result = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    briefing = result?.data ?? collectContext(projectRoot, shitennoDir).briefing;
  } else {
    briefing = collectContext(projectRoot, shitennoDir).briefing;
  }

  const taskMeta: TaskMetadata = { task };
  const { skills: mandatorySkills, manifestEntries } = loadMandatorySkillsForTask(shitennoDir, taskMeta);

  // Record runtime evidence for mandatory skill resolutions via briefing
  if (task && manifestEntries.length > 0) {
    for (const entry of manifestEntries) {
      recordSkillResolution(shitennoDir, {
        skillId: entry.id,
        reason: "mandatory",
        taskMeta: `task=${task}`,
        resolvedAt: new Date().toISOString(),
      });
    }
  }

  if (format === "markdown") {
    return { content: [{ type: "text", text: formatBriefingMarkdown(briefing, mandatorySkills) }] };
  }
  if (format === "summary") {
    return { content: [{ type: "text", text: briefingToSummary(briefing) }] };
  }

  // Write briefing cache so submitFeedback can link feedback to this briefing
  const inputHash = computeInputHash({
    fingerprintHash: briefing.generatedAt,
    riskMapHash: briefing.risks.overall,
    contextRuleCount: briefing.tokenEconomy.contextRuleCount,
    dynamicRuleCount: briefing.tokenEconomy.dynamicRuleCount,
    maturityScore: briefing.project.maturityScore,
  });
  setCachedBriefing(shitennoDir, briefing, inputHash);

  const json = briefingToJson(briefing);
  return { content: [{ type: "text", text: formatBriefingJson(briefing, json, mandatorySkills, depth) }] };
}

export async function handleGetRiskMap(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";

  let riskMap: RiskMap;
  if (isDaemonRunning(shitennoDir)) {
    const result = await queryDaemon<{ type: string; data: RiskMap }>(shitennoDir, {
      type: "query_riskmap",
    });
    riskMap = result?.data ?? generateRiskMap(projectRoot, shitennoDir);
  } else {
    riskMap = generateRiskMap(projectRoot, shitennoDir);
  }

  if (format === "summary") {
    const lines: string[] = [
      `Overall Risk: ${riskMap.overallRisk} (${riskMap.overallScore}/100)`,
      `Areas analysed: ${riskMap.areas.length}`,
      "",
    ];

    const critical = riskMap.areas.filter(
      (a) => a.riskLevel === "critical" || a.riskLevel === "high"
    );
    if (critical.length > 0) {
      lines.push("High/Critical areas:");
      for (const area of critical) {
        lines.push(`  - ${area.path}: ${area.riskLevel} (${area.score}/100, ${area.fileCount} files)`);
        for (const factor of area.factors.slice(0, 3)) {
          lines.push(`    • ${factor.description}`);
        }
      }
    } else {
      lines.push("All areas within acceptable risk levels.");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(riskMap, null, 2) }] };
}

function loadMandatoryRules(shitennoDir: string) {
  try {
    const manifestPath = join(shitennoDir, "governance", "rule-manifest.yaml");
    if (existsSync(manifestPath)) {
      const manifest = loadManifest(manifestPath);
      const { mandatory } = partitionRules(manifest, {});
      return mandatory.map((r) => ({ id: r.id, path: r.path, priority: r.priority }));
    }
  } catch (err) {
    logger.debug("mcp-server-handlers", `Failed to load mandatory rules: ${err}`);
  }
  return [];
}

/**
 * Load mandatory skills for the given task metadata.
 * Used by handleGetBriefing to pre-attach mandatory skills so agents
 * don't need a separate getSkills call.
 */
function loadMandatorySkillsForTask(
  shitennoDir: string,
  taskMeta: TaskMetadata
): { skills: Array<{ id: string; name: string; content: string }>; manifestEntries: ReturnType<typeof partitionSkills>["mandatory"] } {
  try {
    const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");
    if (existsSync(manifestPath)) {
      const manifest = loadSkillManifest(manifestPath);
      const { mandatory } = partitionSkills(manifest, taskMeta);
      const skills = mandatory
        .map((entry) => {
          const skill = getSkill(shitennoDir, entry.id);
          return skill ? { id: entry.id, name: skill.name, content: skill.content } : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      return { skills, manifestEntries: mandatory };
    }
  } catch (err) {
    logger.debug("mcp-server-handlers", `Failed to load mandatory skills: ${err}`);
  }
  return { skills: [], manifestEntries: [] };
}

async function fetchContextRules(
  projectRoot: string,
  shitennoDir: string
) {
  let snapshot;
  if (isDaemonRunning(shitennoDir)) {
    const briefingResult = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    if (briefingResult?.data) {
      snapshot = { contextRules: collectContext(projectRoot, shitennoDir).contextRules };
    } else {
      snapshot = collectContext(projectRoot, shitennoDir);
    }
  } else {
    snapshot = collectContext(projectRoot, shitennoDir);
  }
  return snapshot.contextRules.map((r) => ({
    id: r.id, rule: r.rule, rationale: r.rationale, priority: r.priority, area: r.area, basedOn: r.basedOn,
  }));
}

function formatRulesMarkdown(result: {
  mandatoryRules: Array<{ id: string; path: string; priority: number }>;
  contextRules: Array<{ id: string; rule: string; rationale: string; priority: number; area: string; basedOn: string }>;
  dynamicRules: Array<{ id: string; rule: string; severity: string; evidence: string; source: string }>;
  engineRules: Array<{ id: string; description: string; trigger: string; priority: number; enabled: boolean; conditions: unknown[]; actions: unknown[] }>;
}): string {
  const lines: string[] = ["# Governance Rules", ""];

  if (result.mandatoryRules.length > 0) {
    lines.push("## Mandatory Rules (Precedence Over User Instructions)");
    lines.push("");
    lines.push("> These rules are absolute. Consult them before any destructive action.");
    lines.push("");
    for (const r of result.mandatoryRules) {
      lines.push(`### ${r.id}`, `**Path:** \`${r.path}\` | **Priority:** ${r.priority}`, "");
    }
  }

  if (result.contextRules.length > 0) {
    lines.push("## Context-Aware Rules", "");
    for (const r of result.contextRules) {
      lines.push(`### ${r.id}`, `**Rule:** ${r.rule}`, `**Rationale:** ${r.rationale}`, `**Area:** \`${r.area}\` | **Priority:** ${r.priority}`, "");
    }
  }

  if (result.dynamicRules.length > 0) {
    lines.push("## Dynamic Rules (from History)", "");
    for (const r of result.dynamicRules) {
      const icon = r.severity === "critical" ? "🚨" : r.severity === "high" ? "⚠️" : "ℹ️";
      lines.push(`### ${icon} ${r.id}`, `**Rule:** ${r.rule}`, `**Evidence:** ${r.evidence}`, `**Source:** ${r.source} | **Severity:** ${r.severity}`, "");
    }
  }

  if (result.engineRules.length > 0) {
    lines.push("## Engine Rules (Declarative)", "");
    for (const r of result.engineRules) {
      const status = r.enabled ? "✅" : "❌";
      lines.push(`### ${status} ${r.id}`, `**Description:** ${r.description}`, `**Trigger:** ${r.trigger} | **Priority:** ${r.priority}`, "");
    }
  }

  return lines.join("\n");
}

export async function handleGetRules(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const type = (args.type as string) ?? "all";
  const format = (args.format as string) ?? "json";

  const mandatoryRules = loadMandatoryRules(shitennoDir);
  const contextRules =
    type === "all" || type === "context" ? await fetchContextRules(projectRoot, shitennoDir) : [];
  const dynamicRules =
    type === "all" || type === "dynamic"
      ? generateDynamicRules(projectRoot, shitennoDir).map((r) => ({
          id: r.id, rule: r.rule, severity: r.severity, evidence: r.evidence, source: r.source,
        }))
      : [];
  const engineRules =
    type === "all" || type === "engine"
      ? loadRules(shitennoDir).map((r) => ({
          id: r.id, description: r.description, trigger: r.trigger, priority: r.priority, enabled: r.enabled, conditions: r.conditions, actions: r.actions,
        }))
      : [];

  const result = { mandatoryRules, contextRules, dynamicRules, engineRules };

  if (format === "markdown") {
    return { content: [{ type: "text", text: formatRulesMarkdown(result) }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

export async function handleGetEngineeringState(
  projectRoot: string,
  shitennoDir: string,
  _args: Record<string, unknown>
): Promise<ToolResponse> {
  try {
    const state = getEngineeringState(projectRoot, shitennoDir);
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  } catch (error) {
    throw new Error(`Failed to get engineering state: ${error}`);
  }
}


export function handleGetPlans(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) {
    return { content: [{ type: "text", text: "[]" }] };
  }

  if (args.planName && typeof args.planName === "string") {
    const safeName = sanitizePlanName(args.planName);
    const planPath = join(plansDir, safeName);
    if (!existsSync(planPath)) {
      throw new Error(`Plan not found: ${safeName}`);
    }
    const content = readFileSync(planPath, "utf-8");
    return { content: [{ type: "text", text: content }] };
  }

  const files = readdirSync(plansDir).filter(f => f.endsWith(".md"));
  return { content: [{ type: "text", text: JSON.stringify(files, null, 2) }] };
}

export function handleSubmitFeedback(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const outcome = args.outcome as "success" | "failure" | "partial";
  const notes = args.notes as string;

  if (!outcome || !notes) {
    throw new Error("Missing required arguments: outcome, notes");
  }

  const cache = readCache(shitennoDir);
  if (!cache || !cache.entry) {
    throw new Error("No briefing cache found. A briefing must be generated first.");
  }

  const storage = createFileStorage(shitennoDir);
  recordOutcome(storage, {
    briefingHash: cache.entry.inputHash,
    briefingTimestamp: cache.entry.computedAt,
    outcome,
    notes,
  });

  return { content: [{ type: "text", text: "Feedback submitted successfully." }] };
}

// ── Knowledge Bridge: ADRs & Skills ───────────────────────────────────────

export async function handleGetADRs(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const id = args.id as string | undefined;

  if (id) {
    const adr = getAdr(shitennoDir, id);
    if (!adr) {
      return { content: [{ type: "text", text: `ADR "${id}" not found` }] };
    }
    return { content: [{ type: "text", text: adr.content }] };
  }

  const summaries = listAdrs(shitennoDir);
  const text = summaries
    .map((a) => `${a.id} [${a.status}]: ${a.title}`)
    .join("\n");
  return { content: [{ type: "text", text: text || "No ADRs found." }] };
}

/**
 * Resolve skills via the skill manifest for a given task scope.
 * Returns a ToolResponse if scope resolution succeeded, or null
 * to signal the caller should fall back to the flat list.
 */
function resolveScopedSkills(
  shitennoDir: string,
  taskMeta: TaskMetadata
): ToolResponse | null {
  const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");
  if (!existsSync(manifestPath)) return null;

  try {
    const manifest = loadSkillManifest(manifestPath);
    const { mandatory, contextual } = partitionSkills(manifest, taskMeta);

    const mandatoryBlocks = mandatory
      .map((entry) => getSkill(shitennoDir, entry.id))
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => `## [MANDATORY] ${s.name}\n${s.content}`);

    const contextualList = contextual
      .map((entry) => `- ${entry.id} (available — fetch by name if needed)`)
      .join("\n");

    // Record runtime evidence for mandatory skill resolutions
    const serializedMeta = Object.entries(taskMeta)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    for (const entry of mandatory) {
      recordSkillResolution(shitennoDir, {
        skillId: entry.id,
        reason: "mandatory",
        taskMeta: serializedMeta,
        resolvedAt: new Date().toISOString(),
      });
    }

    const text = [...mandatoryBlocks, contextualList ? `## Also available for this scope\n${contextualList}` : ""]
      .filter(Boolean)
      .join("\n\n");

    return { content: [{ type: "text", text: text || "No skills matched this scope." }] };
  } catch {
    return null;
  }
}

export async function handleGetSkills(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const name = args.name as string | undefined;

  // Direct lookup by name, unchanged.
  if (name) {
    const skill = getSkill(shitennoDir, name);
    if (!skill) {
      return { content: [{ type: "text", text: `Skill "${name}" not found` }] };
    }
    return { content: [{ type: "text", text: skill.content }] };
  }

  // Scope-aware resolution when task metadata is provided.
  const taskMeta: TaskMetadata = {
    task: args.task as string | undefined,
    language: args.language as string | undefined,
    framework: args.framework as string | undefined,
    layer: args.layer as string | undefined,
  };
  if (Object.values(taskMeta).some(Boolean)) {
    const scoped = resolveScopedSkills(shitennoDir, taskMeta);
    if (scoped) return scoped;
  }

  // Fallback: flat list.
  const summaries = listSkills(shitennoDir);
  const text = summaries.map((s) => `${s.name}: ${s.description}`).join("\n");
  return { content: [{ type: "text", text: text || "No skills found." }] };
}

// ── Knowledge Debt ────────────────────────────────────────────────────────

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

// ── Challenges ────────────────────────────────────────────────────────────

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

  // Recommendations are strings — generate generic paradigm shifts
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

// ── Audit Report ──────────────────────────────────────────────────────────

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

  const allFiles = readdirSync(reportsDir)
    .filter(f => f.startsWith("health-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (allFiles.length === 0) {
    return { content: [{ type: "text", text: "No audit reports found. Run 'shugo audit' first." }] };
  }

  let latest: string;
  if (dateFilter) {
    const target = `health-${dateFilter}.json`;
    if (!allFiles.includes(target)) {
      const available = allFiles.map(f => f.replace("health-", "").replace(".json", "")).join(", ");
      return { content: [{ type: "text", text: `No audit report found for date '${dateFilter}'. Available dates: ${available || "none"}` }] };
    }
    latest = target;
  } else {
    latest = allFiles[0]!;
  }
  const reportPath = join(reportsDir, latest);
  let report: {
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
  try {
    report = JSON.parse(readFileSync(reportPath, "utf-8"));
  } catch (parseError) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError);
    return { content: [{ type: "text", text: `Failed to parse audit report '${latest}': ${msg}. The file may be corrupted. Run 'shugo audit' to regenerate.` }] };
  }

  if (format === "summary") {
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

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
}

// ── Evolution ─────────────────────────────────────────────────────────────

export function handleGetEvolution(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "json";
  const history = readMaturityHistory(shitennoDir);

  if (history.length === 0) {
    return { content: [{ type: "text", text: "No maturity history found. Run 'shugo assess' first." }] };
  }

  if (format === "summary") {
    const first = history[0]!;
    const last = history[history.length - 1]!;
    const delta = last.overallScore - first.overallScore;

    const lines: string[] = [
      `Snapshots: ${history.length}`,
      `First: ${first.timestamp} (score: ${first.overallScore})`,
      `Latest: ${last.timestamp} (score: ${last.overallScore})`,
      `Delta: ${delta >= 0 ? "+" : ""}${delta}`,
      "",
    ];

    // Dimension trends
    const dimKeys = Object.keys(first.dimensions) as Array<keyof typeof first.dimensions>;
    lines.push("Dimension Trends:");
    for (const dim of dimKeys) {
      const firstVal = first.dimensions[dim];
      const lastVal = last.dimensions[dim];
      const d = lastVal - firstVal;
      lines.push(`  ${dim}: ${firstVal} \u2192 ${lastVal} (${d >= 0 ? "+" : ""}${d})`);
    }
    lines.push("");

    // Capability evolution
    const firstCaps = new Set(first.installedCapabilities);
    const lastCaps = new Set(last.installedCapabilities);
    const added = [...lastCaps].filter(c => !firstCaps.has(c));
    const removed = [...firstCaps].filter(c => !lastCaps.has(c));
    if (added.length > 0) lines.push(`Capabilities added: ${added.join(", ")}`);
    if (removed.length > 0) lines.push(`Capabilities removed: ${removed.join(", ")}`);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(history, null, 2) }] };
}

// ── Mandatory Context ─────────────────────────────────────────────────────

export function handleGetMandatoryContext(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "markdown";
  const sections: string[] = [];

  // 1. MANDATORY_CONTEXT.md
  const mandatoryPath = join(shitennoDir, "governance", "MANDATORY_CONTEXT.md");
  if (existsSync(mandatoryPath)) {
    sections.push(readFileSync(mandatoryPath, "utf-8"));
  } else {
    sections.push("<!-- MANDATORY_CONTEXT.md not found -->");
  }

  // 2. Context buffer (session state, reminders, current task)
  const bufferContent = readBuffer(shitennoDir);
  if (bufferContent) {
    sections.push("---\n\n# Context Buffer (Session State)\n\n```yaml\n" + bufferContent.trim() + "\n```");
  }

  // 3. Mandatory rules from manifest
  const ruleManifestPath = join(shitennoDir, "governance", "rule-manifest.yaml");
  if (existsSync(ruleManifestPath)) {
    try {
      const manifest = loadManifest(ruleManifestPath);
      const { mandatory } = partitionRules(manifest, {});
      if (mandatory.length > 0) {
        const ruleLines = mandatory.map(r => `- ${r.id} (priority: ${r.priority})`);
        sections.push("---\n\n# Mandatory Rules (from manifest)\n\n" + ruleLines.join("\n"));
      }
    } catch { /* ignore parse errors */ }
  }

  // 4. Mandatory skills (task-scoped if task param provided)
  const taskArg = args.task as string | undefined;
  const skillManifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");
  if (existsSync(skillManifestPath)) {
    try {
      const manifest = loadSkillManifest(skillManifestPath);
      const taskMeta: TaskMetadata = taskArg ? { task: taskArg } : {};
      const { mandatory } = partitionSkills(manifest, taskMeta);
      if (mandatory.length > 0) {
        const skillLines = mandatory.map(s => `- ${s.id} (priority: ${s.priority})`);
        sections.push("---\n\n# Mandatory Skills (from manifest)\n\n" + skillLines.join("\n"));
      }
    } catch { /* ignore parse errors */ }
  }

  if (format === "json") {
    return { content: [{ type: "text", text: JSON.stringify({ sections: sections.length, content: sections.join("\n\n") }, null, 2) }] };
  }

  return { content: [{ type: "text", text: sections.join("\n\n") }] };
}
