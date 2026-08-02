/**
 * plan-format-validator.ts — Plan Format Validation
 *
 * Validates plan markdown files against the standard template format.
 * Reports errors and warnings with actionable messages.
 *
 * PRINCIPLE: Users must know when their plan format is incompatible.
 */

import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { logger } from "./logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlanFormatError {
  rule: string;
  message: string;
  line?: number;
  fix?: string;
}

export interface PlanFormatResult {
  valid: boolean;
  errors: PlanFormatError[];
  warnings: PlanFormatError[];
}

// ── Rules ────────────────────────────────────────────────────────────────────

const HEADER_STATUS = "MISSING_STATUS";
const HEADER_DATE = "MISSING_DATE";
const HEADER_UPDATED = "MISSING_UPDATED";
const NO_STEPS = "NO_STEPS_FOUND";
const INVALID_STEP_FORMAT = "INVALID_STEP_FORMAT";
const SINGLE_STEP = "SINGLE_STEP";
const NO_CONTEXT_SECTION = "NO_CONTEXT_SECTION";
const NO_OBJECTIVE_SECTION = "NO_OBJECTIVE_SECTION";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseYamlFrontmatter(content: string): Record<string, unknown> | null {
  const yamlBlockMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (yamlBlockMatch && yamlBlockMatch[1]) {
    try {
      const parsed = parseYaml(yamlBlockMatch[1]);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      logger.debug("plan-format-validator", "Malformed YAML block — treating as absent");
    }
  }
  return null;
}

function checkStatusField(
  lines: string[],
  yamlFields: Record<string, unknown> | null,
  errors: PlanFormatError[]
): void {
  const hasStatus = yamlFields ? "status" in yamlFields : lines.some((l) => l.match(/^\*\*Status:\*\*/));
  if (!hasStatus) {
    const titleLine = lines.findIndex((l) => l.startsWith("# "));
    errors.push({
      rule: HEADER_STATUS,
      message: "Campo **Status:** em falta no header do plano",
      line: titleLine !== -1 ? titleLine + 3 : undefined,
      fix: yamlFields !== null
        ? "Adicionar 'status: Pending' ao bloco YAML no topo do arquivo"
        : "Adicionar '**Status:** Pending' após o título",
    });
  }
}

function checkDateField(
  lines: string[],
  yamlFields: Record<string, unknown> | null,
  errors: PlanFormatError[]
): void {
  const hasDate = yamlFields ? "date" in yamlFields : lines.some((l) => l.match(/^\*\*Date:\*\*/));
  if (!hasDate) {
    errors.push({
      rule: HEADER_DATE,
      message: "Campo **Date:** em falta no header do plano",
      fix: yamlFields !== null
        ? "Adicionar 'date: YYYY-MM-DD' ao bloco YAML"
        : "Adicionar '**Date:** YYYY-MM-DD' após o campo Status",
    });
  }
}

function checkUpdatedField(
  lines: string[],
  yamlFields: Record<string, unknown> | null,
  warnings: PlanFormatError[]
): void {
  const hasUpdated = yamlFields ? "updated_at" in yamlFields : lines.some((l) => l.match(/^\*\*Updated_at:\*\*/));
  if (!hasUpdated) {
    warnings.push({
      rule: HEADER_UPDATED,
      message: "Campo **Updated_at:** em falta no header do plano",
      fix: yamlFields !== null
        ? "Adicionar 'updated_at: YYYY-MM-DDTHH:MM:SS.000Z' ao bloco YAML"
        : "Adicionar '**Updated_at:** YYYY-MM-DDTHH:MM:SS.000Z'",
    });
  }
}

function checkSteps(content: string, warnings: PlanFormatError[]): void {
  const stepHeadings = extractStepHeadings(content);
  if (stepHeadings.length === 0) {
    warnings.push({
      rule: NO_STEPS,
      message:
        "Nenhum passo encontrado (### Passo X, ### Step X, ### Phase X). " +
        "O BACKLOG será criado só com metadados — sem lista de passos.",
      fix: "Adicionar secção '## Passos de Implementação' com headings ### Passo X: Title",
    });
    return;
  }
  for (const step of stepHeadings) {
    if (!step.valid) {
      warnings.push({
        rule: INVALID_STEP_FORMAT,
        message: `Passo com formato inválido: "${step.raw}"`,
        line: step.line,
        fix: `Usar formato "### Passo ${step.number}: Title" ou "### Passo ${step.number} — Title"`,
      });
    }
  }
  if (stepHeadings.length === 1) {
    warnings.push({
      rule: SINGLE_STEP,
      message: "Plano tem apenas 1 passo — considere adicionar mais passos",
    });
  }
}

function checkSections(lines: string[], warnings: PlanFormatError[]): void {
  const hasContext = lines.some((l) =>
    l.match(/^##\s+(Contexto|Context|Contexto geral)/i)
  );
  if (!hasContext) {
    warnings.push({
      rule: NO_CONTEXT_SECTION,
      message: "Secção '## Contexto' não encontrada",
      fix: "Adicionar secção '## Contexto' com descrição do problema",
    });
  }
  const hasObjective = lines.some((l) =>
    l.match(/^##\s+(Objetivo|Objective|Goal|Resultado)/i)
  );
  if (!hasObjective) {
    warnings.push({
      rule: NO_OBJECTIVE_SECTION,
      message: "Secção '## Objetivo' não encontrada",
      fix: "Adicionar secção '## Objetivo' com critérios de aceitação",
    });
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validatePlanFormat(
  filePath: string,
  content: string
): PlanFormatResult {
  const errors: PlanFormatError[] = [];
  const warnings: PlanFormatError[] = [];
  const lines = content.split("\n");

  const fileName = basename(filePath);
  if (fileName === "TEMPLATE.md" || fileName === "README.md") {
    return { valid: true, errors: [], warnings: [] };
  }

  const yamlFields = parseYamlFrontmatter(content);

  checkStatusField(lines, yamlFields, errors);
  checkDateField(lines, yamlFields, errors);
  checkUpdatedField(lines, yamlFields, warnings);
  checkSteps(content, warnings);
  checkSections(lines, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Step Extraction ──────────────────────────────────────────────────────────

export interface ExtractedStep {
  number: string;
  title: string;
  raw: string;
  valid: boolean;
  line: number;
}

/**
 * Extract step headings from plan content.
 * Supports: ### Passo X: Title, ### Passo X — Title, ### Step X: Title, ### Phase X: Title
 */
export function extractStepHeadings(content: string): ExtractedStep[] {
  const steps: ExtractedStep[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Match both ## Phase X (H2) and ### Passo/Step/Phase X (H3)
    const match = line.match(
      /^(#{2,3}) (?:Passo|Step|Phase)\s+(\d+[\.\d]*)\s*[:\u2014—]\s*(.+)$/
    );

    if (match?.[2] && match?.[3]) {
      steps.push({
        number: match[2],
        title: match[3].trim(),
        raw: line.trim(),
        valid: true,
        line: i + 1,
      });
    } else {
      // Check for malformed step headings (## or ###)
      const malformed = line.match(
        /^(#{2,3}) (?:Passo|Step|Phase)\s*(.*)$/i
      );
      if (malformed?.[2]) {
        steps.push({
          number: "?",
          title: malformed[2],
          raw: line.trim(),
          valid: false,
          line: i + 1,
        });
      }
    }
  }

  return steps;
}

/**
 * Extract checklist items from plan content.
 * Extracts only checkbox items (- [ ] / - [x]).
 * Step headings are extracted separately via extractStepHeadings().
 */
export function extractChecklistItems(
  content: string
): Array<{ text: string; checked: boolean; phase: string }> {
  const items: Array<{ text: string; checked: boolean; phase: string }> = [];
  const lines = content.split("\n");
  let currentPhase = "General";

  for (const line of lines) {
    // Track phase from headings
    if (line.startsWith("### ")) {
      currentPhase = line.replace("### ", "").trim();
    }

    // Extract checkbox items only
    const uncheckedMatch = line.match(/^- \[ \]\s*(.+)$/);
    const checkedMatch = line.match(/^- \[x\]\s*(.+)$/);

    if (uncheckedMatch?.[1]) {
      items.push({ text: uncheckedMatch[1], checked: false, phase: currentPhase });
    } else if (checkedMatch?.[1]) {
      items.push({ text: checkedMatch[1], checked: true, phase: currentPhase });
    }
  }

  return items;
}
