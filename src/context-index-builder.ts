/**
 * context-index-builder.ts — P4 Compressed Index Builder
 *
 * Generates a lightweight index of P4 documents (history/*.md, feedback/records/*.md)
 * that is always loaded, even in loading_profile: minimal.
 *
 * The index contains one line per document with file name, date, and summary,
 * allowing agents to discover P4 content without loading full documents.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface IndexEntry {
  file: string;
  date: string;
  summary: string;
}

export interface P4IndexResult {
  entries: IndexEntry[];
  indexPath: string;
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the first non-empty line after the title as summary.
 * Truncates to 120 characters.
 */
function extractSummary(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  // Skip first line (title) and get second line
  const summaryLine = lines[1] ?? "";
  return summaryLine.slice(0, 120).replace(/[#*_`]/g, "").trim();
}

/**
 * Escape special characters for YAML string values.
 */
function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"').replace(/:/g, '\\:');
}

/**
 * Extract date from filename (expects YYYY-MM-DD prefix).
 */
function extractDate(filename: string): string {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

// ── Scan Helpers ─────────────────────────────────────────────────────────────

function scanHistoryDir(shitennoDir: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const historyDir = join(shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return entries;

  try {
    const files = readdirSync(historyDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = readFileSync(join(historyDir, file), "utf-8");
      entries.push({
        file: `docs/history/${file}`,
        date: extractDate(file),
        summary: extractSummary(content),
      });
    }
  } catch (err) {
    logger.debug("buildP4Index", "Failed to read history directory:", err instanceof Error ? err.message : err);
  }
  return entries;
}

function scanFeedbackDir(shitennoDir: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const feedbackDir = join(shitennoDir, "feedback", "records");
  if (!existsSync(feedbackDir)) return entries;

  try {
    const files = readdirSync(feedbackDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const content = readFileSync(join(feedbackDir, file), "utf-8");
      try {
        const record = JSON.parse(content);
        const summary = record.outcome
          ? `Feedback: ${record.outcome}${record.failureHotspots ? ` — ${record.failureHotspots.join(", ")}` : ""}`
          : "Feedback record";
        entries.push({
          file: `feedback/records/${file}`,
          date: extractDate(file) || record.timestamp?.slice(0, 10) || "",
          summary,
        });
      } catch {
        logger.debug("context-index-builder", "Skipping invalid feedback JSON record");
      }
    }
  } catch (err) {
    logger.debug("buildP4Index", "Failed to read feedback directory:", err instanceof Error ? err.message : err);
  }
  return entries;
}

function writeP4IndexFile(shitennoDir: string, entries: IndexEntry[]): string {
  const indexPath = join(shitennoDir, "governance", "context", "p4_index.yaml");
  const indexDir = join(shitennoDir, "governance", "context");

  if (!existsSync(indexDir)) {
    try {
      mkdirSync(indexDir, { recursive: true });
    } catch {
      logger.debug("context-index-builder", "Failed to create index directory — best-effort");
    }
  }

  const yamlContent = entries
    .map((e) => `- file: ${e.file}\n  date: ${e.date}\n  summary: "${escapeYaml(e.summary)}"`)
    .join("\n");

  try {
    writeFileSync(indexPath, yamlContent, "utf-8");
  } catch (err) {
    logger.debug("buildP4Index", "Failed to write index:", err instanceof Error ? err.message : err);
  }
  return indexPath;
}

// ── Main Builder ───────────────────────────────────────────────────────────

/**
 * Build P4 compressed index from history and feedback directories.
 *
 * @param shitennoDir - Path to shitenno/ directory
 * @returns P4IndexResult with entries and metadata
 */
export function buildP4Index(shitennoDir: string): P4IndexResult {
  const generatedAt = new Date().toISOString();
  const entries = [...scanHistoryDir(shitennoDir), ...scanFeedbackDir(shitennoDir)];
  const indexPath = writeP4IndexFile(shitennoDir, entries);
  return { entries, indexPath, generatedAt };
}

/**
 * Load existing P4 index if available.
 *
 * @param shitennoDir - Path to shitenno/ directory
 * @returns Array of IndexEntry or empty array if no index exists
 */
export function loadP4Index(shitennoDir: string): IndexEntry[] {
  const indexPath = join(shitennoDir, "governance", "context", "p4_index.yaml");

  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const content = readFileSync(indexPath, "utf-8");
    const entries: IndexEntry[] = [];
    const lines = content.split("\n");
    let current: Partial<IndexEntry> = {};

    for (const line of lines) {
      if (line.startsWith("- file: ")) {
        if (current.file) {
          entries.push(current as IndexEntry);
        }
        current = { file: line.slice(8).trim() };
      } else if (line.startsWith("  date: ")) {
        current.date = line.slice(8).trim();
      } else if (line.startsWith("  summary: ")) {
        current.summary = line.slice(11).replace(/"/g, "").trim();
      }
    }

    if (current.file) {
      entries.push(current as IndexEntry);
    }

    return entries;
  } catch (err) {
    logger.debug("loadP4Index", "Failed to load index:", err instanceof Error ? err.message : err);
    return [];
  }
}
