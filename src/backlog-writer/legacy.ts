/**
 * legacy.ts — Legacy compatibility functions for backlog writing.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "../shared/logger.js";
import type { BacklogItem, BacklogPriority, BacklogSeverity } from "../domain/types/backlog-types.js";

export function mapSeverityToPriority(
  auditSeverity: number,
  maturityScore?: number
): BacklogPriority {
  if (auditSeverity === 3) return "P0";
  if (auditSeverity === 2) return "P1";
  if (maturityScore !== undefined && maturityScore < 25) return "P0";
  if (maturityScore !== undefined && maturityScore < 50) return "P1";
  if (maturityScore !== undefined && maturityScore < 75) return "P2";
  return "P2";
}

export function severityLabel(severity: number): BacklogSeverity {
  if (severity === 3) return "Critico";
  if (severity === 2) return "Alto";
  if (severity === 1) return "Medio";
  return "Baixo";
}

export function isDuplicate(backlogContent: string, item: BacklogItem): boolean {
  const normalizedTitle = item.title.toLowerCase().trim();
  const lines = backlogContent.split("\n");
  for (const line of lines) {
    if (line.toLowerCase().includes(normalizedTitle)) {
      return true;
    }
  }
  return false;
}

export function formatBacklogItem(item: BacklogItem): string {
  const modules = item.modules?.join(", ") || "";
  const correction = item.correction || "";
  return [
    `### ${item.id} ${item.title}`,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| **Status** | Backlog |`,
    `| **Severidade** | ${item.severity} |`,
    `| **Prioridade** | ${item.priority} |`,
    `| **Owner** | unassigned |`,
    `| **Data** | ${item.date} |`,
    `| **Fonte** | ${item.source} |`,
    `| **Modulos** | ${modules} |`,
    `| **Descricao** | ${item.description} |`,
    `| **Correcao** | ${correction} |`,
  ].join("\n");
}

export function formatBacklogSection(items: BacklogItem[], date: string): string {
  if (items.length === 0) return "";

  const p0 = items.filter((i) => i.priority === "P0");
  const p1 = items.filter((i) => i.priority === "P1");
  const p2 = items.filter((i) => i.priority === "P2");
  const p3 = items.filter((i) => i.priority === "P3");

  let section = `## Auto-análise ${date}\n\n`;
  section += `> **Gerado por:** shugo audit --auto-backlog\n`;
  section += `> **Data:** ${date}\n`;
  section += `> **Itens:** ${items.length} (${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3)\n`;
  section += `\n`;

  for (const item of items) {
    section += formatBacklogItem(item) + "\n\n";
  }

  return section;
}

export interface BacklogWriteResult {
  itemsAdded: number;
  itemsSkipped: number;
  sectionInserted: boolean;
  fileWasRecreated: boolean;
  message: string;
}

function findInsertionPoint(content: string): number {
  const anchor = "## Metricas de Qualidade";
  const idx = content.indexOf(anchor);
  if (idx >= 0) {
    const prevNewlines = content.lastIndexOf("\n", idx - 1);
    return prevNewlines >= 0 ? prevNewlines + 1 : 0;
  }
  return -1;
}

export function appendBacklogSection(
  backlogPath: string,
  items: BacklogItem[],
  date: string
): BacklogWriteResult {
  const dir = dirname(backlogPath);

  let existingContent = "";
  let fileExistedBefore = false;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    fileExistedBefore = existsSync(backlogPath);
    existingContent = fileExistedBefore ? readFileSync(backlogPath, "utf-8") : "";
  } catch (err) {
    logger.warn("backlog-writer", `Could not access ${backlogPath}: ${(err as Error).message}`);
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, fileWasRecreated: false, message: "Backlog path not accessible" };
  }

  const newItems = items.filter((item) => !isDuplicate(existingContent, item));
  if (newItems.length === 0) {
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, fileWasRecreated: false, message: "All items are duplicates" };
  }

  const section = formatBacklogSection(newItems, date);
  let content = existingContent;
  if (content.length === 0) {
    content = `# BACKLOG\n\n${section}`;
  } else {
    const insertionIdx = findInsertionPoint(content);
    content = insertionIdx >= 0
      ? content.slice(0, insertionIdx) + section + "\n\n" + content.slice(insertionIdx)
      : content + `\n${section}`;
  }

  try {
    writeFileSync(backlogPath, content, "utf-8");
  } catch (err) {
    logger.warn("backlog-writer", `Failed to write ${backlogPath}: ${(err as Error).message}`);
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, fileWasRecreated: false, message: "Failed to write backlog file" };
  }

  logger.info("backlog-writer", `Appended ${newItems.length} items to ${backlogPath}`);
  return {
    itemsAdded: newItems.length,
    itemsSkipped: items.length - newItems.length,
    sectionInserted: true,
    fileWasRecreated: !fileExistedBefore,
    message: fileExistedBefore
      ? `Added ${newItems.length} items (${items.length - newItems.length} duplicates skipped)`
      : `WARNING: backlog file did not exist and was recreated from scratch. Added ${newItems.length} item(s). Any prior history is lost if this wasn't expected.`,
  };
}

export function issueToBacklogItem(
  issue: { severity: number; description: string; location: string; recommendation: string },
  date: string,
  idPrefix: string,
  index: number,
): BacklogItem {
  return {
    id: `${idPrefix}${String(index).padStart(2, "0")}`,
    title: issue.description.slice(0, 60),
    state: "planeado",
    priority: mapSeverityToPriority(issue.severity),
    severity: severityLabel(issue.severity),
    owner: "unassigned",
    description: issue.description,
    source: "shugo audit",
    date,
    line: 0,
    filePath: "",
    format: "modular",
    modules: [issue.location],
    correction: issue.recommendation,
  };
}

export function dimensionToBacklogItem(
  dimension: string,
  score: number,
  date: string,
  id: string,
): BacklogItem {
  const severity: BacklogSeverity = score < 10 ? "Critico" : score < 25 ? "Alto" : "Medio";
  return {
    id,
    title: `${dimension} ${score}% (abaixo de 25%)`,
    state: "planeado",
    priority: mapSeverityToPriority(1, score),
    severity,
    owner: "unassigned",
    description: `Maturity score for ${dimension} is ${score}%, below the 25% threshold.`,
    source: "shugo assess",
    date,
    line: 0,
    filePath: "",
    format: "modular",
    modules: [dimension],
    correction: `Improve ${dimension} maturity score to at least 25%.`,
  };
}
