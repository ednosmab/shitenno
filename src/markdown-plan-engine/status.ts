/**
 * markdown-plan-engine/status.ts — Status inference functions
 *
 * Extracted from markdown-plan-engine.ts to keep modules focused.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type MarkdownPlanStatus = "andamento" | "parado" | "check" | "checked" | "done" | "blocked" | "refused";

// ── Constants ───────────────────────────────────────────────────────────────

const COMPLETION_STATUSES = new Set(["done", "checked", "concluído", "concluido"]);

// ── Status Helpers ─────────────────────────────────────────────────────────

export function isCompletionStatus(status: string): boolean {
  return COMPLETION_STATUSES.has(status.toLowerCase());
}

/**
 * Normalize a raw status string into the canonical MarkdownPlanStatus.
 */
export function normalizeStatusValue(raw: string): MarkdownPlanStatus {
  const lower = raw.toLowerCase();
  if (lower.includes("done") || lower.includes("conclu")) return "done";
  if (lower.includes("parado") || lower.includes("paused") || lower.includes("stopped")) return "parado";
  if (lower.includes("check") || lower.includes("verificando") || lower.includes("checking")) return "check";
  if (lower.includes("blocked") || lower.includes("bloqueado")) return "blocked";
  if (lower.includes("refused") || lower.includes("rejeitado") || lower.includes("rejected")) return "refused";
  return "andamento";
}

/**
 * Map a canonical MarkdownPlanStatus to the text written into the
 * **Status:** frontmatter field.
 */
export function statusDisplayText(status: MarkdownPlanStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "parado":
      return "Paused";
    case "check":
      return "Checking";
    case "blocked":
      return "Blocked";
    case "refused":
      return "Refused";
    case "andamento":
    default:
      return "In Progress";
  }
}

/**
 * Extract status from frontmatter metadata and content.
 */
export function extractStatus(metadata: Record<string, string>, content: string): MarkdownPlanStatus {
  const statusField = metadata["status"];
  if (statusField) {
    return normalizeStatusValue(statusField);
  }

  const looseMatch = content.match(/^\s*\*{0,2}status\*{0,2}\s*:\s*\*{0,2}\s*(.+?)\s*\*{0,2}\s*$/im);
  if (looseMatch && looseMatch[1]) {
    return normalizeStatusValue(looseMatch[1]);
  }

  const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
  const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;

  if (openBoxes === 0 && closedBoxes === 0) {
    return "andamento";
  }

  if (closedBoxes > 0 && openBoxes === 0) return "done";

  return "andamento";
}
