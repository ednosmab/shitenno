/**
 * plan.ts — Plan Engine CLI Command (thin router)
 *
 * The `shugo plan` command. Manage coordinated action sequences.
 *
 * Sub-commands are extracted to src/commands/plan/*.ts for maintainability.
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseAllDocuments } from "yaml";
import { MarkdownPlanEngine } from "../infrastructure/markdown-plan-engine.js";
import { validatePlanFormat, extractChecklistItems, extractStepHeadings } from "../domain/rules/plan-format-validator.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import { resolveBacklogPaths } from "../application/backlog-core.js";

// ── Sub-command imports ────────────────────────────────────────────────────

import { registerMdList } from "./plan/md-list.js";
import { registerMdShow } from "./plan/md-show.js";
import { registerMdStatus } from "./plan/md-status.js";
import { registerMdDone } from "./plan/md-done.js";
import { registerMdCreate } from "./plan/md-create.js";
import { registerMdPrepare } from "./plan/md-prepare.js";
import { registerMdLifecycle } from "./plan/md-lifecycle.js";

// ── Prepare Logic (reusable — used by CLI + event subscribers) ─────────────

export interface PrepareResult {
  step: string;
  status: string;
  detail: string;
}

/**
 * Run the full prepare sequence on a plan:
 * 1. Format header (Status, Date, Updated_at)
 * 2. Create centralized checklist from phase items
 * 3. Sync to BACKLOG.md
 * 4. Send desktop notification
 */
/**
 * Convert YAML frontmatter block to legacy **Field:** value lines.
 * Only handles known fields: title, status, created, author, tags.
 */
function formatYamlHeader(content: string): string {
  const yamlMatch = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
  if (!yamlMatch) return content;
  const yamlBlock = yamlMatch[1];
  if (!yamlBlock) return content;
  let rest = content.slice(yamlBlock.length);
  const docs = parseAllDocuments(yamlBlock);
  const parsed = docs[0]?.toJSON();
  if (!parsed || typeof parsed !== "object") return content;

  if (parsed.title) {
    rest = rest.replace(/^#[^\n]*\n/, "");
  }

  const lines: string[] = [];
  if (parsed.title) lines.push(`# ${parsed.title}`, "");
  if (parsed.status) lines.push(`**Status:** ${parsed.status}`);
  if (parsed.created) lines.push(`**Date:** ${parsed.created}`);
  if (parsed.author) lines.push(`**Author:** ${parsed.author}`);
  if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
    lines.push(`**Tags:** ${parsed.tags.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n") + rest;
}

/**
 * Ensure the legacy header has Status, Date, and Updated_at fields.
 * Returns true if the content was modified.
 */
export function ensureLegacyFields(content: string): { content: string; updated: boolean } {
  const lines = content.split("\n");
  let updated = false;

  if (!content.match(/\*\*Status:\*\*/)) {
    const titleLine = lines.findIndex((l) => l.startsWith("# "));
    if (titleLine !== -1) { lines.splice(titleLine + 1, 0, "", "**Status:** Pending"); updated = true; }
  }
  if (!content.match(/\*\*Date:\*\*/)) {
    const statusLine = lines.findIndex((l) => l.match(/\*\*Status:\*\*/));
    if (statusLine !== -1) { lines.splice(statusLine + 1, 0, `**Date:** ${new Date().toISOString().slice(0, 10)}`); updated = true; }
  }
  if (!content.match(/\*\*Updated_at:\*\*/)) {
    const lastField = lines.findIndex((l) => l.match(/^\*\*[A-Z]/));
    if (lastField !== -1) { lines.splice(lastField + 1, 0, `**Updated_at:** ${new Date().toISOString()}`); updated = true; }
  }

  return { content: lines.join("\n"), updated };
}

function ensureFormatHeader(plan: { filePath: string }): PrepareResult {
  try {
    let content = readFileSync(plan.filePath, "utf-8");
    const hasYamlBlock = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(content);
    let updated = false;

    if (hasYamlBlock) {
      content = formatYamlHeader(content);
      updated = true;
    }

    const result = ensureLegacyFields(content);
    content = result.content;
    updated = updated || result.updated;

    if (updated) { writeFileSync(plan.filePath, content, "utf-8"); return { step: "format_header", status: "done", detail: "Header formatted to shugo standard" }; }
    return { step: "format_header", status: "skip", detail: "Header already conformant" };
  } catch (error) { return { step: "format_header", status: "error", detail: String(error) }; }
}

function validateFormat(_shitennoDir: string, planId: string, plan: { filePath: string }): PrepareResult[] {
  const results: PrepareResult[] = [];
  try {
    const content = readFileSync(plan.filePath, "utf-8");
    const validation = validatePlanFormat(plan.filePath, content);
    for (const err of validation.errors) results.push({ step: "format_validation", status: "error", detail: err.message });
    for (const warn of validation.warnings) results.push({ step: "format_validation", status: "warn", detail: warn.message });
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      getEventBus().publish("plan.format_warning", { planId, path: plan.filePath, errors: validation.errors, warnings: validation.warnings });
      if (validation.errors.length > 0) {
        getEventBus().publish("user.notification", { title: "⚠️ Formato Inválido", message: validation.errors.map((e) => e.message).join("; "), priority: "medium" });
      }
    }
  } catch (error) { results.push({ step: "format_validation", status: "error", detail: String(error) }); }
  return results;
}

function ensureChecklist(plan: { filePath: string }): PrepareResult {
  try {
    const content = readFileSync(plan.filePath, "utf-8");
    const lines = content.split("\n");
    const stepHeadings = extractStepHeadings(content);
    const stepItems = stepHeadings.filter((s) => s.valid).map((s) => ({ text: `Passo ${s.number} — ${s.title}`, checked: false, phase: "Passos" }));
    const checklistItems = [...stepItems, ...extractChecklistItems(content)];
    const hasCentralChecklist = content.includes("## Checklist");

    if (!hasCentralChecklist && checklistItems.length > 0) {
      const insertIndex = lines.findIndex((l, i) => i > 0 && l.startsWith("## "));
      lines.splice(insertIndex, 0, "", "## Checklist", "", ...checklistItems.map((item) => `${item.checked ? "- [x]" : "- [ ]"} ${item.text}`), "");
      writeFileSync(plan.filePath, lines.join("\n"), "utf-8");
      return { step: "checklist", status: "done", detail: `Created centralized checklist with ${checklistItems.length} items` };
    }
    if (hasCentralChecklist) return { step: "checklist", status: "skip", detail: "Centralized checklist already exists" };
    return { step: "checklist", status: "skip", detail: "No checklist items found in plan" };
  } catch (error) { return { step: "checklist", status: "error", detail: String(error) }; }
}

function buildChecklistSection(checklistItems: Array<{ text: string; checked: boolean; phase: string }>): string[] {
  const lines: string[] = ["", "#### Passos do Plano"];
  const seenNumbers = new Set<string>();
  for (const item of checklistItems) {
    const numMatch = item.text.match(/^(?:Passo|Step|Phase)\s+(\d+)/i);
    if (numMatch?.[1]) { if (seenNumbers.has(numMatch[1])) continue; seenNumbers.add(numMatch[1]); }
    lines.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
  }
  return lines;
}

function buildBacklogTable(planIdUpper: string, planTitle: string, planId: string, backlogStatus: string): string[] {
  return [
    "", `### ${planIdUpper} — ${planTitle}`, "",
    "| Campo | Valor |", "|---|---|",
    `| **Status** | ${backlogStatus} |`,
    `| **Severidade** | Medio |`,
    `| **Prioridade** | P1 |`,
    `| **Owner** | executor |`,
    `| **Data** | ${new Date().toISOString().slice(0, 10)} |`,
    `| **Fonte** | shugo plan md prepare |`,
    `| **Modulos** | governance/plans/ |`,
    `| **Descricao** | ${planTitle} |`,
    `| **Correcao** | Verificar checklist no plano \`governance/plans/${planId}.md\` |`,
  ];
}

function syncToBacklog(planId: string, plan: { filePath: string; title: string }, shitennoDir: string): PrepareResult {
  try {
    const { active: backlogPath } = resolveBacklogPaths(shitennoDir);
    if (!existsSync(backlogPath)) return { step: "backlog_sync", status: "skip", detail: "Backlog not found" };

    let backlog = readFileSync(backlogPath, "utf-8");
    const planIdUpper = `BACKLOG-${planId.toUpperCase().replace(/-/g, "_")}`;
    const planContent = readFileSync(plan.filePath, "utf-8");

    if (backlog.includes(planIdUpper)) {
      return { step: "backlog_sync", status: "skip", detail: `Item ${planIdUpper} already in backlog` };
    }

    const statusMatch = planContent.match(/\*\*Status:\*\*\s*(.+)/);
    const planStatus = statusMatch?.[1]?.trim() ?? "In Progress";
    const statusMap: Record<string, string> = { "In Progress": "em implementação", "Done": "concluído", "Paused": "pausado", "Pending": "planeado" };
    const backlogStatus = statusMap[planStatus] || "planeado";
    const checklistItems = extractChecklistItems(planContent);
    const p2Index = backlog.indexOf("## P2 —");
    const p1Index = backlog.indexOf("## P1 —");
    const insertBefore = p2Index !== -1 ? p2Index : p1Index !== -1 ? p1Index : backlog.length;

    const backlogItem = [...buildBacklogTable(planIdUpper, plan.title, planId, backlogStatus)];
    if (checklistItems.length > 0) {
      backlogItem.push(...buildChecklistSection(checklistItems));
    }
    backlogItem.push("");

    const lines = backlog.split("\n");
    lines.splice(insertBefore, 0, ...backlogItem);
    backlog = lines.join("\n").replace(/> \*\*Última actualização:\*\*.*/, `> **Última actualização:** ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(backlogPath, backlog, "utf-8");
    return { step: "backlog_sync", status: "done", detail: checklistItems.length > 0 ? `Added ${planIdUpper} with ${checklistItems.length} steps` : `Added ${planIdUpper} (no steps)` };
  } catch (error) { return { step: "backlog_sync", status: "error", detail: String(error) }; }
}

export async function runPrepare(
  _projectRoot: string,
  shitennoDir: string,
  planId: string
): Promise<PrepareResult[]> {
  const results: PrepareResult[] = [];
  const engine = new MarkdownPlanEngine(shitennoDir);
  const plan = engine.getById(planId);
  if (!plan) return [{ step: "prepare", status: "error", detail: `Plan not found: ${planId}` }];

  results.push(ensureFormatHeader(plan));
  results.push(...validateFormat(shitennoDir, planId, plan));
  results.push(ensureChecklist(plan));
  results.push(syncToBacklog(planId, plan, shitennoDir));

  getEventBus().publish("user.notification", { title: "📋 Plano Preparado", message: plan.title, priority: "low" });
  results.push({ step: "notify", status: "done", detail: "Notification dispatched via event bus" });

  return results;
}

// ── Command ────────────────────────────────────────────────────────────────

export function planCommand(): Command {
  const cmd = new Command("plan")
    .description("Manage coordinated action sequences (plans)")
    .option("-d, --dir <path>", "Project directory");

  registerMdList(cmd);
  registerMdShow(cmd);
  registerMdStatus(cmd);
  registerMdDone(cmd);
  registerMdCreate(cmd);
  registerMdPrepare(cmd);
  registerMdLifecycle(cmd);

  return cmd;
}
