/**
 * knowledge-loader.ts — Reads real content from ADRs and skills
 *
 * Unlike knowledge-graph/discovery.ts (which only reads metadata),
 * this module reads the actual markdown content of ADRs and skills,
 * making them available to MCP tools and the context pipeline.
 *
 * PRINCIPLE: Agents should be able to discover and read governance
 * knowledge (ADRs, skills) at runtime via MCP, not just metadata.
 */

import { readFileSync, readdirSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { sanitizePlanName } from "./path-safety.js";

// ── Types ──────────────────────────────────────────────────────────────────

/** Lightweight ADR summary (metadata only, no body). */
export interface AdrSummary {
  id: string;          // "ADR-008"
  title: string;
  status: string;      // Proposed | Accepted | Deprecated
  filename: string;
}

/** Full ADR with complete markdown content. */
export interface AdrFull extends AdrSummary {
  content: string;      // markdown completo
}

/** Lightweight skill metadata from frontmatter. */
export interface SkillMeta {
  name: string;         // from frontmatter YAML
  description: string;  // from frontmatter YAML
  filename: string;
}

/** Full skill with complete markdown content (frontmatter stripped). */
export interface SkillFull extends SkillMeta {
  content: string;       // markdown completo, sem o frontmatter
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readHeadOfFile(path: string, maxBytes: number): string {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = readSync(fd, buf, 0, maxBytes, 0);
    return buf.toString("utf-8", 0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns meta object and body (content after frontmatter).
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) meta[key.trim()] = rest.join(":").trim().replace(/^>\s*/, "");
  }
  return { meta, body: match[2]!.trim() };
}

// ── ADR Functions ──────────────────────────────────────────────────────────

/**
 * List ADRs with lightweight metadata (status + title), without loading the full body.
 * Returns summaries sorted by ID.
 */
export function listAdrs(shitennoDir: string): AdrSummary[] {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return [];

  return readdirSync(adrDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE"))
    .map((filename) => {
      const head = readHeadOfFile(join(adrDir, filename), 2048);
      const idMatch = filename.match(/^(ADR-\d+)/);
      const titleMatch = head.match(/^#\s*(.+)$/m);
      const statusMatch = head.match(/\*\*Status:\*\*\s*(\w+)/);
      return {
        id: idMatch?.[1] ?? filename,
        title: titleMatch?.[1]?.replace(/^ADR-\d+:\s*/, "") ?? filename,
        status: statusMatch?.[1] ?? "Unknown",
        filename,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Load full content of a specific ADR by id or filename.
 * Returns null if not found or on unsafe input (does not throw).
 */
export function getAdr(shitennoDir: string, idOrFilename: string): AdrFull | null {
  const adrDir = join(shitennoDir, "docs", "adrs");
  let safe: string;
  try {
    safe = sanitizePlanName(idOrFilename);
  } catch {
    return null;
  }
  const summaries = listAdrs(shitennoDir);
  const match = summaries.find(
    (a) => a.id === safe || a.filename === safe || a.filename === `${safe}.md`
  );
  if (!match) return null;

  const content = readFileSync(join(adrDir, match.filename), "utf-8");
  return { ...match, content };
}

// ── Skill Functions ────────────────────────────────────────────────────────

/**
 * List skills with metadata from frontmatter (name + description), without full body.
 */
export function listSkills(shitennoDir: string): SkillMeta[] {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const head = readHeadOfFile(join(skillsDir, filename), 2048);
      const { meta } = parseFrontmatter(head);
      return {
        name: meta.name ?? filename.replace(".md", ""),
        description: meta.description ?? "",
        filename,
      };
    });
}

/**
 * Load full content of a specific skill by name or filename.
 * Returns null if not found or on unsafe input (does not throw).
 */
export function getSkill(shitennoDir: string, nameOrFilename: string): SkillFull | null {
  const skillsDir = join(shitennoDir, "docs", "skills");
  let safe: string;
  try {
    safe = sanitizePlanName(nameOrFilename);
  } catch {
    return null;
  }
  const summaries = listSkills(shitennoDir);
  const match = summaries.find(
    (s) => s.name === safe || s.filename === safe || s.filename === `${safe}.md`
  );
  if (!match) return null;

  const raw = readFileSync(join(skillsDir, match.filename), "utf-8");
  const { body } = parseFrontmatter(raw);
  return { ...match, content: body };
}
