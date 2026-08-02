/**
 * Audit module — Performance & Scalability detectors
 *
 * Detectors that validate N+1 queries, caching strategies,
 * stateful services, rate limiting, and timeout configuration.
 */

import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 15.1 N+1 Query Detection ────────────────────────────────────────────────

export function detectNPlusOne(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const DB_LIKE_OBJECT_NAMES = /(?:db|database|prisma|knex|mongo|mongoose|sequelize|pool|connection|conn|client|repository|repo|orm|query(?:Builder)?)\s*\.\s*/i;
  const DB_QUERY_METHODS = /(?:find|findOne|findAll|query|findById|findMany|findFirst|execute)\s*\(/i;
  const SELECT_PATTERN = /SELECT/i;
  const loopWithQueryPattern = new RegExp(
    `(?:for|while|forEach)\\s*\\([^)]*\\)\\s*\\{[^}]*${DB_LIKE_OBJECT_NAMES.source}${DB_QUERY_METHODS.source}|(?:for|while|forEach)\\s*\\([^)]*\\)\\s*\\{[^}]*${SELECT_PATTERN.source}`,
    "g"
  );

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const matches = file.content.match(loopWithQueryPattern);
    if (matches && matches.length > 0) {
      issues.push({
        type: "n_plus_one_query",
        severity: 2,
        description: `${matches.length} padrão(ões) N+1 detectado(s) em "${file.basename}" — query dentro de loop`,
        location: file.relPath,
        recommendation: "Usar batch loading (Promise.all, IN clause) em vez de queries individuais em loops.",
        confidence: 0.65,
      });
    }
  }

  return issues;
}

// ── 15.2 Missing Caching Strategy ───────────────────────────────────────────

export function detectMissingCaching(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const cachePatterns = /cache|redis|memcached|lru|memoize|Map\(\)/i;
  const endpointPattern = /(?:app|router)\.(?:get|post|put|delete)\s*\(/g;

  let endpointCount = 0;
  let hasCaching = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const endpoints = file.content.match(endpointPattern);
    if (endpoints) endpointCount += endpoints.length;

    if (cachePatterns.test(file.content)) {
      hasCaching = true;
    }
  }

  if (endpointCount > 10 && !hasCaching) {
    issues.push({
      type: "missing_cache_strategy",
      severity: 1,
      description: `${endpointCount} endpoint(s) detectado(s) mas nenhuma estratégia de cache encontrada`,
      location: "src/",
      recommendation: "Avaliar uso de cache (Redis, LRU, memoize) para endpoints pesados.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 16.1 Stateful Services ──────────────────────────────────────────────────

export function detectStatefulServices(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const statePatterns = [
    /(?:let|var)\s+\w+\s*=\s*(?:new\s+)?(?:Map|Set|WeakMap)\(\)/g,
    /(?:let|var)\s+\w+State\s*=/g,
    /(?:let|var)\s+session(?:Store|Cache|Data)\s*=/g,
  ];

  let statefulCount = 0;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    for (const pattern of statePatterns) {
      const matches = file.content.match(pattern);
      if (matches) statefulCount += matches.length;
    }
  }

  if (statefulCount > 5) {
    issues.push({
      type: "stateful_service",
      severity: 1,
      description: `${statefulCount} variável(veis) de estado em memória detectada(s) — pode impedir scaling horizontal`,
      location: "src/",
      recommendation: "Avaliar se estado pode ser externalizado (Redis, DB) para permitir scaling horizontal.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 16.2 Missing Rate Limiting ──────────────────────────────────────────────

export function detectMissingRateLimiting(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const rateLimitPattern = /rate.?limit|throttle|RateLimiter|express-rate-limit/i;
  const endpointPattern = /(?:app|router)\.(?:get|post|put|delete)\s*\(/g;

  let endpointCount = 0;
  let hasRateLimit = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const endpoints = file.content.match(endpointPattern);
    if (endpoints) endpointCount += endpoints.length;

    if (rateLimitPattern.test(file.content)) {
      hasRateLimit = true;
    }
  }

  if (endpointCount > 5 && !hasRateLimit) {
    issues.push({
      type: "missing_rate_limit",
      severity: 1,
      description: `${endpointCount} endpoint(s) detectado(s) mas nenhum rate limiting configurado`,
      location: "src/",
      recommendation: "Adicionar rate limiting em endpoints públicos (express-rate-limit, rate-limiter-flexible).",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 15.3 Missing Timeouts ───────────────────────────────────────────────────

export function detectMissingTimeouts(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const httpCallPattern = /(?:fetch|axios|got|request)\s*\(/g;
  const timeoutPattern = /timeout|AbortController|AbortSignal|signal\s*:/;

  let httpCalls = 0;
  let hasTimeout = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const matches = file.content.match(httpCallPattern);
    if (matches) httpCalls += matches.length;

    if (timeoutPattern.test(file.content)) {
      hasTimeout = true;
    }
  }

  if (httpCalls > 3 && !hasTimeout) {
    issues.push({
      type: "missing_timeout",
      severity: 1,
      description: `${httpCalls} chamada(s) HTTP detectada(s) mas nenhum timeout configurado`,
      location: "src/",
      recommendation: "Configurar timeout em todas as chamadas HTTP para evitar requests pendurados.",
      confidence: 0.65,
    });
  }

  return issues;
}
