/**
 * Audit module — Observability detectors
 *
 * Detectors that validate tracing, structured logging,
 * alerting, metrics, dashboards, and SLO definitions.
 * All analysis is deterministic — no LLM calls, no external APIs.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 21.1 Missing Tracing ────────────────────────────────────────────────────

export function detectMissingTracing(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const tracingPatterns = [
    /opentelemetry|otel|@opentelemetry/i,
    /jaeger|zipkin|datadog.*trace/i,
    /trace\(|span\(|startSpan|endSpan/i,
    /TracerProvider|TraceProvider/i,
  ];

  const hasTracing = files.some((f) =>
    tracingPatterns.some((p) => p.test(f.content)),
  );

  if (!hasTracing && files.length > 5) {
    issues.push({
      type: "missing_tracing",
      severity: 2,
      description: "Nenhum padrão de distributed tracing detectado no código",
      location: "project root",
      recommendation: "Implementar OpenTelemetry ou sistema de tracing equivalente para observabilidade em produção.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 21.2 Log Structure ──────────────────────────────────────────────────────

export function detectLogStructure(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const structuredLoggers = [
    /winston|pino|bunyan|log4js|loglevel/i,
    /createLogger|LoggerFactory|getLogger/i,
    /logger\.(info|warn|error|debug)\s*\(/i,
  ];

  const consoleLogPattern = /console\.(log|warn|error|info)\s*\(/g;

  let consoleLogCount = 0;
  let structuredLogCount = 0;

  for (const file of files) {
    const consoleMatches = file.content.match(consoleLogPattern);
    if (consoleMatches) consoleLogCount += consoleMatches.length;

    const hasStructured = structuredLoggers.some((p) => p.test(file.content));
    if (hasStructured) structuredLogCount++;
  }

  if (consoleLogCount > 20 && structuredLogCount === 0) {
    issues.push({
      type: "unstructured_logs",
      severity: 2,
      description: `${consoleLogCount} chamadas a console.log detectadas sem logger estruturado`,
      location: "source files",
      recommendation: "Substituir console.log por logger estruturado (winston, pino, bunyan) com levels, timestamps e contexto.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 21.3 Alert Coverage ─────────────────────────────────────────────────────

export function detectAlertCoverage(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const alertPaths = [
    join(projectRoot, "alerts"),
    join(projectRoot, "monitoring", "alerts"),
    join(projectRoot, "deploy", "alerts"),
    join(projectRoot, ".github", "workflows"),
    join(projectRoot, "prometheus.yml"),
    join(projectRoot, "alertmanager.yml"),
  ];

  const hasAlerts = alertPaths.some((p) => existsSync(p));

  if (!hasAlerts) {
    issues.push({
      type: "missing_alerts",
      severity: 2,
      description: "Nenhuma configuração de alertas encontrada",
      location: "project root",
      recommendation: "Configurar alertas para métricas críticas (CPU, memória, latência, erro rate).",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 21.4 Metric Endpoints ───────────────────────────────────────────────────

export function detectMetricEndpoints(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const metricPatterns = [
    /\/metrics|prometheus|collectDefaultMetrics/i,
    /prom-client|prometheus.*client/i,
    /MetricsEndpoint|metricsHandler/i,
  ];

  const hasMetrics = files.some((f) =>
    metricPatterns.some((p) => p.test(f.content)),
  );

  if (!hasMetrics && files.length > 5) {
    issues.push({
      type: "missing_metrics",
      severity: 2,
      description: "Nenhum endpoint de métricas detectado",
      location: "project root",
      recommendation: "Expor métricas via /metrics endpoint usando prom-client ou biblioteca equivalente.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 21.5 Missing Dashboard ──────────────────────────────────────────────────

export function detectMissingDashboard(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const dashboardPaths = [
    join(projectRoot, "dashboards"),
    join(projectRoot, "monitoring", "dashboards"),
    join(projectRoot, "grafana"),
    join(projectRoot, "grafana.json"),
  ];

  const hasDashboards = dashboardPaths.some((p) => existsSync(p));

  if (!hasDashboards) {
    issues.push({
      type: "missing_dashboard",
      severity: 1,
      description: "Nenhum dashboard de monitoramento encontrado",
      location: "project root",
      recommendation: "Criar dashboards para visualização de métricas de negócio e operacionais.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 21.6 Log Retention ──────────────────────────────────────────────────────

export function detectLogRetention(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const retentionPatterns = [
    /retention|retentionDays|retention_days/i,
    /expire|ttl|maxAge|max_age/i,
    /rotate|rotation|logrotate/i,
  ];

  const configFiles = files.filter(
    (f) => f.basename.includes("config") || f.basename.includes("docker") || f.basename.endsWith(".yml"),
  );

  const hasRetention = configFiles.some((f) =>
    retentionPatterns.some((p) => p.test(f.content)),
  );

  if (!hasRetention && files.length > 10) {
    issues.push({
      type: "missing_log_retention",
      severity: 1,
      description: "Nenhuma política de retenção de logs configurada",
      location: "config files",
      recommendation: "Definir política de retenção de logs para compliance e gestão de espaço.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 21.7 Distributed Logging ────────────────────────────────────────────────

export function detectDistributedLogging(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const correlationPatterns = [
    /correlationId|correlation_id|correlation-id/i,
    /requestId|request_id|request-id/i,
    /traceId|trace_id|trace-id/i,
    /x-request-id|x-correlation-id/i,
  ];

  const hasCorrelation = files.some((f) =>
    correlationPatterns.some((p) => p.test(f.content)),
  );

  if (!hasCorrelation && files.length > 10) {
    issues.push({
      type: "missing_correlation_id",
      severity: 1,
      description: "Nenhum padrão de correlation ID detectado nos logs",
      location: "source files",
      recommendation: "Implementar correlation IDs para rastreamento de requisições entre serviços.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 21.8 SLO Definitions ────────────────────────────────────────────────────

export function detectSLODefinitions(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sloPaths = [
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "SLO.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "SLI.md"),
    join(projectRoot, "docs", "SLO.md"),
    join(projectRoot, "docs", "SLI.md"),
    join(projectRoot, "slo.yml"),
    join(projectRoot, "slo.json"),
  ];

  const hasSLO = sloPaths.some((p) => existsSync(p));

  if (!hasSLO) {
    issues.push({
      type: "missing_slo",
      severity: 1,
      description: "Nenhum SLO/SLI documentado encontrado",
      location: "project root",
      recommendation: "Definir Service Level Objectives e Indicadores para serviços críticos.",
      confidence: 0.95,
    });
  }

  return issues;
}
