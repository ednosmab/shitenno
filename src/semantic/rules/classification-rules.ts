/**
 * classification-rules.ts — Classification Rules for Semantic Signal Classification
 *
 * Maps raw event signals to semantic domains using pattern matching.
 * Rules are evaluated in priority order; first match wins.
 *
 * PRINCIPLE: Rules are deterministic and auditable — every classification
 * can be traced back to a specific rule and its evidence.
 */

import type { ClassificationRule } from "../taxonomy.js";

// ── Rule Definitions ────────────────────────────────────────────────────────

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ── Persistence ─────────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(pg|mysql|sqlite|typeorm|prisma|drizzle|knex|sequelize|mongoose|mongodb)\b/i,
    domain: "persistence",
    subdomain: "database-driver",
    priority: 100,
    confidenceBoost: 0.9,
    description: "Database driver or ORM dependency added",
  },
  {
    signal: "file.created",
    match: /(?:migrations?\/|\.migration\.|migrate)/i,
    domain: "persistence",
    subdomain: "schema-migration",
    priority: 90,
    confidenceBoost: 0.85,
    description: "Migration file created",
  },
  {
    signal: "config.changed",
    match: /(?:DATABASE_URL|DB_HOST|DB_PORT|DB_NAME|CONNECTION_STRING|REDIS_URL)/i,
    domain: "persistence",
    subdomain: "connection-config",
    priority: 95,
    confidenceBoost: 0.9,
    description: "Database connection configuration changed",
  },
  {
    signal: "file.modified",
    match: /(?:src\/db\/|src\/repositories\/|src\/models\/|src\/entities\/)/i,
    domain: "persistence",
    subdomain: "data-access",
    priority: 80,
    confidenceBoost: 0.7,
    description: "Data access layer file modified",
  },
  {
    signal: "file.created",
    match: /(?:src\/db\/|src\/repositories\/|src\/models\/|src\/entities\/)/i,
    domain: "persistence",
    subdomain: "data-access",
    priority: 85,
    confidenceBoost: 0.75,
    description: "Data access layer file created",
  },

  // ── Authentication ──────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(passport|jsonwebtoken|bcrypt|oauth|argon2|jose|iron-session)\b/i,
    domain: "authentication",
    subdomain: "auth-library",
    priority: 100,
    confidenceBoost: 0.9,
    description: "Authentication library dependency added",
  },
  {
    signal: "file.created",
    match: /(?:src\/auth\/|src\/middleware\/auth|.*\.auth\.(?:ts|js))/i,
    domain: "authentication",
    subdomain: "auth-middleware",
    priority: 90,
    confidenceBoost: 0.85,
    description: "Authentication middleware or module created",
  },
  {
    signal: "file.modified",
    match: /(?:src\/auth\/|src\/middleware\/auth|.*\.auth\.(?:ts|js))/i,
    domain: "authentication",
    subdomain: "auth-middleware",
    priority: 85,
    confidenceBoost: 0.8,
    description: "Authentication module modified",
  },

  // ── Security ────────────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(helmet|cors|rate-limit|csrf|xss-clean|express-validator|zod)\b/i,
    domain: "security",
    subdomain: "security-library",
    priority: 100,
    confidenceBoost: 0.85,
    description: "Security library dependency added",
  },
  {
    signal: "config.changed",
    match: /(?:JWT_SECRET|API_KEY|SECRET|ENCRYPTION_KEY|SECURITY_TOKEN)/i,
    domain: "security",
    subdomain: "secret-config",
    priority: 100,
    confidenceBoost: 0.95,
    description: "Security secret or key configuration changed",
  },
  {
    signal: "file.created",
    match: /(?:src\/security\/|.*\.security\.(?:ts|js)|.*\.test\.security\.)/i,
    domain: "security",
    subdomain: "security-test",
    priority: 90,
    confidenceBoost: 0.8,
    description: "Security test or module created",
  },

  // ── Infrastructure ──────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(docker|kubernetes|terraform|aws-sdk|@aws-sdk|@google-cloud|@azure)\b/i,
    domain: "infrastructure",
    subdomain: "infra-tool",
    priority: 100,
    confidenceBoost: 0.85,
    description: "Infrastructure tool dependency added",
  },
  {
    signal: "file.created",
    match: /(?:Dockerfile|docker-compose|\.github\/workflows\/|\.gitlab-ci|Jenkinsfile)/i,
    domain: "infrastructure",
    subdomain: "deploy-config",
    priority: 95,
    confidenceBoost: 0.9,
    description: "Deployment configuration file created",
  },
  {
    signal: "file.created",
    match: /(?:\.github\/|\.gitlab-ci|vercel\.json|netlify\.toml|fly\.toml)/i,
    domain: "infrastructure",
    subdomain: "ci-cd",
    priority: 90,
    confidenceBoost: 0.85,
    description: "CI/CD configuration file created",
  },

  // ── API ──────────────────────────────────────────────────────────────────
  {
    signal: "file.created",
    match: /(?:src\/routes\/|src\/controllers\/|src\/endpoints\/|src\/api\/)/i,
    domain: "api",
    subdomain: "api-endpoint",
    priority: 90,
    confidenceBoost: 0.8,
    description: "API endpoint or route file created",
  },
  {
    signal: "file.created",
    match: /(?:src\/contracts\/|.*\.schema\.ts|.*\.types\.ts|openapi|swagger)/i,
    domain: "api",
    subdomain: "api-contract",
    priority: 85,
    confidenceBoost: 0.75,
    description: "API contract or schema file created",
  },
  {
    signal: "file.modified",
    match: /(?:src\/routes\/|src\/controllers\/|src\/endpoints\/)/i,
    domain: "api",
    subdomain: "api-endpoint",
    priority: 80,
    confidenceBoost: 0.7,
    description: "API endpoint file modified",
  },

  // ── Frontend ────────────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(react|vue|angular|svelte|next|nuxt|remix|solid-js)\b/i,
    domain: "frontend",
    subdomain: "ui-component",
    priority: 100,
    confidenceBoost: 0.85,
    description: "Frontend framework dependency added",
  },
  {
    signal: "file.created",
    match: /(?:src\/components\/|src\/pages\/|src\/views\/|src\/screens\/)/i,
    domain: "frontend",
    subdomain: "ui-component",
    priority: 85,
    confidenceBoost: 0.75,
    description: "UI component file created",
  },
  {
    signal: "file.created",
    match: /(?:src\/styles\/|src\/css\/|\.module\.css|\.module\.scss)/i,
    domain: "frontend",
    subdomain: "style-system",
    priority: 80,
    confidenceBoost: 0.7,
    description: "Style file created",
  },

  // ── Testing ─────────────────────────────────────────────────────────────
  {
    signal: "dependency.added",
    match: /\b(jest|vitest|mocha|chai|cypress|playwright|testing-library)\b/i,
    domain: "testing",
    subdomain: "test-framework",
    priority: 100,
    confidenceBoost: 0.9,
    description: "Testing framework dependency added",
  },
  {
    signal: "file.created",
    match: /(?:\.test\.(?:ts|tsx|js|jsx)|\.spec\.(?:ts|tsx|js|jsx)|__tests__\/)/i,
    domain: "testing",
    subdomain: "test-file",
    priority: 90,
    confidenceBoost: 0.85,
    description: "Test file created",
  },
  {
    signal: "test.passed",
    match: /.*/i,
    domain: "testing",
    subdomain: "test-file",
    priority: 50,
    confidenceBoost: 0.5,
    description: "Test passed",
  },
  {
    signal: "test.failed",
    match: /.*/i,
    domain: "testing",
    subdomain: "test-file",
    priority: 50,
    confidenceBoost: 0.5,
    description: "Test failed",
  },

  // ── Documentation ───────────────────────────────────────────────────────
  {
    signal: "file.created",
    match: /(?:\.md$|readme|changelog|CONTRIBUTING)/i,
    domain: "documentation",
    subdomain: "doc-file",
    priority: 80,
    confidenceBoost: 0.7,
    description: "Documentation file created",
  },
  {
    signal: "adr.created",
    match: /.*/i,
    domain: "documentation",
    subdomain: "adr",
    priority: 100,
    confidenceBoost: 0.95,
    description: "Architecture Decision Record created",
  },
  {
    signal: "file.created",
    match: /(?:docs\/|doc\/)/i,
    domain: "documentation",
    subdomain: "doc-file",
    priority: 75,
    confidenceBoost: 0.65,
    description: "Documentation directory file created",
  },

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
