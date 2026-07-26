/**
 * markdown-plan-engine/parser.ts — Frontmatter parsing functions
 *
 * Extracted from markdown-plan-engine.ts to keep modules focused.
 */

import { parse as parseYaml } from "yaml";

// ── Constants ───────────────────────────────────────────────────────────────

export const YAML_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// ── YAML Frontmatter Parser ────────────────────────────────────────────────

/**
 * Parse a YAML frontmatter block if the file has one. Returns null if
 * there isn't one, or if it fails to parse — callers fall back to the
 * legacy **Field:** text format, which continues to work unchanged.
 */
export function parseYamlFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(YAML_BLOCK_RE);
  if (!match || !match[1]) return null;

  try {
    const parsed = parseYaml(match[1]);
    if (!parsed || typeof parsed !== "object") return null;

    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      metadata[key.toLowerCase().replace(/\s+/g, "_")] = String(value);
    }
    return metadata;
  } catch {
    return null;
  }
}

// ── Legacy Frontmatter Parser ──────────────────────────────────────────────

/**
 * Parse frontmatter from markdown content.
 * Format: **Field:** value (not YAML, per project convention).
 *
 * Looks for **Field:** patterns in the header area (before first `---` separator
 * or first `##` heading). Handles both formats:
 *   1. Frontmatter before `# Title`
 *   2. `**Field:** value` after `# Title` but before `---`
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const yamlMetadata = parseYamlFrontmatter(content);
  if (yamlMetadata) return yamlMetadata;

  const metadata: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    if (line.trim() === "---") break;
    if (line.startsWith("## ")) break;

    const match = line.match(/^\*\*(.+?:)\*\*\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1].replace(/:$/, "").toLowerCase().replace(/\s+/g, "_");
      const value = match[2].trim();
      metadata[key] = value;
    }
  }

  return metadata;
}

// ── Title Extraction ───────────────────────────────────────────────────────

/**
 * Extract title from markdown content (first heading).
 */
export function extractTitle(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.slice(2).trim();
    }
  }
  return "Untitled Plan";
}
