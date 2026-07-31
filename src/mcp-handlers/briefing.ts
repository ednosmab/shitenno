/**
 * MCP handler for the shitenno_getBriefing tool.
 *
 * Generates project briefings with optional mandatory rules and skills.
 */

import { collectContext } from "../context-collector.js";
import {
  briefingToJson,
  briefingToSummary,
  briefingToMarkdown,
  type Briefing,
} from "../briefing.js";
import { computeRequestHash, setCachedBriefing, getCachedBriefingByRequest } from "../briefing-cache.js";
import { queryDaemon, isDaemonRunning } from "../daemon-client.js";
import { loadSkillManifest, partitionSkills, type TaskMetadata } from "../skill-manifest.js";
import { getSkill } from "../knowledge-loader.js";
import { logger } from "../logger.js";
import { recordSkillResolution } from "../context-buffer-writer.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { recordHit, recordMiss } from "../cache-metrics.js";
import type { ToolResponse } from "../mcp-types.js";
import { loadMandatoryRulesWithContent } from "./rules.js";

// ── Formatting ──────────────────────────────────────────────────────────────

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

// ── Mandatory Skills ────────────────────────────────────────────────────────

export function loadMandatorySkillsForTask(
  shitennoDir: string,
  taskMeta: TaskMetadata,
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

// ── Briefing Resolution ─────────────────────────────────────────────────────

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

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handleGetBriefing(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>,
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
