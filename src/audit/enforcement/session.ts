import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import { checkpointBuffer } from "../../governance/buffer-checkpoint.js";
import type { HealthIssue } from "../types.js";

export function detectIncompleteSessionClose(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return issues;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const activeLines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith("---")).length;

    const hasInProgress = content.includes("status: in_progress") || content.includes("status: active");
    const hasStaleBuffer = activeLines > 50;

    if (hasInProgress || hasStaleBuffer) {
      const checkpointResult = checkpointBuffer(shitennoDir);
      if (checkpointResult.success) {
        logger.debug("governance-enforcement", `Checkpoint created before buffer report: ${checkpointResult.checkpointPath}`);
      }
    }

    if (hasInProgress) {
      issues.push({
        type: "session_not_closed",
        severity: 2,
        description: "context_buffer.yaml indica sessão em curso não fechada — ritual de fim de sessão não executado",
        location: "governance/context/context_buffer.yaml",
        recommendation: "Executar 'pnpm run close:session' antes de iniciar nova sessão (AGENTS.md #12).",
        confidence: 0.7,
      });
    }

    if (hasStaleBuffer) {
      issues.push({
        type: "buffer_not_pruned",
        severity: 2,
        description: `context_buffer.yaml tem ${activeLines} linhas activas (máx: 50) — buffer não foi podado no fim de sessão`,
        location: "governance/context/context_buffer.yaml",
        recommendation: "Podar buffer no ritual de fim de sessão: remover secções obsoletas, consolidar estado.",
        confidence: 0.7,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to read context buffer");
  }

  return issues;
}

export function detectMissingFeedback(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const feedbackDir = join(shitennoDir, "feedback", "records");
  if (!existsSync(feedbackDir)) {
    issues.push({
      type: "missing_feedback_dir",
      severity: 1,
      description: "Directório feedback/records/ não existe — feedback de sessão não está a ser registado",
      location: "shitenno/feedback/records/",
      recommendation: "Criar directório e executar 'shugo feedback --outcome success' após cada sessão.",
      confidence: 0.95,
    });
    return issues;
  }

  try {
    const files = readdirSync(feedbackDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      issues.push({
        type: "no_feedback_records",
        severity: 1,
        description: "Directório feedback/records/ está vazio — nenhum registo de feedback encontrado",
        location: "shitenno/feedback/records/",
        recommendation: "Executar 'shugo feedback --outcome success' ou 'shugo feedback --outcome failure' após sessões.",
        confidence: 0.95,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan feedback directory");
  }

  return issues;
}
