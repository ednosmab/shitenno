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

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sanitizePlanId } from "./path-safety.js";
import { getEventBus } from "./event-bus.js";

import { YAML_BLOCK_RE, parseFrontmatter, extractTitle } from "./markdown-plan-engine/parser.js";
import { isCompletionStatus, extractStatus, type MarkdownPlanStatus } from "./markdown-plan-engine/status.js";
import {
  updateYamlStatus,
  updateLegacyStatus,
  publishStatusEvents,
  moveToDone as moveToDoneUtil,
} from "./markdown-plan-engine/file-operations.js";
import { generateId, generateTemplate, type CreatePlanInput } from "./markdown-plan-engine/template.js";

// ── Re-exports ──────────────────────────────────────────────────────────────

export { isCompletionStatus, type MarkdownPlanStatus } from "./markdown-plan-engine/status.js";
export type { CreatePlanInput } from "./markdown-plan-engine/template.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MarkdownPlan {
  id: string;
  title: string;
  status: MarkdownPlanStatus;
  filePath: string;
  relativePath: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
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

  getById(id: string): MarkdownPlan | null {
    const safeId = sanitizePlanId(id);

    const activePath = join(this.plansDir, `${safeId}.md`);
    if (existsSync(activePath)) {
      return this.parsePlan(safeId, activePath, `shitenno/governance/plans/${safeId}.md`);
    }

    const donePath = join(this.doneDir, `${safeId}.md`);
    if (existsSync(donePath)) {
      return this.parsePlan(safeId, donePath, `shitenno/governance/plans/done/${safeId}.md`);
    }

    const refPath = join(this.referenceDir, `${safeId}.md`);
    if (existsSync(refPath)) {
      return this.parsePlan(safeId, refPath, `shitenno/governance/plans/reference/${safeId}.md`);
    }

    return null;
  }

  updateStatus(id: string, newStatus: MarkdownPlanStatus): MarkdownPlan {
    const plan = this.getById(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    let content = readFileSync(plan.filePath, "utf-8");
    const yamlResult = updateYamlStatus(content, newStatus);

    if (!yamlResult.updated) {
      content = updateLegacyStatus(content, newStatus);
    } else {
      content = yamlResult.content;
    }

    writeFileSync(plan.filePath, content, "utf-8");
    publishStatusEvents(
      id,
      plan.status,
      plan.relativePath,
      plan.title,
      newStatus,
      this.plansDir,
      this.doneDir
    );
    return this.getById(id)!;
  }

  moveToDone(id: string): void {
    moveToDoneUtil(id, this.plansDir, this.doneDir);
  }

  archiveIfDone(id: string): boolean {
    const plan = this.getById(id);
    if (!plan) return false;
    if (!isCompletionStatus(plan.status)) return false;
    if (!plan.isActive) return false;
    const sourcePath = join(this.plansDir, `${id}.md`);
    if (!existsSync(sourcePath)) return false;

    moveToDoneUtil(id, this.plansDir, this.doneDir);

    const bus = getEventBus();
    bus.publish("plan.archived", {
      planId: id,
      title: plan.title,
      path: `shitenno/governance/plans/done/${id}.md`,
      finalStatus: "done",
    });

    return true;
  }

  create(input: CreatePlanInput): MarkdownPlan {
    const id = generateId(input.title);
    const filePath = join(this.plansDir, `${id}.md`);
    const now = new Date().toISOString();

    const content = generateTemplate({
      ...input,
      id,
      createdAt: now,
    });

    writeFileSync(filePath, content, "utf-8");

    return this.parsePlan(id, filePath, `shitenno/governance/plans/${id}.md`)!;
  }

  private normalizePlanHeader(filePath: string, content: string): string {
    if (/^\*\*Status:\*\*/m.test(content)) return content;
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
