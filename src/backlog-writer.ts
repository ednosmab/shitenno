/**
 * backlog-writer.ts — Write Operations
 *
 * Core operations: addItem, deleteItem, transitionItem, moveItemToDone.
 * Legacy compat: mapSeverityToPriority, severityLabel, isDuplicate,
 *   formatBacklogItem, formatBacklogSection, appendBacklogSection,
 *   issueToBacklogItem, dimensionToBacklogItem.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "./logger.js";
import {
  type BacklogItem,
  type BacklogState,
  type BacklogPriority,
  type BacklogSeverity,
  type TransitionResult,
  type AddItemInput,
  getAllowedTransitions,
  isValidTransition,
} from "./backlog-types.js";
import { parseBacklogItems, findItem } from "./backlog-parser.js";

// ── Re-export types for backwards compatibility ────────────────────────────

export type { BacklogItem, BacklogPriority, BacklogSeverity } from "./backlog-types.js";

// ── Add Item ───────────────────────────────────────────────────────────────

export function addItem(filePath: string, input: AddItemInput): { success: boolean; message: string } {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const state = input.state || "planeado";
  const priority = input.priority || "P2";
  const severity = input.severity || "Medio";
  const date = new Date().toISOString().slice(0, 10);

  const block = [
    "",
    `### ${input.id} ${input.title}`,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| **Status** | ${state} |`,
    `| **Severidade** | ${severity} |`,
    `| **Prioridade** | ${priority} |`,
    `| **Owner** | ${input.owner || "unassigned"} |`,
    `| **Data** | ${date} |`,
    `| **Fonte** | ${input.source || "manual"} |`,
    `| **Descricao** | ${input.description || ""} |`,
    "",
  ].join("\n");

  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
    if (content.includes(`### ${input.id}`)) {
      return { success: false, message: `Item ${input.id} already exists in backlog` };
    }
  } else {
    content = "# BACKLOG — Active Items\n\n";
  }

  content += block;
  writeFileSync(filePath, content, "utf-8");
  logger.info("backlog-core", `Added item ${input.id} to ${filePath}`);
  return { success: true, message: `Added ${input.id}: ${input.title} (${state})` };
}

// ── Delete Item ────────────────────────────────────────────────────────────

export function deleteItem(filePath: string, itemId: string): { success: boolean; message: string } {
  if (!existsSync(filePath)) {
    return { success: false, message: `Backlog file not found: ${filePath}` };
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const range = findItemRange(lines, itemId);

  if (!range) {
    return { success: false, message: `Item ${itemId} not found in backlog` };
  }

  const remaining = [...lines.slice(0, range.start), ...lines.slice(range.end)].join("\n");
  writeFileSync(filePath, remaining, "utf-8");
  logger.info("backlog-core", `Deleted item ${itemId} from ${filePath}`);
  return { success: true, message: `Deleted ${itemId} from backlog` };
}

// ── Item Range Helper ──────────────────────────────────────────────────────

export function findItemRange(lines: string[], itemId: string): { start: number; end: number } | null {
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("### ") && line.slice(4).trim().startsWith(itemId)) {
      startIdx = i;
      continue;
    }
    if (startIdx !== -1 && line.startsWith("### ") && i > startIdx) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;
  return { start: startIdx, end: endIdx === -1 ? lines.length : endIdx };
}

// ── Transition Item ────────────────────────────────────────────────────────

function validateAdiadoRevisit(
  item: BacklogItem,
  toState: BacklogState,
  filePath: string,
): TransitionResult | null {
  if (item.state !== "adiado" || toState !== "planeado") return null;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const line = lines[item.line] || "";

  if (!line.includes("[REVISIT:")) {
    return {
      success: false,
      message: `Item ${item.id} is "adiado" — requires [REVISIT: YYYY-MM-DD] date to transition back to "planeado"`,
    };
  }
  return null;
}

function updateModularStatus(filePath: string, lineIdx: number, toState: BacklogState, date: string): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const statusLabel = toState === "concluído" ? `Done — ${date}` : toState;
  lines[lineIdx] = `| **Status** | ${statusLabel} |`;
  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

function updateLegacyStatus(filePath: string, line: string | undefined, lineIdx: number, toState: BacklogState): void {
  if (line && line.startsWith("|")) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      cells[3] = toState;
      lines[lineIdx] = `| ${cells.join(" | ")} |`;
      writeFileSync(filePath, lines.join("\n"), "utf-8");
    }
  }
}

export function transitionItem(
  filePath: string,
  itemId: string,
  toState: BacklogState,
  options?: { date?: string }
): TransitionResult {
  if (!existsSync(filePath)) {
    return { success: false, message: `Backlog file not found: ${filePath}` };
  }

  const items = parseBacklogItems(filePath);
  const item = findItem(items, itemId);

  if (!item) {
    return { success: false, message: `Item ${itemId} not found in backlog` };
  }

  const revisitCheck = validateAdiadoRevisit(item, toState, filePath);
  if (revisitCheck) return revisitCheck;

  if (!isValidTransition(item.state, toState)) {
    const allowed = getAllowedTransitions(item.state);
    return {
      success: false,
      message: `Invalid transition: ${item.state} → ${toState}. Allowed: ${allowed.join(", ") || "(terminal state)"}`,
    };
  }

  const date = options?.date ?? new Date().toISOString().slice(0, 10);

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const line = lines[item.line];

    if (item.format === "modular") {
      updateModularStatus(filePath, item.line, toState, date);
    } else {
      updateLegacyStatus(filePath, line, item.line, toState);
    }

    logger.info("backlog-core", `Transitioned ${itemId}: ${item.state} → ${toState}`);
    return {
      success: true,
      message: `Item ${itemId} transitioned: ${item.state} → ${toState}`,
      previousState: item.state,
      newState: toState,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update backlog: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ── Move Item to Done ──────────────────────────────────────────────────────

function extractDoneRow(block: string, itemId: string): string {
  const titleMatch = block.match(/^### (.+)/m);
  const title = titleMatch ? titleMatch[1]!.trim() : itemId;
  const severityMatch = block.match(/\*\*Severidade\*\*\s*\|\s*([^|]+)/);
  const severity = severityMatch ? severityMatch[1]!.trim() : "—";
  const descMatch = block.match(/\*\*Descricao\*\*\s*\|\s*([^|]+)/);
  const description = descMatch ? descMatch[1]!.trim() : "Concluído";
  return `| ${title} | ${severity} | ${description} |`;
}

function appendToDoneFile(donePath: string, doneRow: string): void {
  const doneDir = dirname(donePath);
  if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });

  let doneContent = existsSync(donePath)
    ? readFileSync(donePath, "utf-8")
    : "## Done\n\n| Item | Severidade | Resolucao |\n|---|---|---|\n";

  const sep = doneContent.endsWith("\n") ? "" : "\n";
  doneContent += sep + doneRow + "\n";
  writeFileSync(donePath, doneContent, "utf-8");
}

export function moveItemToDone(
  activePath: string,
  donePath: string,
  itemId: string
): { success: boolean; message: string } {
  if (!existsSync(activePath)) {
    return { success: false, message: `Active backlog not found: ${activePath}` };
  }

  const content = readFileSync(activePath, "utf-8");
  const lines = content.split("\n");
  const range = findItemRange(lines, itemId);

  if (!range) {
    return { success: false, message: `Item ${itemId} not found in active backlog` };
  }

  const block = lines.slice(range.start, range.end).join("\n").trim();
  const doneRow = extractDoneRow(block, itemId);

  const remaining = [...lines.slice(0, range.start), ...lines.slice(range.end)].join("\n");
  writeFileSync(activePath, remaining + "\n", "utf-8");

  appendToDoneFile(donePath, doneRow);
  logger.info("backlog-core", `Moved ${itemId} from active to done`);
  return { success: true, message: `Moved ${itemId} to done` };
}

// ── Legacy Compatibility Functions ─────────────────────────────────────────

/** Maps audit severity and maturity score to a BacklogPriority. */
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

/** Converts numeric severity to a BacklogSeverity label. */
export function severityLabel(severity: number): BacklogSeverity {
  if (severity === 3) return "Critico";
  if (severity === 2) return "Alto";
  if (severity === 1) return "Medio";
  return "Baixo";
}

/** Checks if a BacklogItem title already exists in the backlog content. */
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

/** Formats a single BacklogItem as a modular markdown block. */
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

/** Formats a list of items into a dated auto-analysis section. */
export function formatBacklogSection(items: BacklogItem[], date: string): string {
  if (items.length === 0) return "";

  const p0 = items.filter((i) => i.priority === "P0");
  const p1 = items.filter((i) => i.priority === "P1");
  const p2 = items.filter((i) => i.priority === "P2");
  const p3 = items.filter((i) => i.priority === "P3");

  let section = `## Auto-análise ${date}

`;
  section += `> **Gerado por:** shugo audit --auto-backlog
`;
  section += `> **Data:** ${date}
`;
  section += `> **Itens:** ${items.length} (${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3)
`;
  section += `
`;

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

/** Appends a formatted section to the backlog file, filtering duplicates. */
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

/** Converts a health audit issue to a BacklogItem. */
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

/** Converts a maturity dimension gap to a BacklogItem. */
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
