# Plano Consolidado — Lote 2 (pendências + achados novos)

**Status:** Refused

**Base:** commit `f88036de506a574f5df3696fc83ece234c14828c` (validado contra o HEAD real de `feat/refactor` no GitHub). Este plano cobre só o que **ainda não foi corrigido** depois do lote 1 (já verificado: P0.2, P0.5, N.3, N.5, E.1, E.5, bugs de `.join()`/ícone, cache do `analyser.ts`, P0 de sessão — todos confirmados por execução real de `tsc`/`eslint`/`vitest`, não repita esse trabalho).

Mesmo formato de sempre: evidência → causa raiz → código. Passe direto ao agente.

---

# P0 — Fechar o bloco "gate de done" (a única frente do lote 1 que ficou pra trás)

Estes três seguem sendo a mesma área de código e o mesmo tipo de bug — implementar juntos.

## P0.1 — Timeouts de `checkBuild`/`checkTests` ainda em 60s/120s

**Evidência:** suíte real mede 108–139s dependendo da máquina; `checkTests` usa `timeout: 120_000`. Sem margem.

```ts
// src/plan/checks.ts
export function checkBuild(projectRoot: string): CompletionCheck {
  try {
    execSync("npx tsc --noEmit", { cwd: projectRoot, encoding: "utf-8", timeout: 180_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "BUILD", passed: true, message: "TypeScript compilation succeeded" };
  } catch (err) {
    return { name: "BUILD", passed: false, message: describeExecError(err, "TypeScript compilation") };
  }
}

export function checkTests(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  const scriptName = pkg?.scripts?.["test:unit"] ? "test:unit" : pkg?.scripts?.["test"] ? "test" : null;
  if (!scriptName) return { name: "TESTS", passed: false, message: "No 'test' or 'test:unit' script in package.json" };
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run(scriptName)}`, { cwd: projectRoot, encoding: "utf-8", timeout: 300_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "TESTS", passed: true, message: `${scriptName} passed` };
  } catch (err) {
    return { name: "TESTS", passed: false, message: describeExecError(err, scriptName) };
  }
}

// Diferencia timeout de falha real — hoje as duas mensagens ficam idênticas
function describeExecError(err: unknown, label: string): string {
  const isTimeout = err && typeof err === "object" && "signal" in err && (err as { signal?: string }).signal === "SIGTERM";
  if (isTimeout) return `${label} timed out — increase the timeout constant in plan/checks.ts or split the suite`;
  return `${label} failed: ${extractExecError(err).slice(0, 300)}`;
}
```

## P0.2 — `validatePlanFormat` continua fora de `runAutoVerification` (`plan done` não checa formato)

**Evidência:** `validatePlanFormat` só é chamada em `commands/plan.ts` (`runPrepare`). `runAutoVerification` (chamada por `plan done`) segue importando só `[checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation]`.

```ts
// src/plan/checks.ts — novo check
import { validatePlanFormat } from "../plan-format-validator.js";
import { readFileSync } from "node:fs";

export function checkPlanFormat(filePath: string): CompletionCheck {
  try {
    const content = readFileSync(filePath, "utf-8");
    const result = validatePlanFormat(filePath, content);
    if (result.errors.length > 0) {
      return { name: "FORMAT", passed: false, message: `Plan format errors: ${result.errors.map(e => e.message).join("; ")}` };
    }
    return { name: "FORMAT", passed: true, message: result.warnings.length > 0 ? `Passed with ${result.warnings.length} warning(s)` : "Format valid" };
  } catch (error) {
    return { name: "FORMAT", passed: false, message: `Could not validate format: ${String(error)}` };
  }
}
```

```ts
// src/plan/verification.ts
import { checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation, checkPlanFormat } from "./checks.js";

export function runAutoVerification(shitennoDir: string, projectRoot: string, planId: string): VerificationRecord {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const plan = engine.getById(planId);

  const checks: CompletionCheck[] = [
    checkPlanFormat(plan.filePath), // primeiro — mais barato, falha rápido
    checkBuild(projectRoot),
    checkTests(projectRoot),
    checkLint(projectRoot),
    checkGateIntegrity(projectRoot),
    checkDocumentation(projectRoot),
  ];
  // ...resto igual
}
```

## P0.3 — Teste-canário `done-entrypoints-coverage.test.ts` continua hardcoded e desatualizado

**Evidência:** ainda é um snapshot de arrays digitados à mão, sem importar `checks.ts`. `LIFECYCLE_CHECKS` continua sem `DOCS` (que existe de verdade) e, depois do P0.2 acima, também vai faltar `FORMAT`.

```ts
// src/__tests__/done-entrypoints-coverage.test.ts
import { describe, it, expect } from "vitest";
import { checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation, checkPlanFormat } from "../plan/checks.js";

// Deriva os nomes reais dos checks a partir do código, não de uma lista digitada.
// Roda cada check num projeto mínimo/mockado só para extrair o `name` retornado —
// ou, mais simples, exporte uma constante `CHECK_NAMES` em checks.ts e importe aqui.
const PIPELINE_GATES = ["tests", "lint", "documentation", "backlog", "plan_status"];

describe("cobertura das duas portas de entrada para done", () => {
  it("LIFECYCLE_CHECKS bate com os checks reais de runAutoVerification", () => {
    // ver alternativa mais simples abaixo
  });
});
```

**Alternativa mais simples e robusta** (evita rodar os checks de verdade dentro do teste): exportar uma constante única de `checks.ts` e importar tanto em `verification.ts` quanto no teste, para que os dois nunca possam divergir:

```ts
// src/plan/checks.ts
export const LIFECYCLE_CHECK_NAMES = ["FORMAT", "BUILD", "TESTS", "LINT", "GATE_SELF_TEST", "DOCS"] as const;
```

```ts
// src/__tests__/done-entrypoints-coverage.test.ts
import { LIFECYCLE_CHECK_NAMES } from "../plan/checks.js";

const PIPELINE_GATES = ["tests", "lint", "documentation", "backlog", "plan_status"];

describe("cobertura das duas portas de entrada para done", () => {
  it("snapshot dos conjuntos de gate — mudança exige atualizar o comentário cruzado", () => {
    expect(PIPELINE_GATES).toMatchSnapshot();
    expect(LIFECYCLE_CHECK_NAMES).toMatchSnapshot();
  });
});
```

Isso não elimina 100% o risco (ainda é possível esquecer de adicionar um check novo ao array `LIFECYCLE_CHECK_NAMES`), mas move a fonte da verdade para dentro de `checks.ts`, no mesmo arquivo onde os checks são definidos — reduz a distância entre "adicionar um check" e "esquecer de declarar que ele existe" a uma linha no mesmo arquivo, em vez de dois arquivos desconectados.

**Implementar P0.1 → P0.2 → P0.3 juntos.** Depois, rodar `shugo plan done <id>` num plano real para confirmar que os 6 checks aparecem e que o `FORMAT` de fato bloqueia um plano mal formatado.

---

# P1 — Dois bugs novos, nascidos nesta última sessão

Vocês criaram `mcp-cache.ts` e `session-bootstrapper.ts` no lote 1 (antes eram arquivos fantasma). Os dois já nasceram com bug.

## Novo Bug A — `mcp-cache.ts:getCacheStats()` retorna zeros hardcoded

**Evidência:** o arquivo chama `recordHit("mcp-cache")`/`recordMiss("mcp-cache")` de verdade (de `cache-metrics.ts`), mas sua própria função pública `getCacheStats()` ignora esses contadores:

```ts
// src/mcp-cache.ts — código atual
export function getCacheStats(): { size: number; hitRate: number; totalHits: number; totalMisses: number } {
  // This would need to be tracked in production
  return { size: cacheStore.size, hitRate: 0, totalHits: 0, totalMisses: 0 };
}
```

**Correção:**

```ts
// src/mcp-cache.ts
import { getCacheStats as getMetrics } from "./cache-metrics.js";

export function getCacheStats(): { size: number; hitRate: number; totalHits: number; totalMisses: number } {
  const m = getMetrics("mcp-cache");
  return { size: cacheStore.size, hitRate: m.hitRate, totalHits: m.hits, totalMisses: m.misses };
}
```

## Novo Bug B — `session-bootstrapper.ts` ignora glob pattern silenciosamente

**Evidência:**

```ts
// src/session-bootstrapper.ts — código atual
if (relativePath.includes("*")) {
  // For now, skip glob patterns - would need proper implementation
  continue;
}
```

A entrada `agent-contracts` (`governance/agents/*.yaml`) nunca é carregada. Padrão usado no projeto é sempre `dir/*.ext` (um nível, sem glob recursivo) — não precisa de lib externa:

```ts
// src/session-bootstrapper.ts
if (relativePath.includes("*")) {
  const lastSlash = relativePath.lastIndexOf("/");
  const dirPart = relativePath.substring(0, lastSlash);
  const filePattern = relativePath.substring(lastSlash + 1); // ex: "*.yaml"
  const ext = filePattern.startsWith("*.") ? filePattern.slice(1) : null; // ex: ".yaml"
  const dirPath = join(shitennoDir, dirPart);

  if (ext && existsSync(dirPath)) {
    for (const file of readdirSync(dirPath).filter((f) => f.endsWith(ext))) {
      const content = loadFileWithCache(shitennoDir, join(dirPart, file));
      if (content) {
        // mesmo tratamento aplicado ao caso não-glob logo abaixo neste loop —
        // reaproveitar a mesma lógica de push/registro, só mudando a origem do content
      }
    }
  }
  continue;
}
```

Ajustar os imports de `readdirSync`/`join`/`existsSync` no topo do arquivo se ainda não estiverem lá.

---

# P1 — Pendências do lote anterior (não implementadas, sem mudança desde a última validação)

## `notificationStats` continua `null` para sempre

```ts
// src/desktop-notifier.ts — dentro de throttledNotify(), dois pontos:
// 1) quando dispara de verdade (high, ou low/medium fora de cooldown)
// 2) quando é throttled

// Sugestão: um helper central que os dois caminhos chamam
function recordNotificationStat(shitennoDir: string, sent: boolean): void {
  // ler/atualizar/gravar no daemon state via IPC ou arquivo compartilhado —
  // depende de como daemon/state.ts é acessado a partir daqui (verificar se
  // desktop-notifier.ts já tem acesso ao ctx.state do daemon; se não, expor
  // uma função em daemon/state.ts tipo `recordNotificationStat(sent: boolean)`
  // e chamá-la nos dois pontos acima)
}
```

```ts
// src/daemon/state.ts
export function recordNotificationStat(state: DaemonState, sent: boolean): void {
  if (!state.notificationStats) {
    state.notificationStats = { sent: 0, throttled: 0, last24hWindow: new Date().toISOString() };
  }
  if (sent) state.notificationStats.sent++;
  else state.notificationStats.throttled++;
}
```

(Se `desktop-notifier.ts` não tiver acesso direto ao `DaemonState`, expor essa função pelo mesmo canal que `logNotificationOnly` já usa — provavelmente vale publicar um evento interno tipo `notification.sent`/`notification.throttled` no event bus e deixar o daemon incrementar o próprio state ao escutar, em vez de acoplar os dois módulos diretamente.)

## `task-pipeline.ts` continua órfão

**Ação:** confirmar com `git log -p -- src/task-pipeline.ts` se foi substituído por `task-completion-pipeline.ts`. Se sim:

```bash
git rm src/task-pipeline.ts src/__tests__/task-pipeline.test.ts
```

Se o teste cobre algum caso que `task-completion-pipeline.test.ts` não cobre, migrar esse caso antes de remover.

## `audit.standard` — dois subscribers, zero publishers, ainda não investigado

**Evidência:** `daemon/event-handlers.ts:274` e `daemon/semantic-runner.ts` (`ALL_EVENT_TYPES`) assinam `audit.standard`; nenhum lugar do código publica esse evento.

**Ação (investigação, não é um patch pronto):**
```bash
git log --all -p -S'"audit.standard"' -- src/ | grep -B5 "publish"
```
Se aparecer um `publish("audit.standard", ...)` que foi removido em algum commit, é regressão — restaurar o publish no local certo (provavelmente em `src/audit/` ou onde quer que `runPeriodicAudit`/comando `audit` finalize). Se nunca existiu, decidir entre publicar de verdade (no fim de uma auditoria padrão) ou remover os dois subscribers e o tipo do `ShitennoEventType`.

## `policy-engine.ts` — deprecated, ainda exportado

```bash
grep -rn "from [\"'].*policy-engine.js[\"']" src --include=*.ts
# se o único resultado for o próprio arquivo/testes, remover:
git rm src/policy-engine.ts
```

## `isConsolidating` — flag global sem lock cross-processo

```ts
// src/engineering-state.ts
import { lockSync, unlockSync } from "proper-lockfile"; // ou implementação própria com arquivo .lock + O_EXCL

function consolidateEngineeringState(projectRoot: string, shitennoDir: string) {
  const lockPath = join(shitennoDir, "engineering-state.lock");
  let release: (() => void) | null = null;
  try {
    release = lockSync(lockPath, { retries: { retries: 5, minTimeout: 100 } });
  } catch {
    return buildReentrantState(projectRoot, shitennoDir); // outro processo já está consolidando
  }
  try {
    // ...lógica atual de consolidação
  } finally {
    release?.();
  }
}
```

Se não quiser adicionar dependência nova, um lock por arquivo com `writeFileSync(lockPath, pid, { flag: "wx" })` (falha se já existir) + `unlinkSync` no `finally` resolve o caso comum, sem cobrir 100% das race conditions de um lockfile de verdade — suficiente para o caso daemon+CLI concorrentes.

## `cache.ts` (`dirChecksum`) e `risk-map.ts` (`getChurnData`) sem cache adicional

Baixa prioridade, mas rápido:

```ts
// src/cache.ts
const dirStructureCache = new Map<string, { mtimeMs: number; checksum: string }>();

function dirChecksum(dirPath: string, maxDepth = 3): string {
  const dirStat = existsSync(dirPath) ? statSync(dirPath) : null;
  if (dirStat) {
    const cached = dirStructureCache.get(dirPath);
    if (cached && cached.mtimeMs === dirStat.mtimeMs) return cached.checksum;
  }
  // ...cálculo atual...
  if (dirStat) dirStructureCache.set(dirPath, { mtimeMs: dirStat.mtimeMs, checksum /* resultado calculado */ });
  return checksum;
}
```

```ts
// src/risk-map.ts
let churnCache: { data: Map<string, number>; computedAt: number } | null = null;
const CHURN_TTL_MS = 5 * 60 * 1000;

function getChurnData(projectRoot: string): Map<string, number> {
  if (churnCache && Date.now() - churnCache.computedAt < CHURN_TTL_MS) return churnCache.data;
  // ...execSync atual...
  churnCache = { data, computedAt: Date.now() };
  return data;
}
```

## `knowledge-loader.ts` — leitura completa de arquivo só para listar metadado

```ts
// src/knowledge-loader.ts
export function listAdrs(shitennoDir: string): AdrSummary[] {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return [];
  return readdirSync(adrDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE"))
    .map((filename) => {
      const head = readHeadOfFile(join(adrDir, filename), 2048); // só as primeiras ~2KB, onde o frontmatter mora
      // ...parse do frontmatter a partir de `head`, não do arquivo inteiro
    });
}

function readHeadOfFile(path: string, maxBytes: number): string {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = readSync(fd, buf, 0, maxBytes, 0);
    return buf.toString("utf-8", 0, bytesRead);
  } finally {
    closeSync(fd);
  }
}
```

Aplicar o mesmo padrão em `listSkills()`.

---

# Ordem de execução sugerida

1. **P0.1 + P0.2 + P0.3** — mesmo bloco de sempre, maior valor, ~1-2h. Validar com `shugo plan done` real no fim.
2. **Novo Bug A + Novo Bug B** — pequenos, mesma área temática (caches/loaders recém-criados), ~30 min juntos.
3. **`notificationStats`** — depende de decidir o mecanismo de acesso ao `DaemonState` a partir de `desktop-notifier.ts`; se for mais simples via evento, considerar isso primeiro antes de escrever código.
4. **`task-pipeline.ts` órfão + `policy-engine.ts` deprecated** — limpeza rápida, mesma PR.
5. **`audit.standard`** — comece pela investigação via `git log`, decisão vem depois do resultado.
6. **`isConsolidating`, caches de `cache.ts`/`risk-map.ts`, `knowledge-loader.ts`** — sem urgência, agrupar numa PR de "performance" quando sobrar tempo.

Depois de 1, rode `shugo plan done` num plano de teste com formato quebrado de propósito para confirmar que agora ele bloqueia. Depois de 2, confirme manualmente que `shugo mcp` reporta hit rate real (não zero) numa segunda chamada repetida ao mesmo handler, e que um arquivo em `governance/agents/*.yaml` de teste é carregado pela sessão.
