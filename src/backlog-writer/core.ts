/**
 * core.ts — Core backlog write operations: addItem, deleteItem, transitionItem, moveItemToDone.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "../shared/logger.js";
import {
  type BacklogItem,
  type BacklogState,
  type TransitionResult,
  type AddItemInput,
  getAllowedTransitions,
  isValidTransition,
} from "../domain/types/backlog-types.js";
import { parseBacklogItems, findItem } from "../infrastructure/backlog-parser.js";

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

function updateModularStatus(filePath: string, headerLineIdx: number, toState: BacklogState): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("### ")) break;
    if (/^\s*\|\s*\*\*Status\*\*\s*\|/.test(line)) {
      lines[i] = `| **Status** | ${toState} |`;
      writeFileSync(filePath, lines.join("\n"), "utf-8");
      return;
    }
  }
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
  toState: BacklogState
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

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const line = lines[item.line];

    if (item.format === "modular") {
      updateModularStatus(filePath, item.line, toState);
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
