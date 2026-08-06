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
  type BacklogIntegrityIssue,
  type BacklogPriority,
  type BacklogSeverity,
  normalizeState,
} from "../domain/types/backlog-types.js";

// Fields a single well-formed item table sets at most once. Used to detect
// orphan table blocks (no "### " header of their own) that would otherwise
// silently overwrite the preceding item's fields — see parseModularFormat.
const MODULAR_FIELD_KEYS = [
  "Status",
  "Severidade",
  "Prioridade",
  "Owner",
  "Descricao",
  "Fonte",
  "Data",
] as const;

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
  return parseBacklogWithIntegrity(filePath).items;
}

/**
 * Same parse as parseBacklogItems, but also returns any structural
 * integrity issues found (orphan table blocks with no "### " header).
 * Callers that want to surface data-quality problems (getBacklog,
 * `shugo doctor`, etc.) should use this instead of parseBacklogItems.
 */
export function parseBacklogWithIntegrity(
  filePath: string,
): { items: BacklogItem[]; issues: BacklogIntegrityIssue[] } {
  if (!existsSync(filePath)) return { items: [], issues: [] };

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const hasModularHeaders = lines.some((l) => l.startsWith("### "));

  if (hasModularHeaders) {
    return parseModularFormat(content, filePath);
  }
  return { items: parseLegacyFormat(content, filePath), issues: [] };
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

// Mutable state for orphan-block detection across field lines of an item.
interface OrphanDetector {
  /** fields already applied to the current item */
  seenFields: Set<string>;
  /** true once a headerless table block has been flagged; skip until next header */
  inOrphanBlock: boolean;
}

// Per-item parse context passed to applyModularFieldLine.
interface ModularFieldContext {
  currentItem: Partial<BacklogItem>;
  detector: OrphanDetector;
  issues: BacklogIntegrityIssue[];
  filePath: string;
}

/**
 * Applies one "| **Campo** | valor |" line to the current item, unless it
 * belongs to an orphan (headerless) table block — in which case the block
 * is flagged in `issues` and its remaining lines are skipped instead of
 * silently overwriting the preceding item's fields.
 */
function applyModularFieldLine(
  ctx: ModularFieldContext,
  key: string,
  rawValue: string,
  line: number,
): void {
  const { currentItem, detector, issues, filePath } = ctx;
  if (detector.inOrphanBlock) return;

  if (MODULAR_FIELD_KEYS.includes(key as (typeof MODULAR_FIELD_KEYS)[number]) && detector.seenFields.has(key)) {
    // This field was already set on currentItem — the table we're reading
    // now belongs to a different (headerless) item. Stop mutating
    // currentItem and report the anomaly instead.
    detector.inOrphanBlock = true;
    issues.push({
      precedingItemId: currentItem.id ?? "(sem id)",
      line,
      repeatedField: key,
      filePath,
    });
    return;
  }

  const value = rawValue.trim().replace(/\|$/, "").trim();
  applyModularField(currentItem, key, value);
  detector.seenFields.add(key);
}

function parseModularFormat(
  content: string,
  filePath: string,
): { items: BacklogItem[]; issues: BacklogIntegrityIssue[] } {
  const items: BacklogItem[] = [];
  const issues: BacklogIntegrityIssue[] = [];
  const lines = content.split("\n");
  let currentSection = "";
  let currentItem: Partial<BacklogItem> | null = null;
  let detector: OrphanDetector = { seenFields: new Set(), inOrphanBlock: false };

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
      detector = { seenFields: new Set(), inOrphanBlock: false };
      continue;
    }

    if (currentItem && line.startsWith("| **")) {
      const fieldMatch = line.match(/\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|?\s*$/);
      if (fieldMatch?.[1] && fieldMatch?.[2]) {
        applyModularFieldLine(
          { currentItem, detector, issues, filePath },
          fieldMatch[1],
          fieldMatch[2],
          i,
        );
      }
    }
  }

  if (currentItem?.id) items.push(currentItem as BacklogItem);
  return { items, issues };
}

// ── Find Item ──────────────────────────────────────────────────────────────

export function findItem(items: BacklogItem[], taskId: string): BacklogItem | null {
  const lower = taskId.toLowerCase();
  const exact = items.find((item) => item.id.toLowerCase() === lower);
  if (exact) return exact;
  return items.find((item) => item.id.toLowerCase().startsWith(lower)) || null;
}
