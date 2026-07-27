import type { ClassificationRule } from "../taxonomy.js";

export const GOVERNANCE_DATA_RULES: ClassificationRule[] = [
  // ── Governance ──────────────────────────────────────────────────────────
  {
    signal: "capability.installed",
    match: /.*/i,
    domain: "governance",
    subdomain: "capability-config",
    priority: 100,
    confidenceBoost: 0.9,
    description: "Governance capability installed",
  },
  {
    signal: "maturity.changed",
    match: /.*/i,
    domain: "governance",
    subdomain: "maturity-config",
    priority: 90,
    confidenceBoost: 0.85,
    description: "Maturity level changed",
  },
  {
    signal: "plan.status_changed",
    match: /.*/i,
    domain: "governance",
    subdomain: "workflow-config",
    priority: 85,
    confidenceBoost: 0.8,
    description: "Plan status changed",
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    signal: "file.created",
    match: /(?:src\/schemas\/|src\/types\/|.*\.schema\.(?:ts|js|json))/i,
    domain: "data",
    subdomain: "schema",
    priority: 90,
    confidenceBoost: 0.8,
    description: "Schema or type definition file created",
  },
  {
    signal: "dependency.added",
    match: /\b(zod|yup|joi|superstruct|valibot|typebox)\b/i,
    domain: "data",
    subdomain: "validation",
    priority: 95,
    confidenceBoost: 0.85,
    description: "Validation library dependency added",
  },

  // ── Performance ─────────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(redis|ioredis|memcached|lru-cache|compression|sharp)\b/i,
    domain: "performance",
    subdomain: "caching",
    priority: 95,
    confidenceBoost: 0.85,
    description: "Performance library dependency added",
  },
  {
    signal: "file.created",
    match: /(?:src\/cache\/|.*\.cache\.(?:ts|js)|.*perf.*\.(?:ts|js))/i,
    domain: "performance",
    subdomain: "caching",
    priority: 85,
    confidenceBoost: 0.75,
    description: "Performance-related file created",
  },

  // ── Observability ───────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(winston|pino|bunyan|sentry|datadog|opentelemetry|prometheus)\b/i,
    domain: "observability",
    subdomain: "logging",
    priority: 95,
    confidenceBoost: 0.85,
    description: "Observability library dependency added",
  },
  {
    signal: "file.created",
    match: /(?:src\/logging\/|src\/telemetry\/|.*\.logger\.(?:ts|js))/i,
    domain: "observability",
    subdomain: "logging",
    priority: 85,
    confidenceBoost: 0.75,
    description: "Logging or telemetry file created",
  },
];
