import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";

const VALID_BACKLOG_STATES = new Set([
  "Backlog", "In Progress", "Paused", "Done",
  "planeado", "em investigação", "em implementação", "em validação",
  "concluído", "encerrado", "pausado", "adiado",
]);

export function detectInvalidBacklogStates(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
  if (!existsSync(backlogPath)) return issues;

  try {
    const content = readFileSync(backlogPath, "utf-8");
    const statusRegex = /\*\*Status\*\*\s*\|\s*([A-Za-zÀ-ú\s]+)\|/g;
    let match;
    const invalidStates: string[] = [];

    while ((match = statusRegex.exec(content)) !== null) {
      const state = (match[1] ?? "").trim();
      if (state && !VALID_BACKLOG_STATES.has(state)) {
        invalidStates.push(state);
      }
    }

    if (invalidStates.length > 0) {
      issues.push({
        type: "invalid_backlog_state",
        severity: 2,
        description: `${invalidStates.length} estado(s) inválido(s) no BACKLOG.md: ${[...new Set(invalidStates)].join(", ")}`,
        location: "shitenno/docs/backlog/ACTIVE.md",
        recommendation: `Estados válidos: ${[...VALID_BACKLOG_STATES].join(", ")}. Actualizar para um dos estados permitidos.`,
        confidence: 0.65,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to parse BACKLOG.md");
  }

  return issues;
}

export function detectPlanFormat(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return issues;

  try {
    const files = readdirSync(plansDir).filter((f) => f.endsWith(".md") && !f.startsWith("TEMPLATE"));
    for (const file of files) {
      const path = join(plansDir, file);
      const content = readFileSync(path, "utf-8");
      const hasCheckboxes = /^\s*-\s*\[[ x]\]\s*/m.test(content);
      const hasStatusField = /^\*\*Status:\*\*/m.test(content) || /^Status:\s*/m.test(content);

      if (hasCheckboxes && !hasStatusField) {
        issues.push({
          type: "plan_format_violation",
          severity: 1,
          description: `Plano "${file}" usa checkboxes em vez de campo "Status:" —.Workflow.md requer campo Status`,
          location: `shitenno/governance/plans/${file}`,
          recommendation: "Substituir checkboxes por '**Status:** [em execução|concluído|pendente]'.",
          confidence: 0.65,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan plans directory");
  }

  return issues;
}

function checkPlanVerification(planId: string, file: string, doneDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const verificationPath = join(doneDir, `${planId}.verification.json`);

  if (!existsSync(verificationPath)) {
    issues.push({
      type: "done_plan_missing_verification",
      severity: 3,
      description: `Plano ${planId} está em done/ sem .verification.json — possivel bypass do pipeline de verificação`,
      location: `governance/plans/done/${file}`,
      recommendation: "Mover o plano de volta para plans/ e re-executar o fluxo check → done.",
      confidence: 0.98,
    });
    return issues;
  }

  try {
    const record = JSON.parse(readFileSync(verificationPath, "utf-8"));
    if (!record.passed) {
      issues.push({
        type: "done_plan_failed_verification",
        severity: 3,
        description: `Plano ${planId} está em done/ mas .verification.json tem passed=false — verificação falhou e plano não foi bloqueado`,
        location: `governance/plans/done/${planId}.verification.json`,
        recommendation: "Mover o plano de volta para plans/ e corrigir os checks que falharam antes de re-verificar.",
        confidence: 0.99,
      });
    }
  } catch {
    issues.push({
      type: "done_plan_missing_verification",
      severity: 2,
      description: `Plano ${planId} tem .verification.json mas o JSON é inválido`,
      location: `governance/plans/done/${planId}.verification.json`,
      recommendation: "Corrigir ou recriar o .verification.json com dados válidos.",
      confidence: 0.9,
    });
  }

  return issues;
}

function checkOrphanedSidecars(doneDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sidecars = readdirSync(doneDir).filter((f) => f.endsWith(".verification.json"));
  for (const sidecar of sidecars) {
    const planId = sidecar.replace(/\.verification\.json$/, "");
    if (!existsSync(join(doneDir, `${planId}.md`))) {
      issues.push({
        type: "done_plan_orphaned_sidecar",
        severity: 2,
        description: `.verification.json órfão para ${planId} — arquivo .md não existe em done/`,
        location: `governance/plans/done/${sidecar}`,
        recommendation: "Remover o .verification.json órfão ou restaurar o .md correspondente.",
        confidence: 0.95,
      });
    }
  }
  return issues;
}

export function detectDonePlanIntegrity(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const doneDir = join(shitennoDir, "governance", "plans", "done");
  if (!existsSync(doneDir)) return issues;

  try {
    const files = readdirSync(doneDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      issues.push(...checkPlanVerification(file.replace(/\.md$/, ""), file, doneDir));
    }
    issues.push(...checkOrphanedSidecars(doneDir));
  } catch {
    logger.debug("governance-enforcement", "Failed to scan done/ directory");
  }

  return issues;
}
