/**
 * skill-resolution.ts — Skill resolution evidence recording.
 */

import { readBufferObject, writeBufferObject } from "./buffer-io.js";

export interface SkillResolutionInput {
  skillId: string;
  reason: "mandatory" | "contextual";
  taskMeta: string;
  resolvedAt: string;
}

export function recordSkillResolution(
  shitennoDir: string,
  resolution: SkillResolutionInput
): { success: boolean; message: string; skipped?: boolean } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  if (!Array.isArray(obj.skills_resolved)) {
    obj.skills_resolved = [];
  }

  const exists = (obj.skills_resolved as Array<Record<string, unknown>>).some(
    (r) => r.skillId === resolution.skillId && r.taskMeta === resolution.taskMeta
  );
  if (exists) {
    return { success: true, message: "Skill resolution already recorded, skipped", skipped: true };
  }

  (obj.skills_resolved as unknown[]).push({
    skillId: resolution.skillId,
    taskMeta: resolution.taskMeta,
    reason: resolution.reason,
    resolvedAt: resolution.resolvedAt,
  });

  writeBufferObject(shitennoDir, obj);
  return { success: true, message: `Skill resolution recorded: ${resolution.skillId}` };
}
