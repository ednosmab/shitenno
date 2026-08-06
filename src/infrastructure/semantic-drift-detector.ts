import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

export interface CodebaseFacts {
  dependencies: string[];
  imports: string[];
  cliCommands: string[];
  configKeys: string[];
}

export interface ExtractedKeywords {
  technical: string[];
  commands: string[];
  dependencies: string[];
  configRefs: string[];
}

export interface DriftResult {
  document: string;
  confidence: number;
  missingKeywords: string[];
  reason: string;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

function fuzzyMatch(keyword: string, candidates: string[], threshold = 2): string | null {
  const kw = keyword.toLowerCase();
  for (const candidate of candidates) {
    const c = candidate.toLowerCase();
    if (kw === c) return candidate;
    if (levenshtein(kw, c) <= threshold) return candidate;
  }
  return null;
}

function readPackageJson(projectRoot: string): Record<string, string> | null {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return null;
  }
}

function scanImports(srcDir: string): string[] {
  const imports: string[] = [];
  if (!existsSync(srcDir)) return imports;
  const files = readdirSync(srcDir, { recursive: true })
    .filter((f): f is string => typeof f === "string" && extname(f as string) === ".ts");
  for (const file of files) {
    try {
      const content = readFileSync(join(srcDir, file as string), "utf-8");
      const importMatches = content.matchAll(/import\s+.*?\s+from\s+["']([^"']+)["']/g);
      for (const match of importMatches) {
        const pkg = match[1]?.split("/").slice(0, 2).join("/");
        if (pkg && !pkg.startsWith(".")) imports.push(pkg);
      }
    } catch { /* skip unreadable source files */ }
  }
  return [...new Set(imports)];
}

function scanCliCommands(commandsDir: string): string[] {
  const commands: string[] = [];
  if (!existsSync(commandsDir)) return commands;
  const files = readdirSync(commandsDir, { recursive: true })
    .filter((f): f is string => typeof f === "string" && extname(f as string) === ".ts");
  for (const file of files) {
    try {
      const content = readFileSync(join(commandsDir, file as string), "utf-8");
      const cmdMatches = content.matchAll(/(?:\.command|new Command)\(["']([^"']+)["']\)/g);
      for (const match of cmdMatches) {
        commands.push(match[1]!);
      }
    } catch { /* skip */ }
  }
  return [...new Set(commands)];
}

function scanConfigKeys(projectRoot: string): string[] {
  const keys: string[] = [];
  const envPath = join(projectRoot, ".env.example");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      const envMatches = content.matchAll(/^([A-Z_]+)=/gm);
      for (const match of envMatches) keys.push(match[1]!);
    } catch { /* skip */ }
  }
  return [...new Set(keys)];
}

export function scanCodebase(projectRoot: string): CodebaseFacts {
  const srcDir = join(projectRoot, "src");
  const commandsDir = join(srcDir, "commands");
  return {
    dependencies: Object.keys(readPackageJson(projectRoot) ?? {}),
    imports: scanImports(srcDir),
    cliCommands: scanCliCommands(commandsDir),
    configKeys: scanConfigKeys(projectRoot),
  };
}

const DEPENDENCY_KEYWORDS = [
  "react", "vue", "svelte", "angular", "next", "nuxt", "express", "fastify",
  "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis",
  "docker", "kubernetes", "k8s", "aws", "gcp", "azure",
  "typescript", "javascript", "node", "bun", "deno",
  "prisma", "typeorm", "drizzle", "sequelize",
  "graphql", "rest", "grpc",
  "vitest", "jest", "mocha", "cypress", "playwright",
  "eslint", "prettier", "biome",
  "tailwind", "css", "sass", "less",
  "webpack", "vite", "esbuild", "rollup",
  "pg", "mysql2", "better-sqlite3", "mongoose", "ioredis",
];

const FALSE_POSITIVE_PATTERNS: RegExp[] = [
  /^(?:Done|Backlog|proposed|active|completed)$/i,
  /^(?:Nenhuma|Definir|Nenhum|oi)$/i,
  /^(?:quality|automation|governance|documentation|observability|architecture|ai)$/i,
  /^(?:projectName|my-project|areas|auth|payment|session|security|utf-8|sensitiveKeywords)$/i,
  /^(?:src\/|docs\/|lib\/|packages\/)/,
  /^(?:pnpm|npm|yarn)\s/,
  /^(?:erro|bug|corrigi|falhou|rollback)$/i,
  /^(?:churnWindowDays|weights|churn|violationRate|sensitiveSurface|historyPath|feedbackPath|violationKeywords|highComplexityThreshold)$/i,
  /^(?:COMMIT_PERMISSION|SYSTEM_MAP|FORBIDDEN_OPERATIONS|CONTRACTS_INDEX|CONTEXT_HIERARCHY|CONCEPTUAL_MODEL|KNOWLEDGE_LIFECYCLE|SESSION_REVIEW|SHITENNO_NO_DAEMON|SHITENNO_CHILD|VIOLATION_KEYWORDS|COMMAND_GATES|SKILL_TEMPLATE|KNOWN_LIMITATIONS|BACKLOG_BATCH_RESOLVER|PUBLIC_JWK|PRIVATE_JWK|COMMITS_ENGLISH|BOOTSTRAP_SETUP|LEAN_FLOW|TDD_STRICT|SECURITY_VALIDATION|SENIOR_ENGINEER|TDD_SKILL|POST_COMMIT_CHECK|DEPLOY_CHECKLIST|SESSION_PRIORITY|SESSION_INVARIANT|QUICK_BOARD|EVIDENCE_OVER_DOCS|MEASURE_BEFORE_OPTIMIZE|BACKLOG_STATES|COMPLETION_CHECKLIST|GAP_DETECTION|INFRA_VALIDATION|AUTO_RECOMMEND|COMMAND_CATEGORIES|HANDBOOK_DIR)$/i,
  /^shitenno-[a-z]/i,
  /^PLANO[_-]/i,
  /^SHUGO[_-]/i,
  /^REFACTOR[_-]/i,
  /^MIGRAR[_-]/i,
  /^PLAN[_-]/i,
];

function isFalsePositive(value: string): boolean {
  return FALSE_POSITIVE_PATTERNS.some(p => p.test(value));
}

export function extractKeywords(content: string): ExtractedKeywords {
  const words = content.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  const technical = words.filter(w =>
    w.length > 3 &&
    DEPENDENCY_KEYWORDS.some(d => fuzzyMatch(w, [d], 1) !== null)
  );
  const commands = content.match(/(?:shugo|npm|pnpm|yarn)\s+\w+/g) ?? [];
  const depRefs = content.match(/(?:"|')(?:@?[\w-]+\/)?[\w-]+(?:"|')/g) ?? [];
  const configRefs = content.match(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/g) ?? [];
  return {
    technical: [...new Set(technical)],
    commands: [...new Set(commands)],
    dependencies: [...new Set(depRefs.map(d => d.replace(/["']/g, "")))],
    configRefs: [...new Set(configRefs)],
  };
}

const CONFIDENCE_RULES = {
  dependency_missing: 0.4,
  command_missing: 0.3,
  config_missing: 0.2,
  runbook_boost: 0.1,
  adr_historical_penalty: -0.3,
};

export function detectDrift(
  doc: { content: string; type: string; age?: number },
  facts: CodebaseFacts,
  docPath?: string
): DriftResult {
  const keywords = extractKeywords(doc.content);
  const missing: string[] = [];
  let confidence = 0;

  confidence += collectMissingDependencies(keywords.dependencies, facts.dependencies, missing);
  confidence += collectMissingCommands(keywords.commands, facts.cliCommands, missing);
  confidence += collectMissingConfigRefs(keywords.configRefs, facts.configKeys, missing);
  confidence += applyDocTypeAdjustments(doc);
  confidence = Math.min(1, Math.max(0, confidence));

  const reason = missing.length > 0
    ? `Missing in codebase: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` (+${missing.length - 3})` : ""}`
    : "No significant drift detected";
  return { document: docPath ?? "unknown", confidence, missingKeywords: missing, reason };
}

function collectMissingDependencies(
  deps: string[],
  factsDeps: string[],
  missing: string[]
): number {
  let score = 0;
  for (const dep of deps) {
    if (isFalsePositive(dep)) continue;
    if (!fuzzyMatch(dep, factsDeps, 2)) {
      missing.push(dep);
      score += CONFIDENCE_RULES.dependency_missing;
    }
  }
  return score;
}

function collectMissingCommands(
  cmds: string[],
  factsCmds: string[],
  missing: string[]
): number {
  let score = 0;
  for (const cmd of cmds) {
    if (isFalsePositive(cmd)) continue;
    const cmdName = cmd.split(/\s+/).pop() ?? cmd;
    if (!fuzzyMatch(cmdName, factsCmds, 2)) {
      missing.push(cmd);
      score += CONFIDENCE_RULES.command_missing;
    }
  }
  return score;
}

function collectMissingConfigRefs(
  refs: string[],
  factsKeys: string[],
  missing: string[]
): number {
  let score = 0;
  for (const key of refs) {
    if (isFalsePositive(key)) continue;
    if (!fuzzyMatch(key, factsKeys, 1)) {
      missing.push(key);
      score += CONFIDENCE_RULES.config_missing;
    }
  }
  return score;
}

function applyDocTypeAdjustments(doc: { type: string; age?: number }): number {
  let adj = 0;
  if (doc.type === "runbook") adj += CONFIDENCE_RULES.runbook_boost;
  if (doc.type === "adr" && doc.age && doc.age > 365) adj += CONFIDENCE_RULES.adr_historical_penalty;
  return adj;
}

export function detectDriftBatch(
  documents: Array<{ path: string; content: string; type: string; age?: number }>,
  facts: CodebaseFacts
): DriftResult[] {
  return documents.map(doc =>
    detectDrift({ content: doc.content, type: doc.type, age: doc.age }, facts, doc.path)
  ).filter(r => r.confidence > 0.8);
}
