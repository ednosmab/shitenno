/**
 * backlog-parser.ts — Unified Parser + Paths + Find
 *
 * Parses both legacy and modular backlog formats.
 * Provides resolveBacklogPaths and findItem helpers.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BacklogItem,
  type BacklogPriority,
  type BacklogSeverity,
  normalizeState,
} from "./backlog-types.js";

// ── Default Paths ──────────────────────────────────────────────────────────

const BACKLOG_DIR = "docs/backlog";
const ACTIVE_PATH = join(BACKLOG_DIR, "ACTIVE.md");
const DONE_PATH = join(BACKLOG_DIR, "DONE.md");
const LEGACY_PATH = "docs/BACKLOG.md";

export function resolveBacklogPaths(shitennoDir: string) {
  const modularActive = join(shitennoDir, ACTIVE_PATH);
  const modularDone = join(shitennoDir, DONE_PATH);
  const legacy = join(shitennoDir, LEGACY_PATH);

  if (existsSync(modularActive)) {
    return { active: modularActive, done: modularDone, format: "modular" as const };
  }
  if (existsSync(legacy)) {
    return { active: legacy, done: undefined, format: "legacy" as const };
  }
  return { active: modularActive, done: modularDone, format: "modular" as const };
}

// ── Unified Parser ─────────────────────────────────────────────────────────

export function parseBacklogItems(filePath: string): BacklogItem[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const hasModularHeaders = lines.some((l) => l.startsWith("### "));

  if (hasModularHeaders) {
    return parseModularFormat(content, filePath);
  }
  return parseLegacyFormat(content, filePath);
}

function parseLegacyFormat(content: string, filePath: string): BacklogItem[] {
  const lines = content.split("\n");
  const items: BacklogItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("|")) continue;

    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const [id, title, priority, status] = cells;
    if (!id || id === "ID" || id === "Item") continue;

    const state = normalizeState(status || "");
    if (!state) continue;

    items.push({
      id: id!,
      title: title || "",
      state,
      priority: (priority || "").toUpperCase() as BacklogPriority,
      severity: "",
      owner: "",
      description: "",
      source: "",
      date: "",
      line: i,
      filePath,
      format: "legacy",
    });
  }
  return items;
}

// ── Modular Format Parsing ─────────────────────────────────────────────────

function createItemFromHeader(
  titleRaw: string,
  currentSection: string,
  i: number,
  filePath: string,
): Partial<BacklogItem> {
  const id = titleRaw.split(" ")[0]!;
  return {
    id,
    title: titleRaw,
    state: "planeado",
    priority: (currentSection || "") as BacklogPriority,
    severity: "",
    owner: "",
    description: "",
    source: "",
    date: "",
    line: i,
    filePath,
    format: "modular" as const,
  };
}

function applyModularField(item: Partial<BacklogItem>, key: string, value: string): void {
  switch (key) {
    case "Status": {
      const normalized = normalizeState(value);
      if (normalized) item.state = normalized;
      break;
    }
    case "Severidade":
      item.severity = value as BacklogSeverity;
      break;
    case "Prioridade":
      item.priority = value.toUpperCase() as BacklogPriority;
      break;
    case "Owner":
      item.owner = value;
      break;
    case "Descricao":
      item.description = value;
      break;
    case "Fonte":
      item.source = value;
      break;
    case "Data":
      item.date = value;
      break;
  }
}

function parseModularFormat(content: string, filePath: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = content.split("\n");
  let currentSection = "";
  let currentItem: Partial<BacklogItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const sectionMatch = line.match(/^## (P[0-9]+)\s/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!;
      continue;
    }

    const itemMatch = line.match(/^### (.+)/);
    if (itemMatch) {
      if (currentItem?.id) items.push(currentItem as BacklogItem);
      currentItem = createItemFromHeader(itemMatch[1]!, currentSection, i, filePath);
      continue;
    }

    if (currentItem && line.startsWith("| **")) {
      const fieldMatch = line.match(/\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|?\s*$/);
      if (fieldMatch?.[1] && fieldMatch?.[2]) {
        const value = fieldMatch[2].trim().replace(/\|$/, "").trim();
        applyModularField(currentItem, fieldMatch[1], value);
      }
    }
  }

  if (currentItem?.id) items.push(currentItem as BacklogItem);
  return items;
}

// ── Find Item ──────────────────────────────────────────────────────────────

export function findItem(items: BacklogItem[], taskId: string): BacklogItem | null {
  const lower = taskId.toLowerCase();
  const exact = items.find((item) => item.id.toLowerCase() === lower);
  if (exact) return exact;
  return items.find((item) => item.id.toLowerCase().startsWith(lower)) || null;
}
