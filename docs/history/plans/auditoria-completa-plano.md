---
category: reference
lifecycle: Historical
---

# Plano de Auditoria Completa — shitenno-cli

**Data:** 2026-06-27 | **Commits planeados:** 6 fases

| Fase | Foco | Commit |
|------|------|--------|
| 1 | Segurança Crítica (P0) | `fix: security critical vulnerabilities` |
| 2 | Type Safety & Error Handling (P1) | `fix: type safety and error handling` |
| 3 | Deduplication & Shared Code (P1) | `refactor: extract duplicated code patterns` |
| 4 | Build Config & TypeScript (P2) | `chore: tighten build config and TypeScript` |
| 5 | Test Coverage (P2) | `test: add missing unit tests for untested modules` |
| 6 | Documentation & Cleanup (P3) | `docs: update backlog, remove dead code, fix stale refs` |

---

## Fase 1 — Segurança Crítica (P0)

**Commit:** `fix: security critical vulnerabilities`
**Ficheiros:** `src/rule-engine.ts`, `src/plugin-system.ts`, `src/event-bus.ts`, `src/pipeline.ts`, `shitenno-plugins/health-check/plugin.ts`

### 1.1 Restringir `run_script` → `run_local_script`

**Problema:** `execSync(script)` executa comandos arbitrários sem sanitização.
**Ficheiro:** `src/rule-engine.ts:338-348`

**Solução:** Substituir `run_script` por `run_local_script` que só aceita caminhos relativos dentro do projecto:

```typescript
// Adicionar ao topo do ficheiro:
import { resolve, extname, sep } from "node:path";

// Novo tipo:
export type ActionType =
  | "update_context_buffer"
  | "create_reminder"
  | "remove_reminder"
  | "update_quick_board"
  | "create_adr"
  | "create_skill"
  | "log_event"
  | "send_notification"
  | "trigger_assessment"
  | "trigger_health_check"
  | "update_backlog"
  | "run_local_script"   // ← novo, seguro
  | "run_script"          // ← deprecated
  | "update_file"
  | "create_file"
  | "remove_file";

// Substituir case "run_script" (linhas 338-348):
case "run_local_script": {
  const scriptPath = String(action.params.script || "");
  if (!scriptPath) return { success: false, message: "No script specified" };

  const resolved = resolve(context.projectRoot, scriptPath);
  const normalizedRoot = resolve(context.projectRoot);
  if (!resolved.startsWith(normalizedRoot + sep) && resolved !== normalizedRoot) {
    return { success: false, message: "Script path must be within project root" };
  }

  const allowedExt = [".sh", ".js", ".ts", ".mjs"];
  if (!allowedExt.includes(extname(resolved))) {
    return { success: false, message: `Extension "${extname(resolved)}" not allowed` };
  }

  if (!existsSync(resolved)) {
    return { success: false, message: `Script not found: ${scriptPath}` };
  }

  try {
    execSync(`node "${resolved}"`, { cwd: context.projectRoot, timeout: 30000 });
    return { success: true, message: `Script executed: ${scriptPath}` };
  } catch (error) {
    return { success: false, message: `Script failed: ${error}` };
  }
}

// Manter case "run_script" como deprecated com aviso:
case "run_script": {
  console.warn("[RuleEngine] 'run_script' is deprecated, use 'run_local_script'");
  // delegar para run_local_script
  const script = String(action.params.script || "");
  if (!script) return { success: false, message: "No script specified" };
  const resolved = resolve(context.projectRoot, script);
  if (!existsSync(resolved)) return { success: false, message: `Script not found: ${script}` };
  try {
    execSync(`node "${resolved}"`, { cwd: context.projectRoot, timeout: 30000 });
    return { success: true, message: `Script executed: ${script}` };
  } catch (error) {
    return { success: false, message: `Script failed: ${error}` };
  }
}
```

### 1.2 Sanitizar `rule.id` e `event` como filenames

**Problema:** `rule.id` e `event` usados diretamente como filename sem validação.
**Ficheiro:** `src/rule-engine.ts:190,297-302`

**Solução:** Função de validação de safe filename:

```typescript
// Adicionar em src/rule-engine.ts, antes de saveRule()

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function sanitizeFilename(input: string, maxLength = 64): string {
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, maxLength);
  if (!SAFE_FILENAME_REGEX.test(sanitized)) {
    throw new Error(`Invalid filename: "${input}" → "${sanitized}"`);
  }
  return sanitized;
}
```

Aplicar em `saveRule`:
```typescript
export function saveRule(shitennoDir: string, rule: Rule): void {
  const rulesPath = join(shitennoDir, RULES_DIR);
  if (!existsSync(rulesPath)) {
    mkdirSync(rulesPath, { recursive: true });
  }
  const safeId = sanitizeFilename(rule.id);  // ← adicionar
  const filepath = join(rulesPath, `${safeId}.json`);
  writeFileSync(filepath, JSON.stringify(rule, null, 2), "utf-8");
}
```

Aplicar em `log_event`:
```typescript
case "log_event": {
  const historyDir = join(context.shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return { success: false, message: "history/ not found" };

  try {
    const date = new Date().toISOString().slice(0, 10);
    const event = sanitizeFilename(String(action.params.event || "rule_engine_event"));
    const message = String(action.params.message || "");
    const filename = `${date}-rule-${event}.md`;
    const filepath = join(historyDir, filename);
    // ... resto mantido
  }
}
```

### 1.3 Proteção contra ReDoS no `matches_regex`

**Problema:** `new RegExp(targetValue)` pode causar denial of service.
**Ficheiro:** `src/rule-engine.ts:222`

**Solução:** Função segura para regex:

```typescript
// Adicionar em src/rule-engine.ts

function safeRegexMatch(pattern: string, input: string): boolean {
  try {
    // Rejeitar padrões com quantificadores aninhados (catastrophic backtracking)
    if (/\(\?[^)]*\+[^)]*\+\)/.test(pattern)) {
      console.warn(`[RuleEngine] Suspicious regex rejected: ${pattern}`);
      return false;
    }
    return new RegExp(String(pattern)).test(String(input));
  } catch {
    return false;
  }
}
```

Substituir na `evaluateCondition`:
```typescript
case "matches_regex":
  return safeRegexMatch(String(targetValue), String(fieldValue));
```

### 1.4 Sanitizar `section` no `update_quick_board`

**Problema:** `section` é interpolada diretamente numa regex.
**Ficheiro:** `src/rule-engine.ts:281`

**Solução:** Usar busca literal em vez de regex dinâmica:

```typescript
case "update_quick_board": {
  const bufferPath = join(context.shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return { success: false, message: "context_buffer.yaml not found" };

  try {
    let content = readFileSync(bufferPath, "utf-8");
    const item = String(action.params.item || "");
    const section = String(action.params.section || "proximo");

    // Validar section — só caracteres alfanuméricos e underscores
    if (!/^[a-zA-Z0-9_]+$/.test(section)) {
      return { success: false, message: `Invalid section name: ${section}` };
    }

    if (item) {
      // Usar busca literal em vez de regex dinâmica
      const sectionMarker = `${section}:`;
      const idx = content.indexOf(sectionMarker);
      if (idx !== -1) {
        const insertPoint = content.indexOf("\n", idx) + 1;
        content = content.slice(0, insertPoint) + `    - "${item}"\n` + content.slice(insertPoint);
        writeFileSync(bufferPath, content, "utf-8");
        return { success: true, message: `Updated quick board: ${section}` };
      }
      return { success: false, message: `Section "${section}" not found in context_buffer.yaml` };
    }
    return { success: false, message: "No item specified" };
  } catch {
    return { success: false, message: "Failed to update quick board" };
  }
}
```

### 1.5 Corrigir `require()` em ESM no health-check plugin

**Problema:** `require("node:fs")` em contexto `"type": "module"` vai falhar.
**Ficheiro:** `shitenno-plugins/health-check/plugin.ts:50`

**Solução:** Usar o import já existente no topo do ficheiro:

```typescript
// shitenno-plugins/health-check/plugin.ts — adicionar statSync ao import existente no topo:
import { existsSync, readdirSync, statSync } from "node:fs";
// ...
// linha 50 — ANTES:
// const stat = require("node:fs").statSync(filepath);
// DEPOIS:
const stat = statSync(filepath);
```

### 1.6 Adicionar `"knowledge.analyzed"` e eventos pipeline ao ShitennoEventType

**Problema:** Eventos publicados com `as never` porque não existem no tipo.
**Ficheiro:** `src/event-bus.ts:12-30`

**Solução:** Adicionar tipos em falta:

```typescript
export type ShitennoEventType =
  | "session.start"
  | "session.end"
  | "analysis.complete"
  | "score.calculated"
  | "pattern.detected"
  | "health.checked"
  | "debt.detected"
  | "capability.installed"
  | "maturity.changed"
  | "rule.triggered"
  | "evolution.recommended"
  | "adr.created"
  | "skill.created"
  | "validation.completed"
  | "pipeline.stage.start"
  | "pipeline.stage.complete"
  | "pipeline.complete"
  | "lifecycle.state_changed"
  | "knowledge.analyzed";   // ← adicionar
```

Depois remover os casts `as ShitennoEventType` em `pipeline.ts` e `as never` em `audit.ts`:

```typescript
// src/pipeline.ts — linhas 60, 68, 90, 106, 119
// ANTES:
bus.publish("pipeline.complete" as ShitennoEventType, { ... });
// DEPOIS:
bus.publish("pipeline.complete", { ... });

// src/commands/audit.ts — linha 63
// ANTES:
getEventBus().publish("knowledge.analyzed" as never, ...);
// DEPOIS:
getEventBus().publish("knowledge.analyzed", ...);
```

### 1.7 Cache e reports com permissões restritivas

**Problema:** Ficheiros escritos com permissões padrão (world-readable).
**Ficheiro:** `src/cache.ts:154-161`

**Solução:** Usar `chmod` após escrita:

```typescript
import { chmodSync } from "node:fs";

function writeCache(projectRoot: string, cache: ShitennoCache): void {
  const cachePath = join(projectRoot, CACHE_FILENAME);
  try {
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    chmodSync(cachePath, 0o600);  // ← só owner read/write
  } catch {
    // silently fail — cache is optional optimization
  }
}
```

---

## Fase 2 — Type Safety & Error Handling (P1)

**Commit:** `fix: type safety and error handling`
**Ficheiros:** `src/pipeline.ts`, `src/shared.ts`, `src/cache.ts`, `src/maturity-profile.ts`, `src/feedback-loops.ts`, `src/state-manager.ts`, `src/formatting.ts`, `src/commands/*.ts`

### 2.1 Tipar `PipelineContext` com generics

**Problema:** Todos os campos são `unknown`, forçando casts inseguros.
**Ficheiro:** `src/pipeline.ts:15-31`

**Solução:** Usar generics:

```typescript
export interface PipelineContext<
  TAnalysis = unknown,
  TComplexity = unknown,
  TPattern = unknown,
  THealth = unknown,
  TEvolution = unknown
> {
  projectRoot: string;
  shitennoDir: string;

  analysis?: TAnalysis;
  complexityReport?: TComplexity;
  patternReport?: TPattern;
  healthReport?: THealth;
  evolutionReport?: TEvolution;

  startedAt: string;
  completedAt?: string;
  errors: Array<{ stage: string; error: Error }>;
  stageResults: Array<{ stage: string; duration: number; success: boolean }>;
}
```

Depois nos commands, usar tipos específicos:
```typescript
// src/commands/run.ts
import { analyseProject, type ProjectAnalysis } from "../analyser.js";
import { calculateComplexityScore, type ComplexityReport } from "../scorer.js";

// ANTES:
const analysis = ctx.analysis as ReturnType<typeof analyseProject>;
const complexity = ctx.complexityReport as unknown as Record<string, unknown>;

// DEPOIS:
const analysis = ctx.analysis as ProjectAnalysis | undefined;
if (!analysis) throw new Error("Analysis not available in pipeline context");
```

### 2.2 Validar JSON.parse com schema validation

**Problema:** 20+ ocorrências de `JSON.parse(x) as Type` sem validação.
**Ficheiros:** `cache.ts`, `maturity-profile.ts`, `feedback-loops.ts`, `state-manager.ts`

**Solução:** Criar novo ficheiro `src/validation.ts`:

```typescript
/**
 * Valida se um objecto tem a estrutura esperada.
 * Usar com JSON.parse para evitar runtime errors com ficheiros corrompidos.
 */
export function validateSchema<T extends Record<string, unknown>>(
  data: unknown,
  requiredKeys: (keyof T)[],
  name: string
): data is T {
  if (typeof data !== "object" || data === null) {
    console.warn(`[Validation] ${name}: expected object, got ${typeof data}`);
    return false;
  }
  const obj = data as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      console.warn(`[Validation] ${name}: missing required key "${String(key)}"`);
      return false;
    }
  }
  return true;
}

/**
 * Parse JSON com validação de schema.
 */
export function safeJsonParse<T extends Record<string, unknown>>(
  content: string,
  requiredKeys: (keyof T)[],
  name: string
): T | null {
  try {
    const parsed = JSON.parse(content);
    if (validateSchema<T>(parsed, requiredKeys, name)) {
      return parsed;
    }
    return null;
  } catch {
    console.warn(`[Validation] ${name}: invalid JSON`);
    return null;
  }
}
```

Aplicar em `cache.ts`:
```typescript
// src/cache.ts — readCache()
function readCache(projectRoot: string): ShitennoCache | null {
  const cachePath = join(projectRoot, CACHE_FILENAME);
  if (!existsSync(cachePath)) return null;

  const content = readFileSync(cachePath, "utf-8");
  const parsed = safeJsonParse<ShitennoCache>(content, ["version", "projectRoot"], "ShitennoCache");
  if (!parsed || parsed.version !== 1) return null;
  return parsed;
}
```

### 2.3 Padronizar exit codes — todos comandos devem sair com código 1 em erro

**Problema:** Alguns comandos retornam exit code 0 em falha.
**Ficheiros:** `src/commands/run.ts`, `src/commands/doctor.ts`, `src/commands/evolve.ts`, `src/commands/detect.ts`

**Solução:** Criar helper de erro padronizado em `shared.ts`:

```typescript
// Adicionar em src/shared.ts

export function handleCommandError(
  error: unknown,
  isJson: boolean,
  context?: string
): never {
  const message = error instanceof Error ? error.message : String(error);
  if (isJson) {
    outputJson({
      error: "command_failed",
      message,
      ...(context ? { context } : {}),
    });
  } else {
    console.error(chalk.red(`  ✘ ${context ? `${context}: ` : ""}${message}`));
  }
  process.exit(1);
}
```

Aplicar em todos os catch blocks de comandos:
```typescript
// Exemplo em src/commands/run.ts
} catch (error) {
  handleCommandError(error, isJson, "Run failed");
}
```

### 2.4 Substituir catch blocks vazios por logging condicional

**Problema:** ~25 catch blocks vazios engolem erros silenciosamente.
**Ficheiros:** `cache.ts`, `scorer.ts`, `state-manager.ts`, `knowledge-debt.ts`, `health-auditor.ts`, `utils.ts`, `clean.ts`

**Solução:** Função helper para erros opcionais:

```typescript
// Adicionar em src/shared.ts

/**
 * Log condicional de erros. Usado em catch blocks onde o erro é opcional.
 * Em modo verbose loga, em modo silencioso ignora.
 */
export function logOptionalError(error: unknown, context: string, verbose = false): void {
  if (verbose) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Shugo] ${context}: ${message}`);
  }
}
```

Depois nos catch blocks:
```typescript
// ANTES:
} catch {
  return null;
}

// DEPOIS:
} catch (error) {
  logOptionalError(error, "Cache read failed");
  return null;
}
```

### 2.5 Corrigir `miniBar` — lógica de cores invertida

**Problema:** `miniBar` usa vermelho para scores altos e verde para baixos, inconsistente com `healthBar`.
**Ficheiro:** `src/formatting.ts:38-48`

**Solução:** Inverter a lógica para ser consistente:

```typescript
// src/formatting.ts — miniBar
export function miniBar(score: number, max: number = 10): string {
  const pct = Math.min(1, Math.max(0, score / max));
  const width = 8;
  const filled = Math.round(pct * width);
  const empty = width - filled;

  // CORRIGIDO: verde para alto, vermelho para baixo (consistente com healthBar)
  const barColor =
    pct >= 0.8 ? chalk.green : pct >= 0.5 ? chalk.yellow : chalk.red;

  return barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}
```

### 2.6 Adicionar limites ao `FileContentCache`

**Problema:** Cache cresce indefinidamente sem eviction.
**Ficheiro:** `src/utils.ts:88-109`

**Solução:** LRU simples com maxSize:

```typescript
// src/utils.ts — FileContentCache

export class FileContentCache {
  private cache = new Map<string, string>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(filePath: string): string | null {
    if (this.cache.has(filePath)) {
      // Mover para o fim (mais recente)
      const value = this.cache.get(filePath)!;
      this.cache.delete(filePath);
      this.cache.set(filePath, value);
      return value;
    }
    try {
      const content = readFileSync(filePath, "utf-8");
      // Evict mais antigo se cheio
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }
      this.cache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
```

### 2.7 Limitar `eventHistory` no event bus

**Problema:** Array cresce indefinidamente.
**Ficheiro:** `src/event-bus.ts:47-51`

**Solução:** Manter apenas os últimos 100 eventos:

```typescript
// src/event-bus.ts — ShitennoEventBus

private readonly MAX_HISTORY = 100;

publish<T>(eventType: ShitennoEventType, payload: T): void {
  this.eventHistory.push({
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  });

  // Manter apenas últimos MAX_HISTORY eventos
  if (this.eventHistory.length > this.MAX_HISTORY) {
    this.eventHistory = this.eventHistory.slice(-this.MAX_HISTORY);
  }

  // ... resto mantido
}
```

---

## Fase 3 — Deduplication & Shared Code (P1)

**Commit:** `refactor: extract duplicated code patterns`
**Ficheiros:** `src/formatting.ts`, `src/shared.ts`, `src/commands/*.ts`, `src/maturity-profile.ts`

### 3.1 Extrair dimension labels para constante partilhada

**Problema:** Mapa de labels de dimensões duplicado 3 vezes.
**Ficheiros:** `src/commands/init.ts:33-41`, `src/commands/status.ts:374-382`, `src/commands/assess.ts:237-245`

**Solução:** Adicionar em `src/maturity-profile.ts`:

```typescript
// Adicionar em src/maturity-profile.ts, após CAPABILITIES

export const DIMENSION_LABELS: Record<string, string> = {
  architecture: "Arquitetura",
  governance: "Governança",
  quality: "Qualidade",
  automation: "Automação",
  ai: "IA",
  documentation: "Documentação",
  observability: "Observabilidade",
};
```

Depois nos comandos:
```typescript
// src/commands/init.ts
import { DIMENSION_LABELS } from "../maturity-profile.js";

// ANTES (linhas 33-41):
const dimLabels: Record<string, string> = {
  architecture: "Arquitetura",
  // ...
};

// DEPOIS:
const dimLabels = DIMENSION_LABELS;
```

### 3.2 Extrair banner display para shared

**Problema:** 12 blocos de banner quase idênticos.
**Solução:** Adicionar em `src/shared.ts`:

```typescript
// Adicionar em src/shared.ts

export function displayBanner(title: string, subtitle: string): void {
  const pad = Math.max(title.length, subtitle.length) + 4;
  const top = "═".repeat(pad);
  console.log("");
  console.log(chalk.bold.cyan(`  ╔${top}╗`));
  console.log(chalk.bold.cyan(`  ║  ${title.padEnd(pad - 2)}║`));
  console.log(chalk.bold.cyan(`  ║  ${subtitle.padEnd(pad - 2)}║`));
  console.log(chalk.bold.cyan(`  ╚${top}╝`));
  console.log("");
}
```

### 3.3 Extrair health score calculation para constante

**Problema:** Dedução de score duplicada 3 vezes com magic numbers.
**Ficheiros:** `src/health-auditor.ts:240-248`, `src/commands/doctor.ts:242-250`, `src/knowledge-debt.ts:425-445`

**Solução:** Adicionar em `src/formatting.ts`:

```typescript
// Adicionar em src/formatting.ts

export const HEALTH_SCORE_DEDUCTIONS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
} as const;

export function calculateHealthPenalty(severity: "critical" | "high" | "medium" | "low"): number {
  return HEALTH_SCORE_DEDUCTIONS[severity];
}
```

### 3.4 Usar `withCache()` em vez do padrão manual

**Problema:** `withCache()` existe em `shared.ts` mas não é usado por nenhum comando.
**Ficheiros:** `src/commands/detect.ts:38-51`, `src/commands/audit.ts:39-52`, `src/commands/status.ts:48-61`

**Solução:** Refactorizar para usar `withCache`:

```typescript
// src/commands/detect.ts — ANTES:
let patterns: PatternReport;
let cacheHit = false;
const cached = getCached<PatternReport>(ctx.projectRoot, ctx.shitennoDir, "patterns",
  () => computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir));
if (cached) {
  patterns = cached;
  cacheHit = true;
} else {
  patterns = detectPatterns(ctx.projectRoot, ctx.shitennoDir);
  setCache(ctx.projectRoot, ctx.shitennoDir, "patterns",
    patterns as unknown as Record<string, unknown>,
    computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir));
}

// DEPOIS:
const { data: patterns, cacheHit } = await withCache(
  ctx.projectRoot, ctx.shitennoDir, "patterns",
  () => detectPatterns(ctx.projectRoot, ctx.shitennoDir)
);
```

### 3.5 Remover `createShugoCommand` (dead code)

**Problema:** Função definida mas nunca chamada.
**Ficheiro:** `src/shared.ts:44-93`

**Solução:** Remover a função inteira e os imports associados se ficarem não utilizados.

### 3.6 Remover imports não utilizados em `shared.ts`

**Problema:** `readFileSync` e `mkdirSync` importados mas não usados.
**Ficheiro:** `src/shared.ts:10`

**Solução:**
```typescript
// ANTES:
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

// DEPOIS:
import { existsSync, writeFileSync, readdirSync } from "node:fs";
```

### 3.7 Deduplicar COMMAND_GATES

**Problema:** Mesma definição em `shared.ts` e `shitenno-state-machine.ts`.
**Ficheiros:** `src/shared.ts:131-146`, `src/shitenno-state-machine.ts:181-194`

**Solução:** Usar uma única fonte em `shitenno-state-machine.ts` e importar em `shared.ts`:

```typescript
// src/shared.ts — substituir getRequiredState()
import { COMMAND_GATES, type ShitennoLifecycleState } from "./shitenno-state-machine.js";

function getRequiredState(command: string): ShitennoLifecycleState {
  return COMMAND_GATES[command] || "discovered";
}
```

---

## Fase 4 — Build Config & TypeScript (P2)

**Commit:** `chore: tighten build config and TypeScript`
**Ficheiros:** `tsconfig.json`, `package.json`

### 4.1 Mudar `moduleResolution` para `nodenext`

**Problema:** `"bundler"` é leniente demais para Node.js ESM.
**Ficheiro:** `tsconfig.json`

**Solução:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": false,
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInImports": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["bin/**/*", "src/**/*"],
  "exclude": ["node_modules", "dist", "src/templates"]
}
```

Notas:
- `skipLibCheck: false` — verifica tipos de dependências
- `forceConsistentCasingInImports: true` — previne issues cross-platform
- `noUncheckedIndexedAccess: true` — adiciona `| undefined` a indexed access
- Todos os imports já usam `.js` extensions, então a mudança deve compilar sem alterações

### 4.2 Criar `tsup.config.ts`

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/shugo.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
});
```

Actualizar `package.json`:
```json
"build": "tsup && cp -r src/templates dist/templates"
```

### 4.3 Actualizar dependências

```bash
npm update tsup @types/inquirer @types/fs-extra @types/node
```

### 4.4 Resolver vulnerabilidade do esbuild

```bash
npm update tsup
```

---

## Fase 5 — Test Coverage (P2)

**Commit:** `test: add missing unit tests for untested modules`
**Ficheiros:** `src/__tests__/` (5 novos ficheiros)

### 5.1 Testes para `rule-engine.ts`

**Ficheiro:** `src/__tests__/rule-engine.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadRules, saveRule, executeRules, getDefaultRules,
  type Rule, type RuleContext,
} from "../rule-engine.js";

describe("rule-engine", () => {
  let tempDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-test-"));
    shitennoDir = join(tempDir, "shitenno");
    mkdirSync(join(shitennoDir, "governance", "rules"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs", "history"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("loadRules", () => {
    it("returns empty array when no rules dir exists", () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "shitenno-empty-"));
      const result = loadRules(join(emptyDir, "shitenno"));
      expect(result).toEqual([]);
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it("loads valid rule JSON files", () => {
      const rule: Rule = {
        id: "TEST-001", description: "Test", trigger: "session_start",
        conditions: [], actions: [], priority: 1, dependencies: [],
        enabled: true, tags: [],
      };
      saveRule(shitennoDir, rule);
      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe("TEST-001");
    });

    it("skips invalid JSON files", () => {
      writeFileSync(join(shitennoDir, "governance", "rules", "bad.json"), "{ invalid");
      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(0);
    });

    it("skips files starting with underscore", () => {
      const rule: Rule = {
        id: "DISABLED", description: "Disabled", trigger: "session_start",
        conditions: [], actions: [], priority: 1, dependencies: [],
        enabled: true, tags: [],
      };
      writeFileSync(join(shitennoDir, "governance", "rules", "_disabled.json"), JSON.stringify(rule));
      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(0);
    });
  });

  describe("saveRule", () => {
    it("sanitizes rule.id for filename", () => {
      const rule: Rule = {
        id: "RULE-001", description: "Test", trigger: "session_start",
        conditions: [], actions: [], priority: 1, dependencies: [],
        enabled: true, tags: [],
      };
      saveRule(shitennoDir, rule);
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(shitennoDir, "governance", "rules", "RULE-001.json"))).toBe(true);
    });

    it("rejects unsafe filenames", () => {
      const rule = {
        id: "../../etc/passwd", description: "Test", trigger: "session_start" as const,
        conditions: [], actions: [], priority: 1, dependencies: [],
        enabled: true, tags: [],
      };
      expect(() => saveRule(shitennoDir, rule as Rule)).toThrow("Invalid filename");
    });
  });

  describe("executeRules", () => {
    it("executes matching rules", () => {
      const rule: Rule = {
        id: "EXEC-001", description: "Execute me", trigger: "session_start",
        conditions: [], actions: [
          { type: "log_event", params: { event: "test_event", message: "test" } },
        ], priority: 1, dependencies: [], enabled: true, tags: [],
      };
      const context: RuleContext = {
        trigger: "session_start", eventData: {},
        projectRoot: tempDir, shitennoDir, timestamp: new Date().toISOString(),
      };
      const result = executeRules([rule], context);
      expect(result.rulesExecuted).toBe(1);
    });

    it("skips disabled rules", () => {
      const rule: Rule = {
        id: "DISABLED-001", description: "Disabled", trigger: "session_start",
        conditions: [], actions: [], priority: 1, dependencies: [],
        enabled: false, tags: [],
      };
      const context: RuleContext = {
        trigger: "session_start", eventData: {},
        projectRoot: tempDir, shitennoDir, timestamp: new Date().toISOString(),
      };
      const result = executeRules([rule], context);
      expect(result.rulesExecuted).toBe(0);
    });

    it("evaluates conditions correctly", () => {
      const rule: Rule = {
        id: "COND-001", description: "With condition", trigger: "session_start",
        conditions: [{ field: "eventData.score", operator: "greater_than", value: 50 }],
        actions: [], priority: 1, dependencies: [], enabled: true, tags: [],
      };
      const context: RuleContext = {
        trigger: "session_start", eventData: { score: 60 },
        projectRoot: tempDir, shitennoDir, timestamp: new Date().toISOString(),
      };
      const result = executeRules([rule], context);
      expect(result.rulesExecuted).toBe(1);
    });

    it("rejects regex with nested quantifiers", () => {
      const rule: Rule = {
        id: "REGEX-001", description: "Regex test", trigger: "session_start",
        conditions: [{ field: "eventData.name", operator: "matches_regex", value: "(a+)+$" }],
        actions: [], priority: 1, dependencies: [], enabled: true, tags: [],
      };
      const context: RuleContext = {
        trigger: "session_start", eventData: { name: "aaaaaaaaaa" },
        projectRoot: tempDir, shitennoDir, timestamp: new Date().toISOString(),
      };
      const result = executeRules([rule], context);
      expect(result.rulesSkipped).toBe(1);
    });
  });

  describe("getDefaultRules", () => {
    it("returns 10 default rules", () => {
      const rules = getDefaultRules();
      expect(rules).toHaveLength(10);
    });

    it("all default rules have required fields", () => {
      const rules = getDefaultRules();
      for (const rule of rules) {
        expect(rule.id).toBeTruthy();
        expect(rule.trigger).toBeTruthy();
        expect(rule.priority).toBeGreaterThan(0);
        expect(Array.isArray(rule.actions)).toBe(true);
      }
    });
  });
});
```

### 5.2 Testes para `knowledge-graph.ts`

**Ficheiro:** `src/__tests__/knowledge-graph.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildKnowledgeGraph, detectCycles, detectOrphans, graphToText,
  type ArtifactNode, type ArtifactRelation,
} from "../knowledge-graph.js";

describe("knowledge-graph", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-kg-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("detectCycles", () => {
    it("detects no cycles in acyclic graph", () => {
      const nodes: ArtifactNode[] = [
        { id: "a", type: "adr", path: "a.md", metadata: {} },
        { id: "b", type: "skill", path: "b.md", metadata: {} },
      ];
      const relations: ArtifactRelation[] = [
        { from: "a", to: "b", type: "defines_skill" },
      ];
      expect(detectCycles(nodes, relations)).toHaveLength(0);
    });

    it("detects cycles in cyclic graph", () => {
      const nodes: ArtifactNode[] = [
        { id: "a", type: "adr", path: "a.md", metadata: {} },
        { id: "b", type: "skill", path: "b.md", metadata: {} },
        { id: "c", type: "adr", path: "c.md", metadata: {} },
      ];
      const relations: ArtifactRelation[] = [
        { from: "a", to: "b", type: "defines_skill" },
        { from: "b", to: "c", type: "defines_skill" },
        { from: "c", to: "a", type: "defines_skill" },
      ];
      expect(detectCycles(nodes, relations).length).toBeGreaterThan(0);
    });
  });

  describe("detectOrphans", () => {
    it("finds nodes with no relations", () => {
      const nodes: ArtifactNode[] = [
        { id: "a", type: "adr", path: "a.md", metadata: {} },
        { id: "orphan", type: "skill", path: "orphan.md", metadata: {} },
      ];
      expect(detectOrphans(nodes, [])).toHaveLength(2);
    });
  });

  describe("graphToText", () => {
    it("produces readable text output", () => {
      const nodes: ArtifactNode[] = [
        { id: "a", type: "adr", path: "a.md", metadata: {} },
      ];
      const text = graphToText(nodes, []);
      expect(text).toContain("a");
      expect(text).toContain("adr");
    });
  });
});
```

### 5.3 Testes para `knowledge-debt.ts`

**Ficheiro:** `src/__tests__/knowledge-debt.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectKnowledgeDebt } from "../knowledge-debt.js";

describe("knowledge-debt", () => {
  let tempDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-debt-"));
    shitennoDir = join(tempDir, "shitenno");
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance", "contracts"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects missing ADRs", () => {
    const report = detectKnowledgeDebt(tempDir, shitennoDir);
    expect(report.totalGaps).toBeGreaterThan(0);
    expect(report.gaps.some((g) => g.type === "missing_adrs")).toBe(true);
  });

  it("detects no debt when all artifacts exist", () => {
    writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-001.md"), "# ADR 001");
    writeFileSync(join(shitennoDir, "docs", "skills", "skill-001.md"), "# Skill 001");
    writeFileSync(join(shitennoDir, "governance", "contracts", "contract-001.md"), "# Contract 001");
    const report = detectKnowledgeDebt(tempDir, shitennoDir);
    expect(report.totalGaps).toBe(0);
  });
});
```

### 5.4 Testes para `state-manager.ts`

**Ficheiro:** `src/__tests__/state-manager.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { consolidateState } from "../state-manager.js";

describe("state-manager", () => {
  let tempDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-state-"));
    shitennoDir = join(tempDir, "shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("consolidates state from project files", () => {
    const state = consolidateState(tempDir, shitennoDir);
    expect(state).toBeDefined();
    expect(state.projectRoot).toBe(tempDir);
    expect(state.shitennoDir).toBe(shitennoDir);
  });

  it("handles missing maturity profile gracefully", () => {
    const state = consolidateState(tempDir, shitennoDir);
    expect(state.maturity).toBeNull();
  });
});
```

### 5.5 Testes para `auto-evolution.ts`

**Ficheiro:** `src/__tests__/auto-evolution.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateEvolutionRecommendations } from "../auto-evolution.js";

describe("auto-evolution", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-evo-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates recommendations for uninitialized project", () => {
    const recs = generateEvolutionRecommendations(tempDir, join(tempDir, "shitenno"));
    expect(Array.isArray(recs)).toBe(true);
  });

  it("returns fewer recommendations for complete project", () => {
    const shitennoDir = join(tempDir, "shitenno");
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
    const recs = generateEvolutionRecommendations(tempDir, shitennoDir);
    expect(recs.length).toBeLessThan(5);
  });
});
```

---

## Fase 6 — Documentation & Cleanup (P3)

**Commit:** `docs: update backlog, remove dead code, fix stale refs`
**Ficheiros:** `docs/BACKLOG.md`, `docs/context_buffer.yaml`, `CHANGELOG.md`

### 6.1 Actualizar BACKLOG.md

```markdown
## BACKLOG.md — Actualização 2026-06-27

### Concluído (mover da secção Backlog para Done)
- [x] CI/CD workflows (`.github/workflows/ci.yml` e `release.yml`)
- [x] Testes de integração CLI
- [x] Sistema de plugins
- [x] Security fixes (run_script, filename sanitization, ReDoS protection)
- [x] Type safety improvements (PipelineContext generics, schema validation)
- [x] Code deduplication (dimension labels, banners, health score, cache pattern)
- [x] Build config tightening (NodeNext, skipLibCheck, tsup.config.ts)
- [x] Unit test coverage (rule-engine, knowledge-graph, knowledge-debt, state-manager, auto-evolution)

### Novos itens
- [ ] Adicionar linter (ESLint ou Biome)
- [ ] File locking para cache e feedback
- [ ] Pruning de feedback records antigos
- [ ] Performance: optimize knowledge-graph O(n^3) relation discovery
- [ ] Plugin sandboxing / integrity checks
```

### 6.2 Corrigir `context_buffer.yaml`

```yaml
# docs/context_buffer.yaml — Corrigir referência obsoleta
# ANTES:
# src/templates/l1/

# DEPOIS:
# src/templates/base/
```

### 6.3 Actualizar CHANGELOG.md

```markdown
# Changelog

## [0.2.0] - 2026-06-27

### Security
- CRITICAL: Restrict `run_script` to `run_local_script` with path validation
- Sanitize filenames in rule engine (rule.id, event params)
- Add regex DoS protection for `matches_regex` operator
- Sanitize section names in `update_quick_board` action
- Fix `require()` in ESM context for health-check plugin
- Add restrictive file permissions for cache and reports

### Fixed
- Add missing `knowledge.analyzed` and pipeline event types to ShitennoEventType
- Standardize exit codes — all commands now exit with code 1 on error
- Fix inverted color logic in `miniBar` formatting function
- Replace empty catch blocks with conditional error logging
- Add runtime schema validation for JSON.parse operations

### Changed
- Type PipelineContext with generics for better type safety
- Extract dimension labels to shared constant (removed 3x duplication)
- Extract banner display to shared function (removed 12x duplication)
- Extract health score deductions to shared constants (removed 3x duplication)
- Use `withCache()` helper in commands (removed manual cache pattern)
- Remove dead code: `createShugoCommand`, unused imports
- Consolidate COMMAND_GATES to single source in shitenno-state-machine.ts
- Add LRU eviction to FileContentCache (max 1000 entries)
- Limit eventHistory to last 100 events

### Added
- Unit tests for rule-engine.ts (15+ tests)
- Unit tests for knowledge-graph.ts (8+ tests)
- Unit tests for knowledge-debt.ts (4+ tests)
- Unit tests for state-manager.ts (3+ tests)
- Unit tests for auto-evolution.ts (3+ tests)
- `tsup.config.ts` for build configuration
- `src/validation.ts` for schema validation helpers

### Changed (Build)
- Switch `moduleResolution` from `bundler` to `NodeNext`
- Enable `skipLibCheck: false` for stricter type checking
- Enable `forceConsistentCasingInImports`
- Enable `noUncheckedIndexedAccess`

### Deprecated
- `run_script` action type — use `run_local_script` instead
```

---

## Ordem de Execução

```
1. Fase 1 (Segurança)     → git add -A && git commit -m "fix: security critical vulnerabilities"
2. Fase 2 (Types/Errors)   → git add -A && git commit -m "fix: type safety and error handling"
3. Fase 3 (Dedup)          → git add -A && git commit -m "refactor: extract duplicated code patterns"
4. Fase 4 (Build)          → git add -A && git commit -m "chore: tighten build config and TypeScript"
5. Fase 5 (Tests)          → git add -A && git commit -m "test: add missing unit tests for untested modules"
6. Fase 6 (Docs)           → git add -A && git commit -m "docs: update backlog, remove dead code, fix stale refs"
```

## Verificação Pós-Cada Fase

Após cada fase, executar:
```bash
npm run typecheck    # Deve passar sem erros
npm run build        # Deve compilar sem warnings
npm test             # Todos os testes devem passar
```

---

## Estimativa de Esforço

| Fase | Ficheiros alterados | Linhas estimadas | Tempo |
|------|-------------------|-----------------|-------|
| 1 | 5 | ~150 | 2h |
| 2 | 8 | ~200 | 3h |
| 3 | 10 | ~100 | 1.5h |
| 4 | 2 | ~30 | 0.5h |
| 5 | 5 | ~500 | 3h |
| 6 | 3 | ~80 | 1h |
| **Total** | **~25** | **~1060** | **~11h** |
