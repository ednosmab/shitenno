# PLAN-2026-07-19 — MASTER 3/3: Estrutura e Cobertura de Teste

**Status:** Done
**Updated_at:** 2026-07-22T04:21:41.331Z
**Date:** 2026-07-20

**Continuação de `PLAN-2026-07-19-MASTER-1-integridade-gate.md` e `PLAN-2026-07-19-MASTER-2-correcao-dados-e-checks.md`. Cobre M.11, M.12, M.13. Prioridade baixa em relação às duas partes anteriores — nenhum item aqui é regressão ativa ou bypass de segurança, é dívida estrutural e cobertura.**

---

## M.11 — Barrel de `engineering-state/`: só falta um consumidor (melhor do que parecia)

**Boa notícia desta auditoria:** o barrel em `src/engineering-state/index.ts` está **bem mais completo** do que a avaliação anterior sugeria — já reexporta `mutations.ts` inteiro (`getMutationLog`, `clearMutationLog`, `proposeStateMutation`), junto com todos os outros submódulos. Rodando o grep de verificação contra o código atual, sobrou só **um** consumidor de produção fora do padrão:

```
src/commands/status.ts:257:  const { subscribeToEngineeringState } = await import("../engineering-state/subscription.js");
```

(`src/__tests__/orphaned-modules.test.ts` também importa `access.js` direto, mas é um teste que existe especificamente pra verificar que o módulo não está órfão/morto — faz sentido que ele acesse o arquivo direto, não precisa mudar.)

**Ficheiro:** `src/commands/status.ts`, linha 257

```typescript
// Antes:
const { evaluateCapabilities } = await import("../capability-engine.js");
const { subscribeToEngineeringState } = await import("../engineering-state/subscription.js");

// Depois:
const { evaluateCapabilities } = await import("../capability-engine.js");
const { subscribeToEngineeringState } = await import("../engineering-state/index.js");
```

**Teste de arquitetura pra fechar isso de vez** (evita esse tipo de desvio pontual voltar a acontecer sem ninguém notar):

```typescript
// Novo ficheiro: src/__tests__/engineering-state-barrel.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("nenhum consumidor de produção importa submódulo de engineering-state/ direto", () => {
  it("só o barrel (index.js) é importado fora da própria pasta", () => {
    const offenders: string[] = [];
    function scan(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() && !full.includes("node_modules") && !full.endsWith("engineering-state")) {
          scan(full);
        } else if (entry.name.endsWith(".ts") && !full.includes("engineering-state/") && !full.includes("__tests__")) {
          const content = readFileSync(full, "utf-8");
          if (/engineering-state\/(access|discovery|evolved|history|io|mutations|subscription)\.js/.test(content)) {
            offenders.push(full);
          }
        }
      }
    }
    scan(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});
```

**Critério de aceite:** `npx vitest run src/__tests__/engineering-state-barrel.test.ts` passa.

---

## M.12 — Testes E2E de comando, Tier 1 (mutam estado) — ainda não cobertos

**Situação confirmada:** `cli-integration.test.ts` tem 9 blocos `describe("shugo ...")` — `--help`, `init` (incluindo o novo scaffold do H.1), `status`, `detect`, `audit`, `upgrade`, `validate`, `run`. Nenhum dos comandos que **mutam estado** — `act`, `plan md`, `decide`, `hooks`, `update`, `clean`, `sync` — tem teste E2E via processo real ainda. É o Tier 1 do plano de testes por risco, que continua sendo o mais importante de fechar (comandos read-only continuam Tier 3, baixa prioridade, ok deixar pra depois).

Adicionar como novos blocos `describe` em `cli-integration.test.ts`, reaproveitando `runShugo()` e `scaffoldTestProject()` já existentes no arquivo:

```typescript
describe("shugo act", () => {
  let dir: string;
  beforeEach(() => { dir = scaffoldTestProject("act").dir; });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("executes a valid action and returns success JSON", async () => {
    const { stdout, exitCode } = await runShugo(`act reminder --message "test reminder" --priority medium --json`, dir);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).success).toBe(true);
  });

  it("is idempotent for the same --action-id", async () => {
    const first = await runShugo(`act reminder --message "dup" --action-id ACT-DUP-001 --json`, dir);
    const second = await runShugo(`act reminder --message "dup" --action-id ACT-DUP-001 --json`, dir);
    expect(JSON.parse(second.stdout).executionId).toBe(JSON.parse(first.stdout).executionId);
  });
});

describe("shugo plan md", () => {
  let dir: string;
  beforeEach(() => { dir = scaffoldTestProject("plan-md").dir; });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("creates, lists, shows and marks done end-to-end, gated by real verification", async () => {
    const create = await runShugo(`plan md create "Test plan E2E" --json`, dir);
    const { id: planId } = JSON.parse(create.stdout);

    const list = await runShugo(`plan md list --json`, dir);
    expect(JSON.parse(list.stdout).some((p: { id: string }) => p.id === planId)).toBe(true);

    // Depois do fix de M.4, "done" roda verificação real — este teste só
    // funciona de verdade num projeto scaffolded com build/test/lint válidos.
    const done = await runShugo(`plan md done ${planId} --json`, dir);
    const record = JSON.parse(done.stdout);
    expect(record.passed).toBe(true);
    expect(existsSync(join(dir, ".shitenno", "governance", "plans", "done", `${planId}.md`))).toBe(true);
    expect(existsSync(join(dir, ".shitenno", "governance", "plans", "done", `${planId}.verification.json`))).toBe(true);
  });
});

describe("shugo decide", () => {
  let dir: string;
  beforeEach(() => { dir = scaffoldTestProject("decide").dir; });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("records a decision and retrieves it by id", async () => {
    const record = await runShugo(`decide "Use PostgreSQL over SQLite" --category architecture --risk medium --impact high --json`, dir);
    const decision = JSON.parse(record.stdout);
    expect(decision.id).toBeDefined();
    const retrieved = await runShugo(`decide history ${decision.id} --json`, dir);
    expect(JSON.parse(retrieved.stdout).category).toBe("architecture");
  });
});

describe("shugo hooks", () => {
  let dir: string;
  beforeEach(() => {
    dir = scaffoldTestProject("hooks").dir;
    execSync("git init -q", { cwd: dir });
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("installs hooks and they appear in .git/hooks", async () => {
    const { exitCode } = await runShugo(`hooks`, dir);
    expect(exitCode).toBe(0);
    expect(existsSync(join(dir, ".git", "hooks", "pre-commit"))).toBe(true);
  });
});

describe("shugo update", () => {
  let dir: string;
  let snapshotBefore: string;
  beforeEach(() => {
    dir = scaffoldTestProject("update").dir;
    snapshotBefore = readFileSync(join(dir, ".shitenno", "governance", "rule-manifest.yaml"), "utf-8");
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("--dry-run reports changes without touching any file", async () => {
    const { exitCode, stdout } = await runShugo(`update --dry-run --json`, dir);
    expect(exitCode).toBe(0);
    expect(readFileSync(join(dir, ".shitenno", "governance", "rule-manifest.yaml"), "utf-8")).toBe(snapshotBefore);
    expect(Array.isArray(JSON.parse(stdout).changes)).toBe(true);
  });
});

describe("shugo clean", () => {
  let dir: string;
  beforeEach(() => {
    dir = scaffoldTestProject("clean").dir;
    writeFileSync(join(dir, "important-user-file.txt"), "não pode sumir");
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("removes only Shugo-internal transient state, never user files", async () => {
    const { exitCode } = await runShugo(`clean --json`, dir);
    expect(exitCode).toBe(0);
    expect(existsSync(join(dir, "important-user-file.txt"))).toBe(true);
  });
});

describe("shugo sync", () => {
  let dir: string;
  beforeEach(() => { dir = scaffoldTestProject("sync").dir; });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("--dry-run shows diff without writing", async () => {
    const target = join(dir, ".shitenno", "governance", "WORKFLOW.md");
    const before = readFileSync(target, "utf-8");
    const { exitCode } = await runShugo(`sync --dry-run --json`, dir);
    expect(exitCode).toBe(0);
    expect(readFileSync(target, "utf-8")).toBe(before);
  });
});
```

**Import a conferir/adicionar no topo de `cli-integration.test.ts`:** `readdirSync`, `readFileSync`, `existsSync`, `writeFileSync` de `node:fs`, `execSync` de `node:child_process` (checar quais já estão importados antes de duplicar).

**Critério de aceite:** cada bloco passa isolado; nenhum usa mock de filesystem (é o ponto de ser E2E — um mock teria escondido o próprio bug do `.verification.json` órfão que o Bloco F corrigiu).

---

## M.13 — Branch protection (G.1) — checklist operacional, não código

Continua fora do escopo de qualquer arquivo pra passar ao agente — é configuração no GitHub (ou equivalente):

1. Marcar como **required status check** no branch padrão: o job de CI que roda `npx tsx scripts/verify-done-plans.ts`, e o job que roda `npm run build && npx vitest run`.
2. Ativar **"Require branches to be up to date before merging"**.
3. Restringir push direto na branch padrão (sem PR).

**Fazer isso só depois de M.9 (backlog) estar corrigido** — senão o primeiro PR que o branch protection vai barrar é a própria tentativa de consertar o passado.

**Armadilha a não esquecer** (já registrada nos blocos anteriores, repetindo aqui porque é fácil de reintroduzir sem querer): nunca configurar o required check comparando `baseCommit`/`commitHash` por igualdade estrita contra o HEAD do commit — é auto-referência impossível, trava todo commit que toque `done/` pra sempre. A validade real vem do `diffHash` (M.2), não de comparação de commit.

**Limite honesto, repetido de propósito:** numa instância solo, o desenvolvedor único normalmente é o admin do repositório — branch protection não impede você, impede o agente de IA de contornar sozinho. Contra decisão humana deliberada de ignorar o processo, nenhuma camada técnica resolve.

---

## Ordem de execução desta parte (3/3)

1. **M.11** — 15 minutos, zero risco.
2. **M.12** — pode ser feito em paralelo com qualquer outra coisa, é só teste novo.
3. **M.13** — por último, depois que Parte 1 e Parte 2 estiverem implementadas e estáveis.

---

## Fechamento — as três partes juntas

| Parte | Cobre | Prioridade |
|---|---|---|
| 1/3 — Integridade do Gate | M.1-M.7 | 🔴 Fazer primeiro, tem regressão ativa e bypass sem gate |
| 2/3 — Correção de Dados e Checks | M.8-M.10 | 🟡 Fazer em seguida, um deles (M.10) é pré-requisito de confiança pro resto |
| 3/3 — Estrutura e Cobertura | M.11-M.13 | 🟢 Baixo risco, pode esperar |

Depois de **cada item individual**, sem exceção: `npm run build && npx vitest run`. Depois de **cada parte completa**: rodar `shugo audit --level enterprise` e conferir que nenhum achado novo de `governance_integrity` apareceu — é o próprio sistema se auto-verificando, que é o objetivo desde o início desta auditoria.
