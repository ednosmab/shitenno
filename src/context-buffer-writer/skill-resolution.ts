/**
 * skill-resolution.ts — Skill resolution evidence recording.
 */

import { readBuffer, writeBuffer } from "./buffer-io.js";

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
  const content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const dedupeKey = `skillId: "${resolution.skillId}"\n    taskMeta: "${resolution.taskMeta}"`;
  if (content.includes(dedupeKey)) {
    return { success: true, message: "Skill resolution already recorded, skipped", skipped: true };
  }

  const entry = `  - skillId: "${resolution.skillId}"
    taskMeta: "${resolution.taskMeta}"
    reason: "${resolution.reason}"
    resolvedAt: "${resolution.resolvedAt}"
`;

  const sectionRegex = /^skills_resolved:\s*\n/m;
  const match = sectionRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(shitennoDir, updated);
    return { success: true, message: `Skill resolution recorded: ${resolution.skillId}` };
  }

  const updated = "skills_resolved:\n" + entry + "\n" + content;
  writeBuffer(shitennoDir, updated);
  return { success: true, message: `Skill resolution recorded (new section): ${resolution.skillId}` };
}
