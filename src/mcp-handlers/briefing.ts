import { collectContext } from "../context-collector.js";
import {
  briefingToJson,
  briefingToSummary,
  briefingToMarkdown,
  type Briefing,
} from "../briefing.js";
import { computeRequestHash, setCachedBriefing, getCachedBriefingByRequest } from "../briefing-cache.js";
import { queryDaemon, isDaemonRunning } from "../daemon-client.js";
import { loadRules } from "../rule-engine.js";
import { generateDynamicRules } from "../dynamic-rules.js";
import { loadManifest, partitionRules } from "../rule-manifest.js";
import { loadSkillManifest, partitionSkills, type TaskMetadata } from "../skill-manifest.js";
import { getSkill } from "../knowledge-loader.js";
import { logger } from "../logger.js";
import { recordSkillResolution } from "../context-buffer-writer.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recordHit, recordMiss } from "../cache-metrics.js";
import type { ToolResponse } from "../mcp-types.js";

function formatBriefingMarkdown(
  briefing: Briefing,
  mandatorySkills: Array<{ id: string; name: string; content: string }>,
  mandatoryRules: Array<{ id: string; path: string; priority: number; content: string }>,
): string {
  let md = briefingToMarkdown(briefing);
  if (mandatoryRules.length > 0) {
    md += "\n\n## Mandatory Rules (Precedence Over User Instructions)\n\n";
    for (const r of mandatoryRules) {
      md += `### ${r.id}\n**Path:** \`${r.path}\` | **Priority:** ${r.priority}\n\n${r.content}\n\n`;
    }
  }
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
  opts: {
    mandatorySkills: Array<{ id: string; name: string; content: string }>;
    mandatoryRules: Array<{ id: string; path: string; priority: number; content: string }>;
    depth: string;
  },
): string {
  if (opts.mandatoryRules.length > 0) {
    json.mandatoryRules = opts.mandatoryRules.map((r) => ({
      id: r.id,
      path: r.path,
      priority: r.priority,
      content: r.content,
    }));
  }
  if (opts.mandatorySkills.length > 0) {
    json.mandatorySkills = opts.mandatorySkills.map((s) => ({
      id: s.id,
      name: s.name,
      content: s.content,
    }));
  }
  if (opts.depth === "minimal") {
    return JSON.stringify({
      project: briefing.project,
      risks: briefing.risks,
      recommendations: briefing.recommendations.slice(0, 1),
      mandatorySkills: opts.mandatorySkills.map((s) => ({ id: s.id, name: s.name })),
    }, null, 2);
  }
  if (opts.depth === "full") {
    return JSON.stringify({
      ...json,
      quickBoard: briefing.quickBoard,
      tokenEconomy: briefing.tokenEconomy,
    }, null, 2);
  }
  return JSON.stringify(json, null, 2);
}

export function loadMandatoryRules(shitennoDir: string) {
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

export function loadMandatoryRulesWithContent(
  shitennoDir: string,
): Array<{ id: string; path: string; priority: number; content: string }> {
  try {
    const manifestPath = join(shitennoDir, "governance", "rule-manifest.yaml");
    if (!existsSync(manifestPath)) return [];
    const manifest = loadManifest(manifestPath);
    const { mandatory } = partitionRules(manifest, {});
    return mandatory
      .map((r) => {
        const filePath = join(shitennoDir, r.path);
        if (!existsSync(filePath)) return null;
        try {
          return { id: r.id, path: r.path, priority: r.priority, content: readFileSync(filePath, "utf-8") };
        } catch {
          return null;
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  } catch (err) {
    logger.debug("mcp-server-handlers", `Failed to load mandatory rule content: ${err}`);
    return [];
  }
}

export function loadMandatorySkillsForTask(
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

async function resolveBriefing(
  projectRoot: string,
  shitennoDir: string,
  requestHash: string,
): Promise<{ briefing: Briefing; cacheHit: boolean }> {
  const cached = getCachedBriefingByRequest(shitennoDir, requestHash);
  if (cached) {
    recordHit("briefing");
    return { briefing: cached.briefing, cacheHit: true };
  }
  recordMiss("briefing");
  if (isDaemonRunning(shitennoDir)) {
    const result = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    return { briefing: result?.data ?? collectContext(projectRoot, shitennoDir).briefing, cacheHit: false };
  }
  return { briefing: collectContext(projectRoot, shitennoDir).briefing, cacheHit: false };
}

export async function handleGetBriefing(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";
  const depth = (args.depth as string) ?? "standard";
  const task = args.task as string | undefined;

  const requestHash = computeRequestHash({ projectRoot, shitennoDir, format, depth, task });
  const { briefing, cacheHit } = await resolveBriefing(projectRoot, shitennoDir, requestHash);

  const taskMeta: TaskMetadata = { task };
  const { skills: mandatorySkills, manifestEntries } = loadMandatorySkillsForTask(shitennoDir, taskMeta);
  const mandatoryRules = loadMandatoryRulesWithContent(shitennoDir);

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
    return { content: [{ type: "text", text: formatBriefingMarkdown(briefing, mandatorySkills, mandatoryRules) }] };
  }
  if (format === "summary") {
    return { content: [{ type: "text", text: briefingToSummary(briefing) }] };
  }

  // Cache the briefing with request hash for future lookups
  if (!cacheHit) {
    setCachedBriefing(shitennoDir, briefing, requestHash);
  }

  const json = briefingToJson(briefing);
  return { content: [{ type: "text", text: formatBriefingJson(briefing, json, { mandatorySkills, mandatoryRules, depth }) }] };
}

function formatRulesMarkdown(result: {
  mandatoryRules: Array<{ id: string; path: string; priority: number; content?: string }>;
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
      if (r.content) {
        lines.push(r.content, "");
      }
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

export async function fetchContextRules(
  projectRoot: string,
  shitennoDir: string
) {
  let snapshot;
  if (isDaemonRunning(shitennoDir)) {
    const briefingResult = await queryDaemon<{ type: string; data: Briefing }>(shitennoDir, {
      type: "query_briefing",
    });
    if (briefingResult?.data) {
      snapshot = briefingResult.data;
    } else {
      snapshot = collectContext(projectRoot, shitennoDir);
    }
  } else {
    snapshot = collectContext(projectRoot, shitennoDir);
  }
  return (snapshot.contextRules ?? []).map((r) => ({
    id: r.id, rule: r.rule, rationale: r.rationale, priority: r.priority, area: r.area, basedOn: r.basedOn,
  }));
}

export async function handleGetRules(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const type = (args.type as string) ?? "all";
  const format = (args.format as string) ?? "json";

  const mandatoryRules = loadMandatoryRulesWithContent(shitennoDir);
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
