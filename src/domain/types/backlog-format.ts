/**
 * backlog-format.ts — Summary and Formatting
 *
 * getBacklogSummary, formatItemCompact, formatItemsByPriority, formatSummaryLine.
 */

import {
  type BacklogItem,
  type BacklogState,
  type BacklogSummary,
} from "./backlog-types.js";

// ── Summary ────────────────────────────────────────────────────────────────

export function getBacklogSummary(items: BacklogItem[]): BacklogSummary {
  const byState: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const item of items) {
    byState[item.state] = (byState[item.state] || 0) + 1;
    const p = item.priority || "P?";
    byPriority[p] = (byPriority[p] || 0) + 1;
  }

  return {
    total: items.length,
    byState: byState as Record<BacklogState, number>,
    byPriority,
    p0Count: byPriority["P0"] || 0,
    p1Count: byPriority["P1"] || 0,
    blockers: items.filter((i) => i.state === "pausado"),
    inProgress: items.filter((i) => i.state === "em implementação" || i.state === "em validação"),
    recentlyCompleted: items.filter((i) => i.state === "concluído").slice(0, 5),
  };
}

// ── Formatting Helpers ─────────────────────────────────────────────────────

const STATE_ICONS: Record<BacklogState, string> = {
  "planeado": "📋",
  "em investigação": "🔍",
  "em implementação": "🔨",
  "em validação": "✅",
  "pausado": "⏸️",
  "adiado": "⏳",
  "concluído": "✔️",
  "encerrado": "❌",
};

const PRIORITY_COLORS: Record<string, string> = {
  "P0": "\x1b[31m",
  "P1": "\x1b[33m",
  "P2": "\x1b[36m",
  "P3": "\x1b[37m",
};

const RESET = "\x1b[0m";

export function formatItemCompact(item: BacklogItem): string {
  const icon = STATE_ICONS[item.state] || "•";
  const color = PRIORITY_COLORS[item.priority] || "";
  const priority = item.priority || "P?";
  return `${icon} ${color}${priority}${RESET} ${item.id} — ${item.title}`;
}

export function formatItemsByPriority(items: BacklogItem[]): string {
  if (items.length === 0) return "  Nenhum item encontrado.";

  const groups: Record<string, BacklogItem[]> = {};
  for (const item of items) {
    const p = item.priority || "P?";
    if (!groups[p]) groups[p] = [];
    groups[p]!.push(item);
  }

  const lines: string[] = [];
  for (const p of ["P0", "P1", "P2", "P3"]) {
    const group = groups[p];
    if (group && group.length > 0) {
      lines.push(`\n  ${p} (${group.length} itens):`);
      for (const item of group) {
        lines.push(`    ${formatItemCompact(item)}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatSummaryLine(summary: BacklogSummary): string {
  const parts: string[] = [];
  if (summary.p0Count > 0) parts.push(`🔴 P0: ${summary.p0Count}`);
  if (summary.p1Count > 0) parts.push(`🟡 P1: ${summary.p1Count}`);
  parts.push(`Total: ${summary.total}`);
  if (summary.blockers.length > 0) parts.push(`Blockers: ${summary.blockers.length}`);
  if (summary.inProgress.length > 0) parts.push(`Em progresso: ${summary.inProgress.length}`);
  return parts.join(" │ ");
}
