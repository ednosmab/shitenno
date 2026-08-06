/**
 * Audit module — Operations detectors
 *
 * Detectors that validate CI/CD pipelines, rollback capability,
 * runbooks, monitoring, incident response, and disaster recovery.
 * All analysis is deterministic — no LLM calls, no external APIs.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 22.1 Pipeline Gaps ──────────────────────────────────────────────────────

export function detectPipelineGaps(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pipelinePaths = [
    join(projectRoot, ".github", "workflows"),
    join(projectRoot, ".gitlab-ci.yml"),
    join(projectRoot, "Jenkinsfile"),
    join(projectRoot, ".circleci"),
    join(projectRoot, "bitbucket-pipelines.yml"),
    join(projectRoot, "azure-pipelines.yml"),
    join(projectRoot, "cloudbuild.yaml"),
  ];

  const hasPipeline = pipelinePaths.some((p) => existsSync(p));

  if (!hasPipeline) {
    issues.push({
      type: "incomplete_pipeline",
      severity: 3,
      description: "Nenhum pipeline de CI/CD encontrado",
      location: "project root",
      recommendation: "Configurar pipeline de CI/CD para build, teste e deploy automatizados.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 22.2 Rollback Capability ────────────────────────────────────────────────

export function detectRollbackCapability(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const rollbackPatterns = [
    /rollback|revert|undo/i,
    /previous.*version|last.*release/i,
    /blue.*green|canary|rolling/i,
  ];

  const hasRollback = files.some((f) =>
    rollbackPatterns.some((p) => p.test(f.content)),
  );

  const rollbackFiles = [
    join(projectRoot, "scripts", "rollback.sh"),
    join(projectRoot, "scripts", "rollback.js"),
    join(projectRoot, "deploy", "rollback.sh"),
    join(projectRoot, "rollback.yml"),
  ];

  const hasRollbackFile = rollbackFiles.some((p) => existsSync(p));

  if (!hasRollback && !hasRollbackFile) {
    issues.push({
      type: "missing_rollback",
      severity: 2,
      description: "Nenhum mecanismo de rollback detectado",
      location: "project root",
      recommendation: "Implementar scripts de rollback e strategy de deploy (blue-green, canary).",
      confidence: 0.8,
    });
  }

  return issues;
}

// ── 22.3 Missing Runbooks ───────────────────────────────────────────────────

export function detectMissingRunbooks(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const runbookPaths = [
    join(projectRoot, "runbooks"),
    join(projectRoot, "docs", "runbooks"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "runbooks"),
    join(projectRoot, "docs", "RUNBOOKS.md"),
  ];

  const hasRunbooks = runbookPaths.some((p) => existsSync(p));

  if (!hasRunbooks) {
    issues.push({
      type: "missing_runbooks",
      severity: 2,
      description: "Nenhum runbook operacional encontrado",
      location: "project root",
      recommendation: "Criar runbooks para operações comuns: deploy, rollback, incident response, scaling.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 22.4 Monitoring Gaps ────────────────────────────────────────────────────

export function detectMonitoringGaps(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const monitoringPatterns = [
    /datadog|newrelic|dynatrace|appdynamics/i,
    /prometheus|grafana|thanos|mimir/i,
    /sentry|bugsnag|rollbar|logrocket/i,
  ];

  const hasMonitoring = files.some((f) =>
    monitoringPatterns.some((p) => p.test(f.content)),
  );

  if (!hasMonitoring && files.length > 10) {
    issues.push({
      type: "missing_monitoring",
      severity: 2,
      description: "Nenhuma ferramenta de monitoring detectada",
      location: "project root",
      recommendation: "Configurar monitoring para serviços críticos (Datadog, New Relic, Prometheus/Grafana).",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 22.5 Incident Response ──────────────────────────────────────────────────

export function detectIncidentResponse(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const incidentPaths = [
    join(projectRoot, "docs", "INCIDENT_RESPONSE.md"),
    join(projectRoot, "docs", "incident-response.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "INCIDENT_RESPONSE.md"),
    join(projectRoot, ".github", "ISSUE_TEMPLATE", "incident.md"),
  ];

  const hasIncidentPlan = incidentPaths.some((p) => existsSync(p));

  if (!hasIncidentPlan) {
    issues.push({
      type: "missing_incident_plan",
      severity: 2,
      description: "Nenhum plano de resposta a incidentes encontrado",
      location: "project root",
      recommendation: "Documentar processo de resposta a incidentes: detecção, contenção, resolução, post-mortem.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 22.6 Disaster Recovery ──────────────────────────────────────────────────

export function detectDisasterRecovery(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const drPaths = [
    join(projectRoot, "docs", "DISASTER_RECOVERY.md"),
    join(projectRoot, "docs", "disaster-recovery.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "DISASTER_RECOVERY.md"),
    join(projectRoot, "DR.md"),
  ];

  const hasDR = drPaths.some((p) => existsSync(p));

  if (!hasDR) {
    issues.push({
      type: "missing_dr_plan",
      severity: 1,
      description: "Nenhuma documentação de disaster recovery encontrada",
      location: "project root",
      recommendation: "Documentar plano de DR: RPO, RTO, procedimentos de recuperação, backups.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 22.7 Capacity Planning ──────────────────────────────────────────────────

export function detectCapacityPlanning(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const capacityPaths = [
    join(projectRoot, "docs", "CAPACITY_PLANNING.md"),
    join(projectRoot, "docs", "capacity-planning.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "CAPACITY_PLANNING.md"),
  ];

  const hasCapacityPlan = capacityPaths.some((p) => existsSync(p));

  if (!hasCapacityPlan) {
    issues.push({
      type: "missing_capacity_plan",
      severity: 1,
      description: "Nenhum documento de capacity planning encontrado",
      location: "project root",
      recommendation: "Documentar plano de capacidade: thresholds, scaling triggers, recursos necessários.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 22.8 Change Management ──────────────────────────────────────────────────

export function detectChangeManagement(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const changeMgmtPaths = [
    join(projectRoot, "docs", "CHANGE_MANAGEMENT.md"),
    join(projectRoot, "docs", "change-management.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "CHANGE_MANAGEMENT.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "governance", "policies", "CHANGE-POLICY.md"),
  ];

  const hasChangeMgmt = changeMgmtPaths.some((p) => existsSync(p));

  if (!hasChangeMgmt) {
    issues.push({
      type: "missing_change_mgmt",
      severity: 1,
      description: "Nenhum processo de change management documentado",
      location: "project root",
      recommendation: "Documentar processo de gestão de mudanças: aprovação, testing, rollback, comunicação.",
      confidence: 0.95,
    });
  }

  return issues;
}
