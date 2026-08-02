import { listAdrs, getAdr, listSkills, getSkill } from "../knowledge-loader.js";
import { loadSkillManifest, partitionSkills, type TaskMetadata } from "../skill-manifest.js";
import { recordSkillResolution } from "../context-buffer-writer.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolResponse } from "../mcp-types.js";

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

export function resolveScopedSkills(
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

  if (name) {
    const skill = getSkill(shitennoDir, name);
    if (!skill) {
      return { content: [{ type: "text", text: `Skill "${name}" not found` }] };
    }
    return { content: [{ type: "text", text: skill.content }] };
  }

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

  const summaries = listSkills(shitennoDir);
  const text = summaries.map((s) => `${s.name}: ${s.description}`).join("\n");
  return { content: [{ type: "text", text: text || "No skills found." }] };
}
