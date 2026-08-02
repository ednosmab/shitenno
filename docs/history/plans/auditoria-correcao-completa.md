---
category: reference
lifecycle: Historical
---

# Plano de Correção — Auditoria Completa shitenno-cli

**Data:** 2026-06-27
**Escopo:** Corrigir todos os problemas apontados na auditoria de código, segurança, qualidade, testes, CI/CD e configuração.
**Formato:** 5 fases, dependências entre fases respeitadas.

---

## Índice

- [Fase 1 — Segurança (Crítico)](#fase-1--segurança-crítico)
- [Fase 2 — Qualidade do Código](#fase-2--qualidade-do-código)
- [Fase 3 — Infraestrutura e Configuração](#fase-3--infraestrutura-e-configuração)
- [Fase 4 — CI/CD e Publicação](#fase-4--cicd-e-publicação)
- [Fase 5 — README e Documentação](#fase-5--readme-e-documentação)

---

## Fase 1 — Segurança (Crítico)

**Objetivo:** Eliminar vulnerabilidades de segurança que permitem execução arbitrária, path traversal e ReDoS.
**Dependências:** Nenhuma — pode começar imediatamente.
**Esforço estimado:** 4-6 horas.

### 1.1 Restringir `run_script` no rule-engine

**Problema:** `rule-engine.ts:338-344` executa qualquer shell command via `execSync` sem validação.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Substituir `run_script` por `run_allowed_script` com allowlist de comandos permitidos.

```typescript
// ── Adicionar no topo do arquivo (após imports) ──

/** Comandos permitidos para execução via regras. */
const ALLOWED_SCRIPTS: Record<string, string> = {
  "git-status": "git status --short",
  "git-diff": "git diff --stat",
  "git-log": "git log --oneline -5",
  "list-files": "find . -maxdepth 2 -type f | head -20",
};

/** Valida se um script é permitido. */
function isScriptAllowed(script: string): boolean {
  return script in ALLOWED_SCRIPTS;
}

// ── Substituir o case "run_script" (linhas 338-348) ──

case "run_script": {
  const script = String(action.params.script || "");
  if (!script) return { success: false, message: "No script specified" };

  if (!isScriptAllowed(script)) {
    return {
      success: false,
      message: `Script "${script}" not in allowlist. Allowed: ${Object.keys(ALLOWED_SCRIPTS).join(", ")}`,
    };
  }

  try {
    const command = ALLOWED_SCRIPTS[script];
    execSync(command, {
      cwd: context.projectRoot,
      timeout: 30000,
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { success: true, message: `Script executed: ${script}` };
  } catch (error) {
    return { success: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
```

### 1.2 Sanitizar `rule.id` contra path traversal

**Problema:** `rule-engine.ts:190` usa `rule.id` diretamente em `join()` sem sanitização.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Adicionar validação de ID antes de gravar.

```typescript
// ── Adicionar função de validação (após SAVE_RULES_DIR) ──

/** Valida se um rule ID é seguro (sem path traversal). */
function isValidRuleId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

// ── Substituir saveRule (linhas 184-192) ──

export function saveRule(shitennoDir: string, rule: Rule): void {
  if (!isValidRuleId(rule.id)) {
    throw new Error(`Invalid rule ID: "${rule.id}". Only alphanumeric, hyphens and underscores allowed.`);
  }

  const rulesPath = join(shitennoDir, RULES_DIR);
  if (!existsSync(rulesPath)) {
    mkdirSync(rulesPath, { recursive: true });
  }

  const filepath = join(rulesPath, `${rule.id}.json`);
  writeFileSync(filepath, JSON.stringify(rule, null, 2), "utf-8");
}
```

### 1.3 Proteger contra ReDoS em `matches_regex`

**Problema:** `rule-engine.ts:221-222` compila regex de input do usuário sem timeout.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Usar timeout na regex ou limitar complexidade.

```typescript
// ── Substituir case "matches_regex" (linhas 221-222) ──

case "matches_regex": {
  try {
    const pattern = String(targetValue);
    // Validação básica de complexidade
    if (pattern.length > 200) return false;
    // Conta grupos de captura para detectar backtracking excessivo
    const groupCount = (pattern.match(/\(/g) || []).length;
    if (groupCount > 10) return false;

    const regex = new RegExp(pattern);
    return regex.test(String(fieldValue));
  } catch {
    return false; // Regex inválida
  }
}
```

### 1.4 Sanitizar `section` em `update_quick_board`

**Problema:** `rule-engine.ts:280-281` interpola `section` em `new RegExp()`.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Escapar caracteres especiais de regex.

```typescript
// ── Adicionar função de escape ──

/** Escapa caracteres especiais de regex. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Substituir a linha 280-283 ──

content = content.replace(
  new RegExp(`(${escapeRegex(section)}:\\s*\\n)`),
  `$1    - "${item}"\n`
);
```

### 1.5 Sanitizar `event` em `log_event`

**Problema:** `rule-engine.ts:299-305` usa `event` em filename sem sanitização.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Validar e sanitizar o nome do evento.

```typescript
// ── Substituir case "log_event" (linhas 293-309) ──

case "log_event": {
  const historyDir = join(context.shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return { success: false, message: "history/ not found" };

  try {
    const date = new Date().toISOString().slice(0, 10);
    // Sanitizar event: apenas alfanuméricos, hífens e underscores
    const event = String(action.params.event || "rule_engine_event")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50);
    const message = String(action.params.message || "");
    const filename = `${date}-rule-${event}.md`;
    const filepath = join(historyDir, filename);

    const content = `# ${event}\n\nDate: ${context.timestamp}\nRule: ${context.eventData.ruleId || "unknown"}\n\n${message}\n`;
    writeFileSync(filepath, content, "utf-8");
    return { success: true, message: `Logged event: ${event}` };
  } catch {
    return { success: false, message: "Failed to log event" };
  }
}
```

### 1.6 Adicionar validação de schema para regras JSON

**Problema:** `rule-engine.ts:168-178` carrega regras sem validação de campos.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Adicionar função de validação de regra.

```typescript
// ── Adicionar tipos e função de validação ──

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Valida se uma regra carregada do JSON tem todos os campos obrigatórios. */
function validateRule(rule: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof rule !== "object" || rule === null) {
    return { valid: false, errors: ["Rule is not an object"] };
  }

  const r = rule as Record<string, unknown>;

  if (typeof r.id !== "string" || !r.id) errors.push("Missing or invalid 'id'");
  if (typeof r.trigger !== "string") errors.push("Missing or invalid 'trigger'");
  if (!Array.isArray(r.conditions)) errors.push("'conditions' must be an array");
  if (!Array.isArray(r.actions)) errors.push("'actions' must be an array");
  if (typeof r.priority !== "number") errors.push("'priority' must be a number");
  if (r.tags !== undefined && !Array.isArray(r.tags)) errors.push("'tags' must be an array");

  // Validar ações
  if (Array.isArray(r.actions)) {
    const validActionTypes = [
      "create_reminder", "update_quick_board", "log_event",
      "trigger_assessment", "trigger_health_check", "update_backlog", "run_script",
    ];
    for (const action of r.actions) {
      if (typeof action !== "object" || action === null) {
        errors.push("Action is not an object");
        continue;
      }
      const a = action as Record<string, unknown>;
      if (!validActionTypes.includes(a.type as string)) {
        errors.push(`Invalid action type: "${a.type}"`);
      }
      if (typeof a.params !== "object" || a.params === null) {
        errors.push(`Action "${a.type}" missing 'params'`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Substituir loadRules (linhas 167-178) ──

const rules: Rule[] = [];
for (const file of files) {
  try {
    const content = readFileSync(join(rulesPath, file), "utf-8");
    const parsed = JSON.parse(content);
    const validation = validateRule(parsed);

    if (!validation.valid) {
      console.warn(`[RuleEngine] Invalid rule in ${file}: ${validation.errors.join(", ")}`);
      continue;
    }

    rules.push(parsed as Rule);
  } catch {
    console.warn(`[RuleEngine] Failed to parse ${file}`);
  }
}
```

### 1.7 Proteger `resolveField` contra prototype pollution

**Problema:** `rule-engine.ts:229-242` acessa propriedades via notação pontilhada sem proteção.
**Arquivo:** `src/rule-engine.ts`

**Solução:** Bloquear acesso a `__proto__`, `constructor`, `prototype`.

```typescript
// ── Substituir resolveField (linhas 229-242) ──

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf"]);

function resolveField(
  field: string,
  context: RuleContext
): string | number | boolean | undefined {
  const parts = field.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (DANGEROUS_KEYS.has(part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current as string | number | boolean | undefined;
}
```

### 1.8 Validação de plugins

**Problema:** `plugin-system.ts:165-173` validação superficial de plugins.
**Arquivo:** `src/plugin-system.ts`

**Solução:** Validar hooks e nome do plugin.

```typescript
// ── Substituir isShitennoPlugin (linhas 165-173) ──

const VALID_HOOK_NAMES = new Set([
  "pre-analysis", "post-analysis", "pre-scaffold", "post-scaffold",
  "custom-check", "custom-recommendation", "custom-metric",
]);

const SAFE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function isShitennoPlugin(obj: unknown): obj is ShitennoPlugin {
  if (typeof obj !== "object" || obj === null) return false;
  const plugin = obj as Record<string, unknown>;

  if (typeof plugin.name !== "string" || !SAFE_NAME_REGEX.test(plugin.name)) return false;
  if (typeof plugin.version !== "string") return false;
  if (typeof plugin.description !== "string") return false;

  // Validar hooks se presentes
  if (plugin.hooks !== undefined) {
    if (typeof plugin.hooks !== "object" || plugin.hooks === null) return false;
    const hooks = plugin.hooks as Record<string, unknown>;
    for (const hookName of Object.keys(hooks)) {
      if (!VALID_HOOK_NAMES.has(hookName)) return false;
      if (typeof hooks[hookName] !== "function") return false;
    }
  }

  return true;
}
```

---

## Fase 2 — Qualidade do Código

**Objetivo:** Eliminar code smells, duplicação, error handling inconsistente e código morto.
**Dependências:** Fase 1 (security fixes first).
**Esforço estimado:** 6-8 horas.

### 2.1 Criar módulo de logging centralizado

**Problema:** 60+ `catch { }` silenciosos + `console.*` dispersos em código de biblioteca.
**Arquivo novo:** `src/logger.ts`

```typescript
/**
 * logger.ts — Logging centralizado para Shugo
 *
 * Substitui console.* em código de biblioteca.
 * Permite suprimir output em testes.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

let currentLevel: LogLevel = "info";
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Define o nível de log. */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Suprime todo output (para testes). */
export function muteLogs(): void {
  currentLevel = "error";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, module: string, message: string): string {
  const prefix = `[${module}]`;
  const levelTag = level.toUpperCase().padEnd(5);
  return `${prefix} ${levelTag} ${message}`;
}

export const logger = {
  debug(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", module, message), ...args);
    }
  },
  info(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(formatMessage("info", module, message), ...args);
    }
  },
  warn(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", module, message), ...args);
    }
  },
  error(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", module, message), ...args);
    }
  },
};
```

### 2.2 Substituir `catch { }` silenciosos por debug logging

**Problema:** 60+ blocos catch vazios engolem erros sem diagnóstico.
**Arquivos afetados:** Todos os arquivos com catch silencioso.

**Padrão de substituição:**

```typescript
// ANTES (scorer.ts:184)
try {
  const log = execSync("git log ...", { encoding: "utf-8" });
  // ...
} catch {
  // silently fail
}

// DEPOIS
try {
  const log = execSync("git log ...", { encoding: "utf-8" });
  // ...
} catch (error) {
  logger.debug("Scorer", `Failed to read git log: ${error instanceof Error ? error.message : String(error)}`);
}
```

**Arquivos prioritários:**

| Arquivo | Linhas | Contexto |
|---------|--------|----------|
| `scorer.ts` | 184, 436, 914 | git log, statSync, writeReport |
| `cache.ts` | 44, 149, 158 | fileChecksum, readCache, writeCache |
| `analyser.ts` | 197 | readPackageJson |
| `health-auditor.ts` | 181, 196, 231 | file reading |
| `pattern-detector.ts` | 138, 372 | report read/write |
| `state-manager.ts` | 263, 283, 302, 370 | JSON/YAML parse |
| `rule-engine.ts` | 175, 265, 288, 307, 333 | rule loading, actions |
| `feedback-loops.ts` | 110, 133, 145 | record/summary reading |
| `knowledge-debt.ts` | 211, 358, 414, 501 | detection failures |
| `utils.ts` | 51, 100 | walkSourceFiles, cache get |
| `doctor.ts` | 230 | detectKnowledgeDebt |
| `event-bus.ts` | 70, 74 | handler errors |
| `plugin-system.ts` | 49, 73-74, 99-100, 137 | plugin loading |

### 2.3 Extrair constantes duplicadas

**Problema:** `VIOLATION_KEYWORDS` duplicado em 3 arquivos, `COMMAND_GATES` em 2.
**Arquivo novo:** `src/constants.ts`

```typescript
/**
 * constants.ts — Constantes compartilhadas do Shugo
 *
 * Elimina duplicação de VIOLATION_KEYWORDS e COMMAND_GATES.
 */

/** Palavras-chave que indicam violações em commits/logs. */
export const VIOLATION_KEYWORDS = [
  // Português
  "bug", "fix", "hotfix", "error", "issue", "broken", "regressão",
  "problema", "incidente", "falha", "crash", "exception",
  // Inglês
  "reverted", "rollback", "revert", "violated", "violacao",
  "undeclared", "missing", "unexpected", "failed",
];

/** Mapeamento comando → estado mínimo necessário. */
export const COMMAND_GATES: Record<string, string> = {
  init: "uninitialized",
  status: "discovered",
  detect: "discovered",
  audit: "discovered",
  upgrade: "assessed",
  validate: "assessed",
  assess: "discovered",
  doctor: "discovered",
  run: "assessed",
  sync: "governed",
  clean: "governed",
  evolve: "governed",
};

/** Tempo limite para comandos git (ms). */
export const GIT_TIMEOUT = 5000;

/** Tempo limite para scripts de regras (ms). */
export const RULE_SCRIPT_TIMEOUT = 30000;

/** Nomes de ações válidas para o rule engine. */
export const VALID_ACTION_TYPES = [
  "create_reminder",
  "update_quick_board",
  "log_event",
  "trigger_assessment",
  "trigger_health_check",
  "update_backlog",
  "run_script",
] as const;
```

### 2.4 Atualizar imports das constantes

**Arquivos:** `scorer.ts`, `health-auditor.ts`, `pattern-detector.ts`, `shared.ts`, `shitenno-state-machine.ts`

```typescript
// ANTES (scorer.ts:122)
const violationKeywords = ["bug", "fix", "hotfix", ...];

// DEPOIS
import { VIOLATION_KEYWORDS, GIT_TIMEOUT } from "./constants.js";
// Usar VIOLATION_KEYWORDS diretamente
```

```typescript
// ANTES (shared.ts:130-146)
function getRequiredState(command: string): ShitennoLifecycleState {
  const gates: Record<string, ShitennoLifecycleState> = { ... };
}

// DEPOIS
import { COMMAND_GATES } from "./constants.js";
import { type ShitennoLifecycleState } from "./shitenno-state-machine.js";

function getRequiredState(command: string): ShitennoLifecycleState {
  return (COMMAND_GATES[command] || "discovered") as ShitennoLifecycleState;
}
```

### 2.5 Eliminar `process.exit(1)` — usar erros tipados

**Problema:** `process.exit(1)` em 15+ lugares impede testes e limpeza.
**Arquivo novo:** `src/errors.ts`

```typescript
/**
 * errors.ts — Erros tipados do Shugo
 *
 * Substitui process.exit(1) por erros que Commander captura.
 */

export class ShitennoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = "ShitennoError";
  }
}

export class NotInitializedError extends ShitennoError {
  constructor() {
    super("Project not initialized. Run `shugo init` first.", "NOT_INITIALIZED");
  }
}

export class InvalidRuleError extends ShitennoError {
  constructor(detail: string) {
    super(`Invalid rule: ${detail}`, "INVALID_RULE");
  }
}

export class ScriptNotAllowedError extends ShitennoError {
  constructor(script: string) {
    super(`Script "${script}" is not in the allowlist.`, "SCRIPT_NOT_ALLOWED");
  }
}
```

**Substituir em `shared.ts`:**

```typescript
// ANTES (shared.ts:74, 88)
process.exit(1);

// DEPOIS
throw new NotInitializedError();
// Commander捕获 automaticamente e mostra mensagem amigável
```

### 2.6 Corrigir código morto em `upgrade.ts`

**Problema:** `upgrade.ts:273` — `directoriesCreated` sempre retorna 0.
**Arquivo:** `src/commands/upgrade.ts`

```typescript
// ANTES (linhas ~270-280)
return {
  filesCreated,
  directoriesCreated, // sempre 0
  capabilitiesInstalled,
};

// DEPOIS — contar diretórios criados de verdade
let directoriesCreated = 0;
// ... dentro do loop de criação:
if (mkdirSync(dir, { recursive: true })) {
  directoriesCreated++;
}
```

### 2.7 Adicionar evento faltante ao ShitennoEventType

**Problema:** `audit.ts:63` usa `as never` porque `knowledge.analyzed` não está no tipo.
**Arquivo:** `src/event-bus.ts`

```typescript
// ANTES (event-bus.ts:12-30)
export type ShitennoEventType =
  | "session.start"
  | ...
  | "lifecycle.state_changed";

// DEPOIS — adicionar o evento faltante
export type ShitennoEventType =
  | "session.start"
  | ...
  | "lifecycle.state_changed"
  | "knowledge.analyzed";
```

**Arquivo:** `src/commands/audit.ts`

```typescript
// ANTES (audit.ts:63)
getEventBus().publish("knowledge.analyzed" as never, { ... });

// DEPOIS
getEventBus().publish("knowledge.analyzed", { ... });
```

### 2.8 Corrigir imports duplicados de `node:fs` vs `fs-extra`

**Problema:** `status.ts` mistura `fse` (fs-extra) com `node:fs` sem necessidade.
**Arquivo:** `src/commands/status.ts`

```typescript
// ANTES
import fse from "fs-extra";
import { readFileSync, existsSync, readdirSync } from "node:fs";

// DEPOIS — usar apenas node:fs (Node >=18)
import { readFileSync, existsSync, readdirSync, cpSync, mkdirSync } from "node:fs";
// cpSync substitui fse.copySync
// mkdirSync com { recursive: true } substitui fse.ensureDirSync
```

### 2.9 Corrigir non-null assertions frágeis em `scorer.ts`

**Problema:** `scorer.ts:176, 248, 350` usam `!` após `Map.get()`.
**Arquivo:** `src/scorer.ts`

```typescript
// ANTES (scorer.ts:176)
fileSetByArea.get(a)!.add(trimmed);

// DEPOIS
const fileSet = fileSetByArea.get(a);
if (fileSet) {
  fileSet.add(trimmed);
}
```

---

## Fase 3 — Infraestrutura e Configuração

**Objetivo:** Corrigir configuração, adicionar ESLint, melhorar tsconfig, limpar .gitignore.
**Dependências:** Fase 2.
**Esforço estimado:** 2-3 horas.

### 3.1 Adicionar ESLint ao projeto

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npx eslint --init
```

**Configuração `.eslintrc.json`:**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "off",
    "no-process-exit": "off"
  },
  "ignorePatterns": ["dist/", "node_modules/", "coverage/", "*.js", "*.d.ts"]
}
```

**Atualizar `package.json` scripts:**

```json
{
  "scripts": {
    "lint": "eslint src/ bin/ --ext .ts",
    "lint:fix": "eslint src/ bin/ --ext .ts --fix",
    "typecheck": "tsc --noEmit"
  }
}
```

### 3.2 Melhorar `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": false,
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["bin/**/*", "src/**/*"],
  "exclude": ["node_modules", "dist", "src/templates"]
}
```

**Mudanças:**
- `skipLibCheck: false` — detectar erros em .d.ts de dependências
- `declaration: false` — tsup gera .d.ts, tsc não precisa
- Adicionar `forceConsistentCasingInFileNames`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`

### 3.3 Atualizar `.gitignore`

```gitignore
# Build
dist/
*.tsbuildinfo

# Dependencies
node_modules/

# Environment
.env
.env.*
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Coverage
coverage/
.vitest/

# Shugo
.shitenno-cache.json

# Plans (manter no repo)
# plans/*
```

### 3.4 Limpar `.npmignore`

O `package.json` já tem `"files": ["dist"]` que funciona como whitelist. O `.npmignore` é redundante mas pode ser mantido como defesa:

```gitignore
# Source
src/
bin/
docs/
plans/
shitenno-plugins/
.github/

# Config
tsconfig.json
vitest.config.ts
.eslintrc.json
.gitignore
.npmignore

# Tests
src/__tests__/
*.test.ts
*.bench.ts

# Build artifacts
*.tsbuildinfo
coverage/
```

### 3.5 Corrigir race conditions no cache

**Problema:** `cache.ts:140-161` faz read-modify-write sem locking.
**Arquivo:** `src/cache.ts`

**Solução:** Usar write atômico (temp file + rename).

```typescript
// ANTES (cache.ts:154-161)
function writeCache(projectRoot: string, cache: ShitennoCache): void {
  const cachePath = join(projectRoot, CACHE_FILENAME);
  try {
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // silently fail
  }
}

// DEPOIS
import { renameSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";

function writeCache(projectRoot: string, cache: ShitennoCache): void {
  const cachePath = join(projectRoot, CACHE_FILENAME);
  const tmpPath = join(tmpdir(), `shitenno-cache-${Date.now()}.json`);
  try {
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2), "utf-8");
    renameSync(tmpPath, cachePath); // atômico no mesmo filesystem
  } catch (error) {
    logger.debug("Cache", `Failed to write cache: ${error instanceof Error ? error.message : String(error)}`);
    try { unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
  }
}
```

### 3.6 Adicionar limites ao event history

**Problema:** `event-bus.ts:47-51` — `eventHistory` cresce infinitamente.
**Arquivo:** `src/event-bus.ts`

```typescript
// ANTES
private eventHistory: Array<{ type: string; payload: unknown; timestamp: string }> = [];

// DEPOIS
private eventHistory: Array<{ type: string; payload: unknown; timestamp: string }> = [];
private static readonly MAX_HISTORY = 1000;

// No método publish, adicionar após o push:
if (this.eventHistory.length > ShitennoEventBus.MAX_HISTORY) {
  this.eventHistory = this.eventHistory.slice(-ShitennoEventBus.MAX_HISTORY);
}
```

### 3.7 Adicionar limites ao FileContentCache

**Problema:** `utils.ts:88-103` — cache sem eviction.
**Arquivo:** `src/utils.ts`

```typescript
// ANTES
private cache = new Map<string, string>();

// DEPOIS
private cache = new Map<string, string>();
private static readonly MAX_ENTRIES = 500;

get(filePath: string): string | undefined {
  return this.cache.get(filePath);
}

set(filePath: string, content: string): void {
  if (this.cache.size >= FileContentCache.MAX_ENTRIES) {
    // Remove primeira entrada (FIFO)
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }
  this.cache.set(filePath, content);
}
```

---

## Fase 4 — CI/CD e Publicação

**Objetivo:** Tornar CI/CD seguro, completo e rastreável.
**Dependências:** Fase 3.
**Esforço estimado:** 1-2 horas.

### 4.1 Atualizar `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm audit --omit=dev || true

  coverage:
    name: Coverage
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run test:coverage || npm test
```

### 4.2 Atualizar `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write
  id-token: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          fetch-depth: 0

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test

      # Verificar consistência de versão
      - name: Verify tag matches package.json
        run: |
          TAG="${GITHUB_REF#refs/tags/v}"
          PKG_VERSION=$(node -p "require('./package.json').version")
          if [ "$TAG" != "$PKG_VERSION" ]; then
            echo "ERROR: Tag ($TAG) != package.json version ($PKG_VERSION)"
            exit 1
          fi

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: GitHub Release
        uses: softprops/action-gh-release@da05d552573ad5aba039eaac05058a918a7bf631 # v2.0.6
        with:
          generate_release_notes: true
```

### 4.3 Adicionar `npm audit` ao CI

Já incluído no step `npm audit --omit=dev || true` no ci.yml acima. O `|| true` evita que vulnerabilidades em dependências de dev bloqueiem o CI.

---

## Fase 5 — README e Documentação

**Objetivo:** Atualizar README para refletir o estado atual do Shitenno (12 comandos, features completas).
**Dependências:** Fases 1-4 (para que o código refletido no README esteja correto).
**Esforço estimado:** 1-2 horas.

### 5.1 Novo README.md

O README atualizado deve conter:

1. **Header com badges** — npm version, license, CI status
2. **Descrição atualizada** — 12 comandos, não apenas 7
3. **Tabela de comandos completa** — todos os 12 comandos com status
4. **Instalação** — npm install + npx
5. **Quick Start** — 4 passos
6. **Documentação detalhada de cada comando** — com exemplos de uso
7. **Arquitetura** — árvore de diretórios atualizada com novos módulos (logger, constants, errors)
8. **Performance** — otimizações de caching
9. **Configuração** — opencode.json e shitenno-profile
10. **Desenvolvimento** — comandos npm (dev, build, test, typecheck, lint, bench)
11. **Testes** — estatísticas atualizadas
12. **Segurança** — medidas implementadas
13. **Licença**

**Conteúdo do novo README:**

```markdown
# Shitenno

> Framework de governança de IA que cresce com seu projeto — scoring, detecção de padrões, auditoria de saúde.

Uma ferramenta CLI que analisa a complexidade do seu projeto, detecta padrões no histórico de engenharia e audita a saúde da governança. Ela se adapta ao nível do seu time (Junior / Pleno / Senior) e fornece sugestões acionáveis.

---

## Features

| Comando | Descrição | Status |
|---------|-----------|--------|
| `shugo init` | Inicializa o framework de governança no seu projeto | Estável |
| `shugo status` | Verifica saúde da governança + scoring de complexidade | Estável |
| `shugo detect` | Detecta padrões no histórico e propõe regras candidatas | Estável |
| `shugo audit` | Auditoria metacognitiva da saúde do Shugo | Estável |
| `shugo upgrade` | Atualiza nível de governança (L1 → L2 → L3) | Estável |
| `shugo validate` | Valida integridade da sessão | Estável |
| `shugo sync` | Sincroniza arquivos de governança externos | Estável |
| `shugo clean` | Limpa cache e arquivos temporários | Estável |
| `shugo assess` | Reavalia perfil de maturidade | Estável |
| `shugo doctor` | Diagnósticos e verificações de saúde | Estável |
| `shugo run` | Executa uma tarefa/script específica | Estável |
| `shugo evolve` | Sugere passos de evolução baseados na maturidade | Estável |

---

## Instalação

\`\`\`bash
npm install -g shitenno
\`\`\`

Ou execute diretamente com npx:

\`\`\`bash
npx shitenno status
\`\`\`

### Requisitos

- Node.js ≥ 18.0.0
- Git (recomendado, para métricas comportamentais)

---

## Início Rápido

\`\`\`bash
# 1. Inicializar no seu projeto
shugo init

# 2. Verificar saúde da governança
shugo status

# 3. Detectar padrões
shugo detect

# 4. Auditar saúde da governança
shugo audit
\`\`\`

---

## Comandos

### `shugo init`

Scaffolding completo do framework de governança.

\`\`\`bash
shugo init              # setup interativo
shugo init -d /path     # especificar diretório alvo
shugo init --force      # forçar criação dentro do shitenno-cli
\`\`\`

**O que cria:**
- `opencode.json` — configuração de agentes IA (raiz do projeto)
- `shitenno/` — diretório do framework de governança
- `shitenno-profile/` — perfil do projeto com definições de áreas
- Skills, scripts, docs e templates de governança baseados no nível do time

### `shugo status`

Analisa complexidade do projeto e saúde da governança.

\`\`\`bash
shugo status              # auto-detectar projeto
shugo status -d /path     # especificar diretório
shugo status --no-cache   # pular cache, recalcular
shugo status --json       # saída em formato JSON
\`\`\`

**Saídas:**
- Verificações de saúde da governança (opencode.json, AGENTS.md, skills, scripts, etc.)
- Score de complexidade com métricas estáticas + comportamentais
- Detalhamento por área (contagem de arquivos, churn, superfície sensível, violações, dependências)
- Sugestões acionáveis

### `shugo detect`

Lê histórico e relatórios para detectar padrões recorrentes.

\`\`\`bash
shugo detect              # auto-detectar projeto
shugo detect -d /path     # especificar diretório
shugo detect --json       # saída em formato JSON
\`\`\`

**Detecta:**
- Erros recorrentes (mesma área, 3+ ocorrências)
- Decisões revertidas (padrões de rollback)
- Áreas quentes (scores consistentemente altos)

### `shugo audit`

Auditoria metacognitiva — o sistema avaliando sua própria eficácia de governança.

\`\`\`bash
shugo audit              # auto-detectar projeto
shugo audit -d /path     # especificar diretório
shugo audit --json       # saída em formato JSON
\`\`\`

**Audita:**
- Regras mortas (nunca mencionadas no histórico)
- Pontos de violação (alta taxa de erros)
- Documentação ausente (arquivos críticos faltando)
- Diretórios órfãos (estrutura vazia)
- Context buffer desatualizado

### `shugo upgrade`

Adicione mais capacidades de governança conforme seu projeto cresce.

\`\`\`bash
shugo upgrade                    # seleção interativa de nível
shugo upgrade --level pleno      # atualizar para L2
shugo upgrade --level senior     # atualizar para L3
shugo upgrade --list             # mostrar upgrades disponíveis
\`\`\`

**Níveis:**
- **L1 (Junior):** Docs + Skills + Scripts
- **L2 (Pleno):** + Governança + Context Buffer
- **L3 (Senior):** + Cognição + Contratos + Relatórios + ADRs

### `shugo validate`

Valida integridade da sessão antes de fechar.

\`\`\`bash
shugo validate              # executar todas as verificações
shugo validate --fix        # tentar reparos automáticos
shugo validate --json       # saída em formato JSON
\`\`\`

### `shugo sync`

Sincroniza arquivos de governança de um shitenno externo.

\`\`\`bash
shugo sync --shitenno-path /path/to/shitenno
shugo sync --dry-run        # visualizar mudanças sem aplicar
shugo sync --force          # sobrescrever sem confirmação
\`\`\`

### `shugo clean`

Limpa cache e arquivos temporários.

\`\`\`bash
shugo clean                # limpar cache
shugo clean --all          # limpar cache + relatórios
\`\`\`

### `shugo assess`

Reavalia o perfil de maturidade do projeto.

\`\`\`bash
shugo assess               # reavaliar maturidade
shugo assess -d /path      # especificar diretório
\`\`\`

### `shugo doctor`

Executa diagnósticos de saúde do sistema.

\`\`\`bash
shugo doctor               # executar diagnósticos
shugo doctor --json        # saída em formato JSON
\`\`\`

### `shugo run`

Executa uma tarefa ou script específico.

\`\`\`bash
shugo run <task>           # executar tarefa
\`\`\`

### `shugo evolve`

Sugere passos de evolução baseados no perfil de maturidade atual.

\`\`\`bash
shugo evolve               # sugestões interativas
shugo evolve --json        # saída em formato JSON
\`\`\`

---

## Arquitetura

\`\`\`
shitenno-cli/
├── bin/shugo.ts              # Ponto de entrada CLI (Commander.js)
├── src/
│   ├── analyser.ts           # Análise de projeto & detecção de stack
│   ├── scorer.ts             # Engine de scoring de complexidade (Fase 1)
│   ├── pattern-detector.ts   # Extração de padrões (Fase 2)
│   ├── health-auditor.ts     # Auditoria de saúde da governança (Fase 3)
│   ├── rule-engine.ts        # Engine de regras declarativas
│   ├── plugin-system.ts      # Sistema de extensibilidade
│   ├── event-bus.ts          # Sistema pub/sub
│   ├── cache.ts              # Cache em disco com checksums SHA256
│   ├── scaffolder.ts         # Scaffolding de projetos
│   ├── prompts.ts            # Prompts interativos (inquirer)
│   ├── logger.ts             # Logging centralizado
│   ├── constants.ts          # Constantes compartilhadas
│   ├── errors.ts             # Erros tipados
│   ├── utils.ts              # Utilitários compartilhados
│   ├── shared.ts             # Infraestrutura compartilhada CLI
│   ├── commands/             # Implementações dos comandos CLI
│   ├── templates/            # Template files para scaffolding
│   └── __tests__/            # Testes unitários + integração
├── docs/architecture/        # Documentação de arquitetura
└── shitenno-plugins/            # Plugins de extensibilidade
\`\`\`

### Performance

O engine de scoring utiliza várias otimizações:

- **Batch git log** — Chamada única `git log` para todas as áreas (vs N chamadas separadas)
- **Scoring paralelo por área** — `Promise.all` com interleaving no event loop
- **Cache compartilhado de arquivos** — `FileContentCache` evita leituras repetidas
- **Pré-leitura do histórico** — Passada única sobre o histórico para todas as áreas

### Cache

Resultados são cacheados em `.shitenno-cache.json` na raiz do projeto. O cache é invalidado quando:
- `git HEAD` muda (qualquer commit)
- `package.json` é modificado
- `opencode.json` é modificado
- `shitenno-profile/` ou `shitenno/` mudam

Cache hit: **<1ms** vs 15-106ms sem cache.

---

## Configuração

### `opencode.json` (Raiz do Projeto)

\`\`\`json
{
  "model": "mimo-v2.5-free",
  "agent": {
    "plan": { "role": "planner", "model": "mimo-v2.5-free" },
    "build": { "role": "executor", "model": "deepseek-v4-flash-free" },
    "review": { "role": "auditor", "model": "mimo-v2.5-free" }
  }
}
\`\`\`

### `shitenno-profile/` (Perfil do Projeto)

Gerado automaticamente durante `shugo init`. Define:
- Nome do projeto
- Áreas de código fonte para monitorar
- Palavras-chave sensíveis
- Janela de churn (dias)
- Pesos de scoring

---

## Desenvolvimento

\`\`\`bash
# Instalar dependências
npm install

# Modo desenvolvimento
npm run dev status

# Build
npm run build

# Testes
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Benchmarks
npm run bench
\`\`\`

---

## Testes

- **105+ testes unitários** em 19 arquivos de teste
- **24 testes de integração CLI** (end-to-end)
- **Benchmarks de performance** para engines de scoring, detecção e auditoria

\`\`\`bash
npm test              # executar todos
npm run test:watch    # modo watch
npm run bench         # executar benchmarks
\`\`\`

---

## Segurança

O Shitenno implementa as seguintes medidas de segurança:

- **Allowlist de scripts** — Apenas comandos pré-aprovados podem ser executados via regras
- **Validação de IDs** — Rule IDs são restritos a caracteres alfanuméricos, hífens e underscores
- **Sanitização de regex** — Padrões são validados contra complexidade excessiva
- **Proteção contra prototype pollution** — Acesso a `__proto__`, `constructor` é bloqueado
- **Validação de plugins** — Hooks e nomes são validados antes do registro
- **Cache atômico** — Escrita via temp file + rename previne corrupção

---

## Licença

MIT
```

---

## Ordem de Execução Recomendada

```
Fase 1 (Segurança)
  ├── 1.1 Restringir run_script
  ├── 1.2 Sanitizar rule.id
  ├── 1.3 Proteger contra ReDoS
  ├── 1.4 Sanitizar section
  ├── 1.5 Sanitizar event
  ├── 1.6 Validação de schema para regras
  └── 1.7 Proteger resolveField
  └── 1.8 Validação de plugins

Fase 2 (Qualidade)
  ├── 2.1 Criar logger.ts
  ├── 2.2 Substituir catch { }
  ├── 2.3 Criar constants.ts
  ├── 2.4 Atualizar imports
  ├── 2.5 Criar errors.ts + eliminar process.exit
  ├── 2.6 Corrigir código morto
  ├── 2.7 Adicionar evento faltante
  ├── 2.8 Corrigir imports duplicados
  └── 2.9 Corrigir non-null assertions

Fase 3 (Infraestrutura)
  ├── 3.1 Adicionar ESLint
  ├── 3.2 Melhorar tsconfig
  ├── 3.3 Atualizar .gitignore
  ├── 3.4 Limpar .npmignore
  ├── 3.5 Corrigir race conditions no cache
  ├── 3.6 Limitar event history
  └── 3.7 Limitar FileContentCache

Fase 4 (CI/CD)
  ├── 4.1 Atualizar ci.yml
  ├── 4.2 Atualizar release.yml
  └── 4.3 Adicionar npm audit

Fase 5 (README)
  └── 5.1 Novo README.md
```

---

## Checklist de Validação

Após cada fase, executar:

\`\`\`bash
npm run typecheck    # Tipos corretos
npm run lint         # Sem warnings de lint
npm run build        # Build OK
npm test             # Todos os testes passam
\`\`\`
