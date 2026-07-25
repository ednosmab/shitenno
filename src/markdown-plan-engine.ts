/**
 * markdown-plan-engine.ts — Markdown Plan Engine
 *
 * Manages human-authored markdown execution plans.
 * Plans are stored in governance/plans/ with status tracking.
 *
 * Status flow: andamento → parado → check → done
 *                                      ↳ refused (retry → check)
 * "done" e "refused" só devem ser escritos pelo pipeline de verificação
 * (ver plan-lifecycle.ts:runAutoVerification), nunca diretamente pelo agente.
 * When status = done, plan is moved to done/ subdirectory.
 *
 * Architecture: MarkdownPlan → Frontmatter Parser → File Operations
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getEventBus } from "./event-bus.js";
import { sanitizePlanId } from "./path-safety.js";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type MarkdownPlanStatus = "andamento" | "parado" | "check" | "checked" | "done" | "blocked" | "refused";

const COMPLETION_STATUSES = new Set(["done", "checked", "concluído", "concluido"]);

function isCompletionStatus(status: string): boolean {
  return COMPLETION_STATUSES.has(status.toLowerCase());
}

export interface MarkdownPlan {
  /** Plan ID (filename without .md). */
  id: string;
  /** Plan title (from first heading). */
  title: string;
  /** Current status. */
  status: MarkdownPlanStatus;
  /** Absolute file path. */
  filePath: string;
  /** Relative path from project root (e.g. shitenno/governance/plans/...). */
  relativePath: string;
  /** Whether the plan is in the active directory (not done, not reference). */
  isActive: boolean;
  /** Creation date from frontmatter. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Additional frontmatter fields. */
  metadata: Record<string, string>;
}

export interface CreatePlanInput {
  /** Plan title. */
  title: string;
  /** Optional description. */
  description?: string;
  /** Priority (P0, P1, P2). */
  priority?: string;
  /** Estimated time. */
  estimatedTime?: string;
  /** Owner. */
  owner?: string;
  /** Custom content to append. */
  content?: string;
}

// ── Frontmatter Parser ─────────────────────────────────────────────────────

/**
 * Match a real YAML frontmatter block (--- ... ---) at the very start of
 * the file — the standard convention (Jekyll/Hugo/Obsidian/etc.), not the
 * project's bespoke **Field:** text format below.
 */
const YAML_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a YAML frontmatter block if the file has one. Returns null if
 * there isn't one, or if it fails to parse — callers fall back to the
 * legacy **Field:** text format, which continues to work unchanged.
 */
function parseYamlFrontmatter(content: string): Record<string, string> | null {
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
    // Malformed YAML block — treat as if there wasn't one, rather than
    // crashing plan detection for the whole project.
    return null;
  }
}

/**
 * Parse frontmatter from markdown content.
 * Format: **Field:** value (not YAML, per project convention).
 *
 * Looks for **Field:** patterns in the header area (before first `---` separator
 * or first `##` heading). Handles both formats:
 *   1. Frontmatter before `# Title`
 *   2. `**Field:** value` after `# Title` but before `---`
 */
function parseFrontmatter(content: string): Record<string, string> {
  // Prefer a real YAML frontmatter block when present — it's unambiguous,
  // and needs no tolerance hacks for bold markers, colon placement, or case.
  const yamlMetadata = parseYamlFrontmatter(content);
  if (yamlMetadata) return yamlMetadata;

  const metadata: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    // Stop at horizontal rule separator (---)
    if (line.trim() === "---") break;

    // Stop at second-level heading (## Section)
    if (line.startsWith("## ")) break;

    // Match **Field:** value pattern (format: **FieldName:** Value)
    const match = line.match(/^\*\*(.+?:)\*\*\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1].replace(/:$/, "").toLowerCase().replace(/\s+/g, "_");
      const value = match[2].trim();
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Extract title from markdown content (first heading).
 */
function extractTitle(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.slice(2).trim();
    }
  }
  return "Untitled Plan";
}

/**
 * Normalize a raw status string (e.g. from frontmatter or a loose match)
 * into the canonical MarkdownPlanStatus.
 */
function normalizeStatusValue(raw: string): MarkdownPlanStatus {
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
 * **Status:** frontmatter field. Each status needs a text that,
 * when re-read by normalizeStatusValue(), maps back to the same
 * canonical status (round-trip) — otherwise the signal (e.g. "blocked")
 * is silently lost on re-read.
 */
function statusDisplayText(status: MarkdownPlanStatus): string {
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
 * Extract status from frontmatter.
 *
 * Detection order:
 *   1. Strict frontmatter field (**Status:** value) — the canonical format
 *      written by `updateStatus()` / `shugo plan md done`.
 *   2. Loose status line — tolerates missing/misplaced bold markers and
 *      case, in case the field was hand-edited (e.g. "Status: Done" or
 *      "**Status**: Done") instead of set via the CLI.
 *   3. Checkbox fallback — only meaningful when the plan actually has a
 *      checklist. A plan with zero checkboxes (a design-style document)
 *      cannot be inferred as done this way and stays "andamento" until
 *      the status is set explicitly.
 */
function extractStatus(metadata: Record<string, string>, content: string): MarkdownPlanStatus {
  const statusField = metadata["status"];
  if (statusField) {
    return normalizeStatusValue(statusField);
  }

  // Loose match: tolerates "Status: X", "**Status**: X", any case, extra
  // bold markers in either position — catches hand-edited headers that
  // don't match the strict **Status:** pattern parseFrontmatter expects.
  const looseMatch = content.match(/^\s*\*{0,2}status\*{0,2}\s*:\s*\*{0,2}\s*(.+?)\s*\*{0,2}\s*$/im);
  if (looseMatch && looseMatch[1]) {
    return normalizeStatusValue(looseMatch[1]);
  }

  // Fallback: check if all checkboxes are [x] (plan used checklist format)
  const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
  const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;

  if (openBoxes === 0 && closedBoxes === 0) {
    // No checklist present at all — this is a design-style document, not
    // a checklist-driven plan. There's nothing to infer from; status can
    // only come from an explicit field (case above) or `shugo plan md done`.
    return "andamento";
  }

  if (closedBoxes > 0 && openBoxes === 0) return "done";

  return "andamento";
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class MarkdownPlanEngine {
  private plansDir: string;
  private doneDir: string;
  private referenceDir: string;

  constructor(shitennoDir: string) {
    this.plansDir = join(shitennoDir, "governance", "plans");
    this.doneDir = join(this.plansDir, "done");
    this.referenceDir = join(this.plansDir, "reference");

    // Ensure directories exist
    if (!existsSync(this.plansDir)) {
      mkdirSync(this.plansDir, { recursive: true });
    }
    if (!existsSync(this.doneDir)) {
      mkdirSync(this.doneDir, { recursive: true });
    }
    if (!existsSync(this.referenceDir)) {
      mkdirSync(this.referenceDir, { recursive: true });
    }
  }

  /**
   * List all active plans (not done, not reference).
   */
  list(): MarkdownPlan[] {
    if (!existsSync(this.plansDir)) return [];

    const files = readdirSync(this.plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE") && f !== "README.md"
    );

    const plans: MarkdownPlan[] = [];
    for (const file of files) {
      const id = file.replace(".md", "");
      const filePath = join(this.plansDir, file);
      const plan = this.parsePlan(id, filePath, `shitenno/governance/plans/${file}`);
      if (plan && !isCompletionStatus(plan.status)) {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * List all plans including done — used by inference engine
   * to detect inconsistencies (status=done but checkboxes open).
   */
  listAll(): MarkdownPlan[] {
    if (!existsSync(this.plansDir)) return [];

    const files = readdirSync(this.plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE") && f !== "README.md"
    );

    const plans: MarkdownPlan[] = [];
    for (const file of files) {
      const id = file.replace(".md", "");
      const filePath = join(this.plansDir, file);
      const plan = this.parsePlan(id, filePath, `shitenno/governance/plans/${file}`);
      if (plan) {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * List all done plans.
   */
  listDone(): MarkdownPlan[] {
    if (!existsSync(this.doneDir)) return [];

    const files = readdirSync(this.doneDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );

    const plans: MarkdownPlan[] = [];
    for (const file of files) {
      const id = file.replace(".md", "");
      const filePath = join(this.doneDir, file);
      const plan = this.parsePlan(id, filePath, `shitenno/governance/plans/done/${file}`);
      if (plan) {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * Get a plan by ID.
   * Searches in active, done, and reference directories.
   */
  getById(id: string): MarkdownPlan | null {
    const safeId = sanitizePlanId(id);

    // Search in active plans
    const activePath = join(this.plansDir, `${safeId}.md`);
    if (existsSync(activePath)) {
      return this.parsePlan(safeId, activePath, `shitenno/governance/plans/${safeId}.md`);
    }

    // Search in done plans
    const donePath = join(this.doneDir, `${safeId}.md`);
    if (existsSync(donePath)) {
      return this.parsePlan(safeId, donePath, `shitenno/governance/plans/done/${safeId}.md`);
    }

    // Search in reference plans
    const refPath = join(this.referenceDir, `${safeId}.md`);
    if (existsSync(refPath)) {
      return this.parsePlan(safeId, refPath, `shitenno/governance/plans/reference/${safeId}.md`);
    }

    return null;
  }

  private updateYamlStatus(content: string, newStatus: MarkdownPlanStatus): { content: string; updated: boolean } {
    const yamlMatch = content.match(YAML_BLOCK_RE);
    if (!yamlMatch || !yamlMatch[1]) return { content, updated: false };

    try {
      const parsed = (parseYaml(yamlMatch[1]) as Record<string, unknown>) ?? {};
      parsed.status = newStatus;
      parsed.updated_at = new Date().toISOString();
      const newBlock = `---\n${stringifyYaml(parsed).trimEnd()}\n---\n`;
      const updated = content.slice(0, yamlMatch.index) + newBlock + content.slice((yamlMatch.index ?? 0) + yamlMatch[0].length);
      return { content: updated, updated: true };
    } catch {
      logger.debug("markdown-plan-engine", "Malformed YAML block — falling through to legacy path");
      return { content, updated: false };
    }
  }

  private updateLegacyStatus(content: string, newStatus: MarkdownPlanStatus): string {
    const statusRegex = /(\*\*Status:\*\*\s*)(.+)/;
    const statusMatch = content.match(statusRegex);

    if (statusMatch) {
      content = content.replace(statusRegex, `$1${statusDisplayText(newStatus)}`);
    } else {
      const lines = content.split("\n");
      const titleIndex = lines.findIndex((l) => l.startsWith("# "));
      if (titleIndex !== -1) {
        lines.splice(titleIndex + 2, 0, "", `**Status:** ${statusDisplayText(newStatus)}`);
        content = lines.join("\n");
      }
    }

    const updatedAtRegex = /(\*\*Updated_at:\*\*\s*)(.+)/;
    if (content.match(updatedAtRegex)) {
      content = content.replace(updatedAtRegex, `$1${new Date().toISOString()}`);
    }

    return content;
  }

  private publishStatusEvents(id: string, plan: MarkdownPlan, newStatus: MarkdownPlanStatus): void {
    if (plan.status !== newStatus) {
      const bus = getEventBus();
      bus.publish("plan.status_changed", {
        planId: id,
        oldStatus: plan.status,
        newStatus,
        path: plan.relativePath,
      });
    }

    if (isCompletionStatus(newStatus)) {
      this.moveToDone(id);
      const bus = getEventBus();
      bus.publish("plan.archived", {
        planId: id,
        title: plan.title,
        path: `shitenno/governance/plans/done/${id}.md`,
        finalStatus: "done",
      });
    }
  }

  updateStatus(id: string, newStatus: MarkdownPlanStatus): MarkdownPlan {
    const plan = this.getById(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    let content = readFileSync(plan.filePath, "utf-8");
    const yamlResult = this.updateYamlStatus(content, newStatus);

    if (!yamlResult.updated) {
      content = this.updateLegacyStatus(content, newStatus);
    } else {
      content = yamlResult.content;
    }

    writeFileSync(plan.filePath, content, "utf-8");
    this.publishStatusEvents(id, plan, newStatus);
    return this.getById(id)!;
  }

  /**
   * Move plan to done/ directory.
   */
  moveToDone(id: string): void {
    const sourcePath = join(this.plansDir, `${id}.md`);
    const destPath = join(this.doneDir, `${id}.md`);

    if (!existsSync(sourcePath)) {
      throw new Error(`Plan file not found: ${sourcePath}`);
    }

    if (!existsSync(this.doneDir)) {
      mkdirSync(this.doneDir, { recursive: true });
    }
    renameSync(sourcePath, destPath);

    // Arrasta o .verification.json junto, se existir. Cobre os dois
    // caminhos de chamada — via updateStatus() direto e via archiveIfDone()
    // (chamado pelo daemon quando o agente edita o .md manualmente).
    const verificationSrc = join(this.plansDir, `${id}.verification.json`);
    const verificationDest = join(this.doneDir, `${id}.verification.json`);
    if (existsSync(verificationSrc)) {
      renameSync(verificationSrc, verificationDest);
    }
  }

  /**
   * Check if a plan file has status "done" and archive it if so.
   * Used by file-watcher for reactive archival.
   * Returns true if the plan was archived.
   */
  archiveIfDone(id: string): boolean {
    const plan = this.getById(id);
    if (!plan) return false;
    if (!isCompletionStatus(plan.status)) return false;
    // Guard: if plan is already in done/ or source file doesn't exist, skip
    if (!plan.isActive) return false;
    const sourcePath = join(this.plansDir, `${id}.md`);
    if (!existsSync(sourcePath)) return false;

    this.moveToDone(id);

    const bus = getEventBus();
    bus.publish("plan.archived", {
      planId: id,
      title: plan.title,
      path: `shitenno/governance/plans/done/${id}.md`,
      finalStatus: "done",
    });

    return true;
  }

  /**
   * Create a new plan with template.
   */
  create(input: CreatePlanInput): MarkdownPlan {
    const id = this.generateId(input.title);
    const filePath = join(this.plansDir, `${id}.md`);
    const now = new Date().toISOString();

    const content = this.generateTemplate({
      ...input,
      id,
      createdAt: now,
    });

    writeFileSync(filePath, content, "utf-8");

    return this.parsePlan(id, filePath, `shitenno/governance/plans/${id}.md`)!;
  }

  /**
   * Generate plan ID from title.
   */
  private generateId(title: string): string {
    const date = new Date().toISOString().split("T")[0];
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    return `${date}-${slug}`;
  }

  /**
   * Generate plan template content.
   */
  private generateTemplate(input: CreatePlanInput & { id: string; createdAt: string }): string {
    const { title, description, priority, estimatedTime, owner, content, createdAt } = input;

    const frontmatter = stringifyYaml({
      status: "andamento",
      date: createdAt.split("T")[0],
      priority: priority || "P1",
      owner: owner || "AI Agent",
      estimated_time: estimatedTime || "TBD",
      updated_at: createdAt,
    }).trimEnd();

    return `---
${frontmatter}
---

# ${title}

## Context

${description || "TBD"}

---

## Steps

### Step 1: TBD

| # | Action | Verification |
|---|--------|--------------|
| 1.1 | TBD | TBD |

---

## Notes

${content || ""}
`;
  }

  /**
   * Normalize plan header: if **Status:** is missing, infer from checkboxes
   * and write it to the file.
   */
  private normalizePlanHeader(filePath: string, content: string): string {
    if (/^\*\*Status:\*\*/m.test(content)) return content;

    // YAML frontmatter plans don't need bold-field injection
    if (YAML_BLOCK_RE.test(content)) return content;

    const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
    const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;
    const status = (closedBoxes > 0 && openBoxes === 0) ? "Done" : "In Progress";

    const lines = content.split("\n");
    const titleIndex = lines.findIndex((l) => l.startsWith("# "));
    if (titleIndex === -1) return content;

    lines.splice(titleIndex + 1, 0, "", `**Status:** ${status}`);
    const updated = lines.join("\n");

    writeFileSync(filePath, updated, "utf-8");
    return updated;
  }

  /**
   * Parse a plan file into MarkdownPlan object.
   */
  private parsePlan(id: string, filePath: string, relativePath: string): MarkdownPlan | null {
    try {
      const content = readFileSync(filePath, "utf-8");
      const normalized = this.normalizePlanHeader(filePath, content);
      const metadata = parseFrontmatter(normalized);
      const title = extractTitle(normalized);
      const status = extractStatus(metadata, normalized);
      const isActive = !relativePath.includes("/done/") && !relativePath.includes("/reference/");

      return {
        id,
        title,
        status,
        filePath,
        relativePath,
        isActive,
        createdAt: metadata["date"] || metadata["created_at"] || "",
        updatedAt: metadata["updated_at"] || "",
        metadata,
      };
    } catch {
      return null;
    }
  }
}
