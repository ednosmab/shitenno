import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { generateRiskMap, type RiskMap } from "../infrastructure/risk-map.js";
import { getEngineeringState } from "../engineering-state/index.js";
import { readCache } from "../infrastructure/briefing-cache.js";
import { recordOutcome, createFileStorage } from "../infrastructure/session-feedback.js";
import { sanitizePlanName } from "../domain/rules/path-safety.js";
import { loadManifest, partitionRules } from "../infrastructure/rule-manifest.js";
import { loadSkillManifest, partitionSkills, type TaskMetadata } from "../infrastructure/skill-manifest.js";
import { queryDaemon, isDaemonRunning } from "../infrastructure/daemon-client.js";
import { readMaturityHistory } from "../maturity-profile/telemetry.js";
import { readBuffer } from "../context-buffer-writer/buffer-io.js";
import { logger } from "../shared/logger.js";
import { withCache } from "../infrastructure/mcp-cache.js";
import type { ToolResponse } from "../domain/types/mcp-types.js";


export async function handleGetRiskMap(
  projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";
  const cacheKey = `riskmap:${projectRoot}:${format}`;

  return withCache(
    async () => {
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
    },
    { key: cacheKey, ttlMs: 120_000 },
  );
}

export async function handleGetEngineeringState(
  projectRoot: string,
  shitennoDir: string,
  _args: Record<string, unknown>
): Promise<ToolResponse> {
  const cacheKey = `engineering:${projectRoot}`;

  return withCache(
    async () => {
      try {
        const state = getEngineeringState(projectRoot, shitennoDir);
        return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Failed to get engineering state: ${error}` }], isError: true };
      }
    },
    { key: cacheKey, ttlMs: 60_000 },
  );
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
      return { content: [{ type: "text", text: `Plan not found: ${safeName}` }], isError: true };
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
    return { content: [{ type: "text", text: "Missing required arguments: outcome, notes" }], isError: true };
  }

  const cache = readCache(shitennoDir);
  const storage = createFileStorage(shitennoDir);
  recordOutcome(storage, {
    briefingHash: cache?.entry?.inputHash ?? "",
    briefingTimestamp: cache?.entry?.computedAt ?? "",
    outcome,
    notes,
  });

  return { content: [{ type: "text", text: "Feedback submitted successfully." }] };
}

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

    const dimKeys = Object.keys(first.dimensions) as Array<keyof typeof first.dimensions>;
    lines.push("Dimension Trends:");
    for (const dim of dimKeys) {
      const firstVal = first.dimensions[dim];
      const lastVal = last.dimensions[dim];
      const d = lastVal - firstVal;
      lines.push(`  ${dim}: ${firstVal} \u2192 ${lastVal} (${d >= 0 ? "+" : ""}${d})`);
    }
    lines.push("");

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

export function handleGetMandatoryContext(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const format = (args.format as string) ?? "markdown";
  const sections: string[] = [];

  const mandatoryPath = join(shitennoDir, "governance", "MANDATORY_CONTEXT.md");
  if (existsSync(mandatoryPath)) {
    sections.push(readFileSync(mandatoryPath, "utf-8"));
  } else {
    sections.push("<!-- MANDATORY_CONTEXT.md not found -->");
  }

  const bufferContent = readBuffer(shitennoDir);
  if (bufferContent) {
    sections.push("---\n\n# Context Buffer (Session State)\n\n```yaml\n" + bufferContent.trim() + "\n```");
  }

  const ruleManifestPath = join(shitennoDir, "governance", "rule-manifest.yaml");
  if (existsSync(ruleManifestPath)) {
    try {
      const manifest = loadManifest(ruleManifestPath);
      const { mandatory } = partitionRules(manifest, {});
      if (mandatory.length > 0) {
        const ruleLines = mandatory.map(r => `- ${r.id} (priority: ${r.priority})`);
        sections.push("---\n\n# Mandatory Rules (from manifest)\n\n" + ruleLines.join("\n"));
      }
    } catch (err) {
      logger.debug("mcp-handlers/context", `Failed to parse rule manifest: ${err}`);
    }
  }

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
    } catch (err) {
      logger.debug("mcp-handlers/context", `Failed to parse skill manifest: ${err}`);
    }
  }

  if (format === "json") {
    return { content: [{ type: "text", text: JSON.stringify({ sections: sections.length, content: sections.join("\n\n") }, null, 2) }] };
  }

  return { content: [{ type: "text", text: sections.join("\n\n") }] };
}
