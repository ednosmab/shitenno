import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../types/constants.js";
import type { FileSystem } from "../ports/file-system.js";

export interface ProjectProfile {
  projectName: string;
  areas: string[];
  sensitiveKeywords: string[];
  churnWindowDays: number;
  weights: Record<string, number>;
  violationKeywords: string[];
  feedbackPath?: string;
}

export function loadProjectProfile(projectRoot: string, fs: FileSystem): ProjectProfile | null {
  const profileDir = join(projectRoot, SHITENNO_DIR_NAME, "profile");
  if (!fs.exists(profileDir)) return null;

  const files = fs.listDir(profileDir).filter(
    (f) => f.endsWith(".config.ts") && !f.startsWith("_")
  );
  if (files.length === 0) return null;

  const firstFile = files[0];
  if (!firstFile) return null;
  const content = fs.read(join(profileDir, firstFile));

  const projectNameMatch = content.match(/projectName:\s*["']([^"']+)["']/);
  const areasMatch = content.match(/areas:\s*\[([\s\S]*?)\]/);
  const sensitiveMatch = content.match(
    /sensitiveKeywords:\s*\[([\s\S]*?)\]/
  );
  const churnMatch = content.match(/churnWindowDays:\s*(\d+)/);
  const violationMatch = content.match(
    /violationKeywords:\s*\[([\s\S]*?)\]/
  );

  if (!projectNameMatch || !areasMatch) return null;

  const parseStringArray = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .filter(Boolean);

  return {
    projectName: projectNameMatch[1] ?? "",
    areas: parseStringArray(areasMatch[1] ?? ""),
    sensitiveKeywords: sensitiveMatch
      ? parseStringArray(sensitiveMatch[1] ?? "")
      : ["auth", "payment", "session", "security"],
    churnWindowDays: churnMatch ? parseInt(churnMatch[1] ?? "90", 10) : 90,
    weights: { churn: 1.0, violationRate: 1.0, sensitiveSurface: 1.0 },
    violationKeywords: violationMatch
      ? parseStringArray(violationMatch[1] ?? "")
      : ["erro", "bug", "corrigi", "falhou", "rollback", "violação"],
  };
}
