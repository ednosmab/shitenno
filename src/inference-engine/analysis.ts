/**
 * inference-engine/analysis.ts — Checkbox analysis and age calculation
 */

import { statSync } from "node:fs";

export type InferredStatus =
  | "done"
  | "in_progress"
  | "paused"
  | "obsolete"
  | "inconsistent";

export interface CheckboxSummary {
  total: number;
  closed: number;
  open: number;
  percentage: number;
}

const OBSOLETE_THRESHOLD_DAYS = 30;

export function countCheckboxes(content: string): CheckboxSummary {
  const closed = (content.match(/^- \[x\]/gm) || []).length;
  const open = (content.match(/^- \[ \]/gm) || []).length;
  const total = closed + open;
  return {
    total,
    closed,
    open,
    percentage: total > 0 ? Math.round((closed / total) * 100) : 0,
  };
}

export function calculateAgeInDays(filePath: string): number {
  try {
    const stat = statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

export function isAbandonedStatus(estado: string | null): boolean {
  return !!(estado?.includes("AGUARDA APROVACAO") || estado?.includes("abandoned") || estado?.includes("cancelled"));
}

export function inferStatus(
  rawStatus: string,
  checkboxes: CheckboxSummary,
  ageInDays: number,
  estado: string | null
): InferredStatus {
  if (rawStatus === "parado") return "paused";

  const isAbandoned = isAbandonedStatus(estado);
  if (isAbandoned && ageInDays > OBSOLETE_THRESHOLD_DAYS) return "obsolete";

  if (rawStatus === "done") {
    if (checkboxes.total > 0 && checkboxes.open > 0) return "inconsistent";
    return "done";
  }

  if (checkboxes.total === 0) return isAbandoned ? "obsolete" : "in_progress";
  if (checkboxes.open === 0) return "done";
  return "in_progress";
}
