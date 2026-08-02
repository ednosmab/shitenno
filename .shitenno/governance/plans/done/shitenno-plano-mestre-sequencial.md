# Shitenno — Plano Mestre Sequencial

**Status:** Done

> Consolida em um único documento tudo que está em andamento nesta linha de trabalho, na ordem acordada:
> **Fase A** (bugs + pipeline, já detalhada) → **Fase B** (overhead de governança/contexto, queixas do agente) → **Fase C** (unificar orquestração de ação, decision-core ⇄ ActionEngine) → **Fase D** (MCP inteligente, bloqueada até A–C fecharem).
>
> Só a Fase A tem todos os itens já validados rodando código real. As demais têm graus diferentes de prontidão — marcados em cada seção.

---

## FASE A — Bugs pendentes + Pipeline de validação contínua

**Status:** pronta para aplicar. Todos os itens abaixo foram reconfirmados rodando código real na v4 desta sessão (não regrediram, mas também não avançaram desde a rodada anterior).

### A1. JSON pollution — `console.log` fora do gate

**Onde:** `bin/shugo.ts`, função `showBriefingSummary`.

```ts
// src/output.ts — adicionar getter (hoje só existe o setter)
let globalJsonMode = false;
export function setGlobalJsonMode(enabled: boolean): void { globalJsonMode = enabled; }
export function isGlobalJsonMode(): boolean { return globalJsonMode; } // NOVO
```

```ts
// bin/shugo.ts
async function showBriefingSummary(projectRoot: string, shitennoDir: string): Promise<void> {
  if (isGlobalJsonMode()) return; // NOVO — primeira linha
  console.log(chalk.gray("  📋 Quick Board:"));
  // ...resto igual
}
```

**Resolver a causa, não só o sintoma:**
```bash
grep -rln "console\.\(log\|error\|warn\)\|process\.stdout\.write" bin src --include="*.ts" | grep -v __tests__ | grep -v "src/output.ts\|src/logger.ts"
```
Cada resultado é candidato ao mesmo bug — revisar todos, não só `showBriefingSummary`.

**Validação:** `shugo init` + `shugo audit --json > out.json` num projeto real → `node -e "JSON.parse(require('fs').readFileSync('out.json'))"` sem erro.

---

### A2. Resíduo de auto-hospedagem `shitenno-go`

**Onde:** `src/health-auditor.ts:59`.

```ts
// ATUAL
const isAuditingShitennoItself = projectRoot.includes("shitenno-go");
// DEPOIS
const isAuditingShitennoItself = existsSync(join(projectRoot, ".shitenno-self"));
```

Criar o arquivo marcador `.shitenno-self` (vazio) na raiz do próprio repositório Shitenno.

**Validação:** `grep -rn "shitenno-go\|shitenno-cli\|shitenno-feat-refactor" src --include="*.ts" | grep -v __tests__` retorna vazio.

---

### A3. Dependência quebrada — `npm install` falha sem `--legacy-peer-deps`

**Onde:** `package.json` — `eslint@^10.6.0` incompatível com peer de `eslint-plugin-jsx-a11y@6.10.2` (aceita só até `eslint@^9`).

```bash
npm info eslint-plugin-jsx-a11y versions --json   # checar se já existe versão compatível com eslint 10
# se não houver:
npm install eslint@^9 --save-dev
```

**Validação:** `rm -rf node_modules package-lock.json && npm install` (sem flags) termina com exit 0.

---

### A4. Teste de congelamento FRZ-01 nunca foi criado

**Onde:** novo arquivo `src/__tests__/engine-freeze.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("FRZ-01: freeze on new engine/detector/analyser files", () => {
  it("does not exceed the frozen baseline count", () => {
    const output = execSync(
      `find src -name "*-engine.ts" -o -name "*-detector.ts" -o -name "*-analyser.ts" | grep -v __tests__ | wc -l`,
      { encoding: "utf-8" }
    ).trim();
    // Baseline real medido nesta sessão: 52 (subiu de 48 sem gate — abrir ADR se
    // a intenção é encerrar o freeze conscientemente, não fingir que ainda é 48).
    const BASELINE = 52;
    expect(Number(output)).toBeLessThanOrEqual(BASELINE);
  });
});
```

---

### A5. Gate F-06 no CI ainda é `--report-only`

**Onde:** `.github/workflows/ci.yml:27`.

```yaml
# ATUAL
- name: Check file size limit (F-06)
  run: bash scripts/check-file-size.sh --report-only
# DEPOIS — usa modo baseline, só bloqueia regressão NOVA
- name: Check file size limit (F-06)
  run: bash scripts/check-file-size.sh
```

Confirmar antes que `check-file-size.sh` tem o modo baseline implementado (compara contra `scripts/file-size-baseline.txt`), senão todo PR vai falhar por causa das violações antigas.

---

### A6. Regressão em `plan-lifecycle.test.ts` — causa raiz confirmada

**Onde:** `src/plan/management.ts` + `src/__tests__/plan-lifecycle.test.ts`.

`detectActivePlans`/`checkAndArchiveDonePlans` têm `if (!existsSync(plansDir)) return [...]` rodando contra filesystem real; o teste mocka `MarkdownPlanEngine` mas nunca `existsSync`.

```ts
// src/__tests__/plan-lifecycle.test.ts — adicionar junto aos outros vi.mock
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) };
});
```

**Validação:** `npx vitest run src/__tests__/plan-lifecycle.test.ts` — 0 falhas.

---

### A7. Pipeline de CI — para de depender de auditoria manual

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }

      - name: Clean install (no legacy flags)
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      # Pega o que typecheck NÃO pega: erro de interop ESM/CJS em runtime
      # (foi o bug que quebrou a CLI inteira — "fs-extra" named import)
      - name: Build
        run: npm run build
      - name: Smoke test — CLI actually runs
        run: |
          node dist/bin/shugo.js --version
          node dist/bin/shugo.js --help > /dev/null

      - name: Unit tests
        run: npm run test:unit

      # Pega a poluição de stdout em --json (sobreviveu 3 rodadas sem correção)
      - name: JSON contract check
        run: |
          mkdir -p /tmp/json-contract-test && cd /tmp/json-contract-test
          git init -q && git config user.email t@t.com && git config user.name t
          echo "console.log(1)" > index.js && git add -A && git commit -q -m init
          node $GITHUB_WORKSPACE/dist/bin/shugo.js init --answers-file $GITHUB_WORKSPACE/scripts/ci-answers.json
          node $GITHUB_WORKSPACE/dist/bin/shugo.js audit --json > audit-out.json
          node -e "JSON.parse(require('fs').readFileSync('audit-out.json','utf-8'))" || (echo "❌ --json produced invalid JSON" && exit 1)

      - name: File size gate (F-06)
        run: bash scripts/check-file-size.sh

      - name: Engine freeze gate (FRZ-01)
        run: npx vitest run src/__tests__/engine-freeze.test.ts

      - name: Known-risk pattern scan
        run: bash scripts/scan-risk-patterns.sh
```

`scripts/scan-risk-patterns.sh` (novo — automatiza a varredura sistemática, já detalhado na versão anterior deste plano):

```bash
#!/usr/bin/env bash
set -euo pipefail
FAILED=0

echo "→ fail-open patterns (aviso, não bloqueia)..."
HITS=$(grep -rn "!== false\|?? true\b" src --include="*.ts" | grep -v __tests__ || true)
[ -n "$HITS" ] && { echo "⚠️  Review manually:"; echo "$HITS"; }

echo "→ console.* fora de output.ts/logger.ts (bloqueante)..."
HITS=$(grep -rln "console\.\(log\|error\|warn\)" bin src --include="*.ts" | grep -v __tests__ | grep -v "src/output.ts\|src/logger.ts" || true)
[ -n "$HITS" ] && { echo "❌ $HITS"; FAILED=1; }

echo "→ resíduo de self-hosting (bloqueante)..."
HITS=$(grep -rln "shitenno-go\|shitenno-cli\|shitenno-feat-refactor" src --include="*.ts" | grep -v __tests__ || true)
[ -n "$HITS" ] && { echo "❌ $HITS"; FAILED=1; }

echo "→ fs-extra named imports (bloqueante)..."
HITS=$(grep -rn "^import { .* } from \"fs-extra\"" src bin --include="*.ts" | grep -v __tests__ || true)
[ -n "$HITS" ] && { echo "❌ $HITS"; FAILED=1; }

exit $FAILED
```

**Ordem de execução da Fase A:** A1 → A2 → A3 → A6 (patches pequenos e independentes) → A4 + A5 (gates) → A7 (pipeline completo, por último, pra já nascer testando tudo que veio antes).

---

## FASE B — Overhead de governança/contexto (queixas do agente)

**Status:** ⏳ **não detalhada ainda — de propósito.** O relatório do seu agente estimou "~2000+ tokens de overhead antes de qualquer tarefa produtiva" carregando 8 arquivos (`AGENTS.md`, `context_buffer.yaml`, `MANDATORY_CONTEXT.md`, `skill-manifest.yaml`, `rule-manifest.yaml`, `opencode-context.md`, `DESDO.md`, `FORBIDDEN_OPERATIONS.md`). Antes de propor consolidação, preciso medir esse overhead na versão real que passar a Fase A — não vou propor cortes de governança em cima de uma estimativa de terceiro sem confirmar contra o código.

**O que essa fase vai conter, quando eu tiver a versão pós-Fase A:**
1. Medir o tamanho real de cada um dos 8 arquivos carregados e confirmar (ou corrigir) a estimativa de ~2000 tokens.
2. Mapear duplicação real entre eles (o relatório menciona "~30 checkpoints repetidos" em `context_buffer.yaml` — verificar).
3. Propor consolidação concreta (provavelmente reduzir de 8 arquivos pra 2–3, com carregamento sob demanda em vez de sempre-tudo) com plano de migração que não quebre nada que hoje lê esses arquivos (`getMandatoryContext` no MCP, por exemplo, já lê vários deles — checar acoplamento antes de mexer).
4. Isso se conecta com o **Achado 3** do relatório de eficiência que você me passou (desbalanceamento CLI/daemon/MCP) — meta-decisão de "isso é regra sempre-carregada ou capacidade sob demanda" é o mesmo tipo de decisão dos dois lados.

**Pré-requisito para começar:** você me passar a versão com a Fase A aplicada.

---

## FASE C — Unificar orquestração de ação (`ActionEngine` ⇄ `decision-core`)

**Status:** plano já escrito e **validado por mim contra o código real** (funções, assinaturas e linhas conferidas na v4 — `claimResource`, `releaseResource`, `findIdempotentMatch`, `getResourceId` todos confirmados existindo exatamente como o plano descreve).

**Por que vem depois da Fase B, antes da Fase D:** essa duplicação piora se o MCP ganhar mais poder de disparar ações (é exatamente a direção da Fase D) sem que os dois caminhos de execução (`shugo act` manual vs. regras do daemon) já estejam convergidos. Resolver isso antes evita que o plano de MCP inteligente construa em cima de uma base que vai precisar ser refeita depois.

### Passo 1 — Levar arbitragem de recurso para dentro do decision-core

Hoje `claimResource`/`releaseResource` só é chamado no caminho manual (`action-engine/engine.ts`). `invokeAction()` precisa passar a fazer isso também no modo `"deliberate"`, senão duas execuções manuais concorrentes do mesmo recurso perdem a proteção que têm hoje.

```typescript
// decision-core/invoke.ts
import { claimResource, releaseResource } from "../resource-claims.js";
import { getResourceId } from "./precedence.js";

async function executeWithAudit(
  params: InvokeActionParams,
  executor: ActionExecutor,
): Promise<InvokeResult> {
  const { action, context } = params;

  const resourceId = getResourceId(action.type, action.params as Record<string, unknown>);
  const claimSessionId = resourceId ? claimResource(resourceId, resourceIdToClaimType(resourceId)) : undefined;

  try {
    // ...lógica existente de execução + gravação de record...
  } finally {
    if (resourceId && claimSessionId) releaseResource(resourceId, claimSessionId);
  }
}

function resourceIdToClaimType(resourceId: string): "plan" | "task" {
  return resourceId.startsWith("plan:") ? "plan" : "task";
  // conferir em resource-claims.ts se existem outros claimTypes além desses dois
  // antes de fechar esta função — o mapeamento em action-engine/engine.ts
  // (runWithResources) só cobria plan/task.
}
```

**Critério de aceite:** suíte de testes de `precedence` e `resource-claims` passa com o claim movido para dentro de `invoke.ts`, antes de tocar em `action-engine/engine.ts`.

### Passo 2 — Levar checagem de idempotência para dentro do decision-core

`ActionEngine.findIdempotentMatch()` consulta o `FileExecutionRepository` por `actionId`/`executionHash`; `invokeAction()` calcula o hash mas nunca consulta pra bloquear repetição — confirmei isso lendo `invoke.ts` real.

**Opção A (recomendada):** adicionar a checagem dentro de `invokeAction()`, usando o mesmo `FileExecutionRepository`. Fica correto pros dois modos — se o daemon repetir a mesma ação por engano, também fica protegido.

```typescript
import { FileExecutionRepository, computeExecutionHash } from "../action-engine.js";

let cachedRepo: FileExecutionRepository | undefined;
function getRepo(shitennoDir: string): FileExecutionRepository {
  if (!cachedRepo) cachedRepo = new FileExecutionRepository(shitennoDir);
  return cachedRepo;
}

export async function invokeAction(params: InvokeActionParams): Promise<InvokeResult> {
  const { action, context } = params;

  const executionHash = computeExecutionHash(action.type, action.params as Record<string, unknown>);
  const repo = getRepo(context.shitennoDir);
  const existing = repo.findByHash(executionHash);
  if (existing?.status === "completed") {
    return { success: true, message: `Já executado (idempotente): ${action.type}`, executionId: existing.executionId };
  }

  const policyBlock = runPolicyGate(action, context);
  if (policyBlock) return policyBlock;

  const precedenceBlock = runPrecedenceGate(params);
  if (precedenceBlock) return precedenceBlock;

  const executor = getExecutor(action.type);
  return executeWithAudit(params, executor);
}
```

**Opção B:** manter idempotência só como preocupação do `ActionEngine`, se a decisão for que ações automáticas do daemon nunca devem ser deduplicadas por design. Escolher uma, não misturar.

**Critério de aceite:** teste que dispara a mesma ação duas vezes com o mesmo hash via `invokeAction` diretamente (sem passar por `ActionEngine`) — segunda chamada não executa de novo.

### Passo 3 — Reduzir `ActionEngine.execute()` a uma casca

Com os passos 1 e 2 feitos, `execute()` vira:

```typescript
// action-engine/engine.ts
import { invokeAction } from "../decision-core/invoke.js";
import type { RuleAction, RuleContext } from "../domain/rules/rule.js";

export class ActionEngine {
  constructor(private repo: ExecutionRepository, private shitennoDir: string) {}

  async execute(request: ActionRequest): Promise<ExecutionRecord> {
    const action: RuleAction = { type: request.type as RuleAction["type"], params: request.params as RuleAction["params"] };
    const context: RuleContext = {
      trigger: "manual", eventData: {}, projectRoot: "",
      shitennoDir: this.shitennoDir, timestamp: new Date().toISOString(),
    };

    const result = await invokeAction({ action, context, mode: "deliberate", sessionId: request.id });

    const record = result.executionId ? this.repo.findById(result.executionId) : undefined;
    if (record) return record;

    return this.createFailedRecord(request, computeExecutionHash(request.type, request.params), result.message);
  }

  // registerExecutor, rollback, findById etc. continuam existindo — não fazem
  // parte da duplicação, só execute() fazia.
}
```

**Atenção:** `src/commands/act.ts` usa `ActionEngine` com `registerExecutor` e métodos como `--rollback`/`--list`/`--stats` além de `execute()`. Este passo só toca `execute()` — checar cada uso em `act.ts` antes de remover qualquer outro método.

### Passo 4 — Regressão antes de apagar código antigo

Não apagar `claimResource`/`releaseResource` nem métodos privados antigos de `action-engine/engine.ts` até:

1. Rodar `npm run test:unit` e `npm run test:e2e` inteiros.
2. Rodar manualmente `shugo act script --script "..."` e `shugo act reminder --message "..."`, comparar o `ExecutionRecord` gerado com o formato de antes (mesmos campos, mesmo padrão `EXE-XXXXXXXX`).
3. Só então remover código morto (imports de `resource-claims.js`, `findIdempotentMatch`, `evaluatePolicyGate`, `runWithResources`).

### Passo 5 — Registro vivo de engines (Achado 2, documentação)

Criar/atualizar `.shitenno/docs/ENGINE_REGISTRY.md` listando cada módulo `*-engine*` encontrado (~33 hoje, confirmado por mim nesta sessão — acima dos ~20 estimados no relatório, vale reconferir o número exato ao aplicar este passo) e classificando como `calculo` ou `autoridade`, com uma frase de justificativa cada. Não é refactor de código — é o documento que falta pra próxima engine nova ser classificada sem depender de reler o ADR-009 inteiro. Pode ser feito em paralelo, não depende dos passos 1–4.

**Ordem de execução da Fase C:**
1. Passo 1 (claim de recurso) — isolado, baixo risco.
2. Passo 2 (idempotência) — isolado, baixo risco.
3. Rodar suíte após 1+2, antes de tocar em `ActionEngine`.
4. Passo 3 (reduzir `execute()`).
5. Passo 4 completo (regressão manual + remoção de código morto).
6. Passo 5 (documentação) — paralelo, a qualquer momento.

---

## FASE D — MCP inteligente

**Status:** 🔒 **bloqueada** até A, B e C fecharem. Plano-base já existe (`PLAN-2026-07-25-mcp-adaptive-assistant.md`, dentro do próprio projeto), mas tem um problema de coordenação identificado nesta sessão: a tool `getContext` que ele propõe criar se sobrepõe substancialmente com `getMandatoryContext`, que já existe no código atual e não existia quando aquele plano foi escrito (25/07). O critério de aceite do plano ("`TOOLS` tem 14 items" após adicionar `getContext`) já está desatualizado — hoje já são 14 tools **sem** `getContext`.

**Quando chegar a vez desta fase**, o primeiro passo não é implementar o plano como está — é reconciliar `getContext` vs. `getMandatoryContext` (consolidar em uma tool só, ou documentar a diferença de propósito com clareza) contra o estado real do código depois das Fases A–C, e só então gerar o plano final de implementação.

---

## Resumo da sequência

```
FASE A (pronta)  →  FASE B (a medir)  →  FASE C (pronta)  →  FASE D (bloqueada, precisa reconciliação)
   bugs +              overhead de           decision-core         MCP inteligente
   pipeline            governança            unificado
```

Próximo passo prático: você aplica a Fase A, me manda a versão nova, eu valido rodando de verdade (mesmo processo das últimas 3 rodadas). Se validado, entramos na Fase B — que só existe de fato depois que eu tiver medido o overhead real na versão que você passar.
