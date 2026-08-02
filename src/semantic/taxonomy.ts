/**
 * taxonomy.ts — Semantic Taxonomy for Event Classification
 *
 * Defines the semantic domains, subdomains, and classification types
 * used by the Signal Classifier to categorize raw events into
 * meaningful architectural and operational categories.
 *
 * PRINCIPLE: Structured knowledge, not LLMs — deterministic, auditable, controllable.
 */

// ── Semantic Domains ────────────────────────────────────────────────────────

export type SemanticDomain =
  | "persistence"
  | "authentication"
  | "api"
  | "security"
  | "infrastructure"
  | "frontend"
  | "testing"
  | "documentation"
  | "governance"
  | "data"
  | "performance"
  | "observability";

// ── Subdomains ──────────────────────────────────────────────────────────────

export type SubdomainMap = Record<SemanticDomain, string[]>;

export const SUBDOMAINS: SubdomainMap = {
  persistence: ["database-driver", "schema-migration", "connection-config", "data-access", "orm", "cache-layer"],
  authentication: ["auth-library", "auth-middleware", "session-management", "token-handling", "oauth"],
  api: ["api-endpoint", "api-contract", "api-middleware", "api-versioning", "graphql", "websocket"],
  security: ["security-library", "security-test", "secret-config", "vulnerability-scan", "compliance", "encryption"],
  infrastructure: ["infra-tool", "deploy-config", "ci-cd", "container", "cloud-service", "monitoring-setup"],
  frontend: ["ui-component", "style-system", "state-management", "routing", "animation", "accessibility"],
  testing: ["test-framework", "test-file", "mock", "coverage-config", "e2e-test", "snapshot"],
  documentation: ["doc-file", "adr", "guide", "api-doc", "changelog", "readme"],
  governance: ["rule-file", "workflow-config", "policy", "capability-config", "maturity-config"],
  data: ["schema", "model", "migration", "validation", "transform", "seed"],
  performance: ["caching", "optimization", "profiling", "lazy-loading", "bundle-optimization"],
  observability: ["logging", "monitoring", "tracing", "metrics", "alerting"],
};

// ── Signal Types ────────────────────────────────────────────────────────────

export type SignalType =
  | "dependency.added"
  | "dependency.removed"
  | "file.created"
  | "file.modified"
  | "file.deleted"
  | "config.changed"
  | "test.created"
  | "test.passed"
  | "test.failed"
  | "health.checked"
  | "health.degraded"
  | "git.branch_changed"
  | "git.ref_updated"
  | "source.changed"
  | "maturity.changed"
  | "capability.installed"
  | "knowledge_debt.detected"
  | "challenge.generated"
  | "plan.status_changed"
  | "adr.created"
  | "session.end"
  | "session.start";

// ── Classification Result ───────────────────────────────────────────────────

export interface SemanticClassification {
  /** Primary semantic domain */
  domain: SemanticDomain;
  /** Specific subdomain within the domain */
  subdomain: string;
  /** Classification confidence (0-1) */
  confidence: number;
  /** Evidence strings that justify this classification */
  evidence: string[];
  /** Raw signal types that contributed to this classification */
  signals: SignalType[];
  /** Optional secondary domain if signal is ambiguous */
  secondaryDomain?: SemanticDomain;
}

// ── Classification Rule ─────────────────────────────────────────────────────

export interface ClassificationRule {
  /** Signal type this rule applies to */
  signal: SignalType | "*";
  /** Regex pattern to match against payload values */
  match: RegExp;
  /** Target semantic domain */
  domain: SemanticDomain;
  /** Target subdomain */
  subdomain: string;
  /** Rule priority (higher = checked first) */
  priority: number;
  /** Confidence boost when matched (0-1) */
  confidenceBoost: number;
  /** Human-readable description */
  description: string;
}

// ── Domain Metadata ─────────────────────────────────────────────────────────

export interface DomainInfo {
  domain: SemanticDomain;
  label: string;
  description: string;
  keywords: string[];
  riskWeight: number;
}

export const DOMAIN_INFO: Record<SemanticDomain, DomainInfo> = {
  persistence: {
    domain: "persistence",
    label: "Persistência",
    description: "Banco de dados, migrations, ORM, connection strings",
    keywords: ["pg", "mysql", "sqlite", "typeorm", "prisma", "drizzle", "database", "migration", "schema"],
    riskWeight: 0.9,
  },
  authentication: {
    domain: "authentication",
    label: "Autenticação",
    description: "Auth, tokens, sessões, OAuth, JWT",
    keywords: ["passport", "jsonwebtoken", "bcrypt", "oauth", "jwt", "auth", "session", "token"],
    riskWeight: 0.95,
  },
  api: {
    domain: "api",
    label: "API",
    description: "Endpoints, contratos, middlewares, versionamento",
    keywords: ["router", "endpoint", "controller", "route", "openapi", "swagger", "graphql"],
    riskWeight: 0.7,
  },
  security: {
    domain: "security",
    label: "Segurança",
    description: "Segurança, vulnerabilities, compliance, secrets",
    keywords: ["helmet", "cors", "rate-limit", "csrf", "xss", "vulnerability", "secret", "encrypt"],
    riskWeight: 1.0,
  },
  infrastructure: {
    domain: "infrastructure",
    label: "Infraestrutura",
    description: "Deploy, CI/CD, containers, cloud",
    keywords: ["docker", "kubernetes", "terraform", "aws", "deploy", "ci", "cd", "container"],
    riskWeight: 0.8,
  },
  frontend: {
    domain: "frontend",
    label: "Frontend",
    description: "UI, componentes, estilos, state management",
    keywords: ["react", "vue", "angular", "component", "css", "style", "ui", "dom"],
    riskWeight: 0.5,
  },
  testing: {
    domain: "testing",
    label: "Testes",
    description: "Testes, coverage, mocks, e2e",
    keywords: ["jest", "vitest", "mocha", "cypress", "playwright", "test", "spec", "mock", "coverage"],
    riskWeight: 0.3,
  },
  documentation: {
    domain: "documentation",
    label: "Documentação",
    description: "Docs, ADRs, guides, changelogs",
    keywords: ["readme", "adr", "guide", "changelog", "docs", "documentation", "markdown"],
    riskWeight: 0.2,
  },
  governance: {
    domain: "governance",
    label: "Governança",
    description: "Regras, workflows, políticas, capacidades",
    keywords: ["rule", "policy", "workflow", "governance", "capability", "maturity", "shitenno"], // eslint-disable-line no-restricted-syntax -- keyword, not directory name
    riskWeight: 0.4,
  },
  data: {
    domain: "data",
    label: "Dados",
    description: "Schemas, modelos, validação, transformação",
    keywords: ["schema", "model", "validate", "transform", "zod", "yup", "joi"],
    riskWeight: 0.6,
  },
  performance: {
    domain: "performance",
    label: "Performance",
    description: "Caching, optimização, profiling, bundles",
    keywords: ["cache", "lazy", "optimize", "profile", "bundle", "compress", "minify"],
    riskWeight: 0.5,
  },
  observability: {
    domain: "observability",
    label: "Observabilidade",
    description: "Logging, monitoring, tracing, métricas",
    keywords: ["log", "monitor", "trace", "metric", "alert", "sentry", "datadog"],
    riskWeight: 0.4,
  },
};
