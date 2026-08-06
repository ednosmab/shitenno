/**
 * MCP handler for the shitenno_getRules tool.
 *
 * Loads mandatory rules (from rule-manifest.yaml), context-aware rules,
 * dynamic rules (from git history), and engine rules (declarative).
 */

import { loadRules } from "../application/rule-engine.js";
import { generateDynamicRules } from "../infrastructure/dynamic-rules.js";
import { loadManifest, partitionRules } from "../infrastructure/rule-manifest.js";
import { queryDaemon, isDaemonRunning } from "../infrastructure/daemon-client.js";
import { collectContext } from "../application/context-collector.js";
import { logger } from "../shared/logger.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Briefing } from "../application/briefing.js";
import type { ToolResponse } from "../domain/types/mcp-types.js";

// ── Mandatory Rules ─────────────────────────────────────────────────────────

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

// ── Context Rules ───────────────────────────────────────────────────────────

export async function fetchContextRules(
  projectRoot: string,
  shitennoDir: string,
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

// ── Formatting ──────────────────────────────────────────────────────────────

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

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handleGetRules(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>,
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
