# BLOCO O — Otimização da suíte de testes (e do CLI em si)

**Status:** Done
**Updated_at:** 2026-07-22T04:24:33.938Z
**Date:** 2026-07-21

**Contexto:** investigação de por que `npx vitest run` demora tanto. Achado
principal: **não é só arquitetura de teste — é um bug de performance real no
CLI** que os testes só estão expondo. Corrigir ele primeiro (O.1) já resolve
boa parte do problema, inclusive para usuários reais, não só para os testes.

**Números medidos nesta sessão** (ambiente de 1 vCPU — em máquina de
desenvolvimento/CI normal os ganhos de paralelismo do O.4 serão maiores):
- `shugo plan status <id> check` — **12.9s**
- `shugo plan done <id>` — **6.5s**
- Suíte inteira: ~2024 testes unitários mockados ≈ 100s; 41 testes de CLI
  (`cli-integration.test.ts`) ≈ 250-260s. **~2% dos testes = ~70% do tempo.**

---

## O.1 — Bug de colisão de nome no `HEAVY_COMMANDS` (o achado mais valioso)

**Arquivo:** `bin/shugo.ts`

**Problema:** o hook `preAction` decide se roda o bootstrap pesado
(rule-engine, knowledge-graph, capability-engine, proactive-engine, doc-sync,
plan-backlog-sync + *retroactive scan*) checando `actionCommand.name()` —
mas isso retorna o nome do **subcomando folha**, não o caminho completo.
`HEAVY_COMMANDS` tem `"status"` pensando em `shugo status` (dashboard), mas
`shugo plan status <id> <status>` e `shugo daemon status` também têm uma folha
chamada `"status"` e colidem — disparando o bootstrap pesado sem necessidade
nenhuma. Confirmado por medição: `plan status` gasta **quase o dobro** de
`plan done` só por causa dessa colisão.

```bash
grep -rn '\.command("status")' src/commands
# src/commands/plan/md-status.ts:15
# src/commands/daemon.ts:111
```

**Fix — comparar pelo caminho completo do comando, não pela folha:**
```diff
--- a/bin/shugo.ts
+++ b/bin/shugo.ts
@@
+/**
+ * Full space-separated command path (ex: "plan status", "status", "daemon status").
+ * Usar isso em vez de actionCommand.name() evita colisão entre uma folha
+ * "status" de um subcomando (ex: `plan status`) e o comando raiz "status".
+ */
+function fullCommandPath(cmd: import("commander").Command): string {
+  const parts: string[] = [];
+  let c: import("commander").Command | null = cmd;
+  while (c && c.parent) {
+    parts.unshift(c.name());
+    c = c.parent;
+  }
+  return parts.join(" ");
+}
+
 program.hook("preAction", async (_thisCommand, actionCommand) => {
-  if (HEAVY_COMMANDS.has(actionCommand.name())) {
+  if (HEAVY_COMMANDS.has(fullCommandPath(actionCommand))) {
     await ensureHeavyBootstrap();
   }
 });
```

`HEAVY_COMMANDS` continua com os mesmos valores (`"audit"`, `"status"`,
`"mcp"`, `"history"`, `"doctor"`, `"context"`) — como são todos comandos de
nível raiz, o `fullCommandPath` deles já é exatamente igual ao nome, então o
comportamento pretendido não muda. O que muda é que `"plan status"` e
`"daemon status"` deixam de colidir.

**Teste de regressão (não existia nenhum cobrindo isso):**
```ts
// src/__tests__/heavy-bootstrap-scoping.test.ts
it("shugo plan status does NOT trigger heavy bootstrap output", async () => {
  const { dir } = scaffoldTestProject("heavy-scope-plan-status");
  // ... criar PLAN-A.md
  const { stdout } = await runShugo("plan status PLAN-A check", dir);
  expect(stdout).not.toMatch(/proactive-engine|doc-sync-hook|plan-backlog-sync/);
});

it("shugo daemon status does NOT trigger heavy bootstrap output", async () => {
  const { dir } = scaffoldTestProject("heavy-scope-daemon-status");
  const { stdout } = await runShugo("daemon status", dir);
  expect(stdout).not.toMatch(/proactive-engine|doc-sync-hook|plan-backlog-sync/);
});
```

**Impacto esperado:** todo teste (e todo uso real) de `plan status` e
`daemon status` cai de ~13s pra perto do custo-base de um comando leve
(~1.5-2s de cold start do Node, sem o bootstrap pesado).

---

## O.2 — Separar "handler" da fiação do commander (o que permite pular o subprocess)

**Problema:** hoje toda a lógica de cada comando vive dentro do `.action(...)`
do commander, então a única forma de testar é invocando o binário inteiro via
`execAsync("node dist/bin/shugo.js ...")` — cold start do Node + bundle de
9MB + parsing de CLI a cada teste, mesmo quando o teste só quer validar a
lógica de negócio.

**Padrão sugerido:** extrair uma função `handleX(...)` pura/testável de cada
comando, exportada separadamente, e o `.action()` vira só fiação fina que
chama essa função e formata a saída.

**Exemplo concreto em `src/commands/plan/md-done.ts`:**
```diff
--- a/src/commands/plan/md-done.ts
+++ b/src/commands/plan/md-done.ts
@@
+export interface PlanDoneResult {
+  passed: boolean;
+  checks: { name: string; passed: boolean; message: string }[];
+}
+
+/**
+ * Lógica pura do comando `plan done` — sem I/O de terminal, sem commander.
+ * Testável diretamente, em processo, sem spawnar subprocesso.
+ */
+export function handlePlanDone(
+  shitennoDir: string,
+  projectRoot: string,
+  id: string
+): PlanDoneResult {
+  const record = runAutoVerification(shitennoDir, projectRoot, id);
+  return { passed: record.passed, checks: record.checks };
+}
+
 export function registerMdDone(cmd: import("commander").Command) {
   cmd
     .command("done")
     .description("Verify (build/test/lint) and mark markdown plan as done, or block it if verification fails")
     .argument("<id>", "Plan ID")
     .option("--json", "Output as JSON")
     .action((id: string, opts: Record<string, unknown>) => {
       const isJson = opts.json === true;
       const ctx = guardNotInitialized(opts, isJson);
       if (!ctx) return;

       const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
       try {
-        const record = runAutoVerification(shitennoDir, ctx.projectRoot, id);
-        if (isJson) {
-          outputJson({ success: record.passed, planId: id, checks: record.checks });
-        } else if (record.passed) {
+        const result = handlePlanDone(shitennoDir, ctx.projectRoot, id);
+        if (isJson) {
+          outputJson({ success: result.passed, planId: id, checks: result.checks });
+        } else if (result.passed) {
           output(chalk.green(`  ✓ Plan verified and marked as done: ${id}`));
           output(chalk.dim(`    Moved to done/ directory`));
         } else {
           output(chalk.red(`  ✗ Plan blocked — verification failed: ${id}`));
-          for (const check of record.checks.filter((c) => !c.passed)) {
+          for (const check of result.checks.filter((c) => !c.passed)) {
             output(chalk.yellow(`    ${check.name}: ${check.message}`));
           }
         }
       } catch (error) {
         if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
         else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
       }
     });
 }
```

**Teste equivalente, agora em processo (compare com o tempo de 6.5s do subprocess):**
```ts
// src/__tests__/plan-done-handler.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePlanDone } from "../commands/plan/md-done.js";

describe("handlePlanDone (in-process, no subprocess)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plan-done-"));
    mkdirSync(join(dir, ".shitenno/governance/plans"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t" }));
    writeFileSync(
      join(dir, ".shitenno/governance/plans/PLAN-A.md"),
      "# A\n\n**Status:** In Progress\n"
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("blocks when there is no test script", () => {
    const result = handlePlanDone(join(dir, ".shitenno"), dir, "PLAN-A");
    expect(result.passed).toBe(false);
    expect(result.checks.find((c) => c.name === "TESTS")?.message).toMatch(/No 'test' script/);
  });
});
```
Esse teste roda em **milissegundos** (mesma categoria dos 2024 testes rápidos
já existentes), porque não paga cold start de Node nem carrega o bundle de
9MB — chama a função Typescript direto, no mesmo processo do Vitest.

**Escopo de aplicação:** não precisa (nem compensa) converter os 41 testes de
uma vez. Sugestão de ordem, pelos que mais demoram e mais mudam:
1. `plan done`, `plan status` (já cobertos pelos exemplos acima)
2. `detect`, `audit --json` (são os testes mais lentos hoje, cada rodada de
   análise real custa segundos)
3. Os demais, gradualmente, conforme forem sendo tocados por outras mudanças
   (não precisa de um esforço dedicado só pra isso).

---

## O.3 — Manter um núcleo pequeno de testes E2E de verdade (não eliminar, redimensionar)

**Por que não converter os 41 inteiros:** alguns testes existem justamente
pra validar coisas que só o processo real cobre — parsing de argv pelo
commander, exit codes, comportamento com `--json` na saída real do processo,
carregamento do bundle publicado (o que pegou justamente o bug do N.1: o
`tsc` não roda em `npm run build`, só um teste que roda o **bundle de
verdade** pegaria uma regressão equivalente no futuro).

**Sugestão:** manter ~6-8 testes E2E reais, cobrindo:
- Um smoke test por grupo de comando (`plan`, `audit`, `detect`, `daemon`,
  `init`) — só pra garantir que o bundle carrega e o argv parseia certo.
- Os cenários de ponta a ponta que envolvem múltiplos processos de verdade
  (ex: daemon rodando + comando consultando o daemon).
- Qualquer coisa que dependa de comportamento do processo (exit code,
  stdout/stderr real, sinais).

Tudo que só testa "dado esse estado de arquivos, essa função retorna esse
resultado" migra pro padrão do O.2.

---

## O.4 — Separar scripts de teste + configurar paralelismo do Vitest

**Arquivo:** `package.json`
```diff
--- a/package.json
+++ b/package.json
@@
-    "test": "vitest run",
+    "test": "vitest run",
+    "test:unit": "vitest run --exclude '**/cli-integration.test.ts' --exclude '**/dashboard.test.ts' --exclude '**/bench.test.ts'",
+    "test:e2e": "npm run build && vitest run src/__tests__/cli-integration.test.ts src/__tests__/dashboard.test.ts",
     "pretest": "tsc --noEmit",
+    "pretest:e2e": "npm run build",
```
`test` continua rodando tudo (usado no CI / antes de merge). `test:unit` é
pro dia a dia — feedback em ~100s em vez de ~360s. `pretest:e2e` builda antes
de rodar os E2E — resolve de vez a categoria de bug que já pegou esta
auditoria (testar contra bundle desatualizado, sem rebuildar antes).

**Arquivo:** `vitest.config.ts` — hoje não define `pool`/`poolOptions`, fica
no default. Em máquina com mais de 1 núcleo (o sandbox desta sessão só tem 1,
então não dá pra medir o ganho aqui, mas vale configurar explicitamente):
```diff
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@
 export default defineConfig({
   test: {
     include: ["src/__tests__/**/*.test.ts"],
     exclude: ["src/__tests__/benchmarks.bench.ts"],
     setupFiles: ["src/__tests__/setup.ts"],
     testTimeout: 20_000,
     hookTimeout: 10_000,
     reporters: ["verbose"],
+    // Arquivos de teste já rodam em paralelo por padrão (fileParallelism),
+    // mas "forks" isola melhor processos que tocam filesystem/env real
+    // (os testes E2E do O.3) do que "threads" — evita estado compartilhado
+    // acidental entre arquivos que usam tmpdir/env vars.
+    pool: "forks",
+    poolOptions: {
+      forks: {
+        // Ajustar conforme os núcleos da máquina de CI/dev; deixar vazio
+        // usa o default do Vitest (núcleos disponíveis - 1).
+      },
+    },
     coverage: { ... }
   }
 });
```

---

## O.5 — Escopar o "retroactive scan" do plan-backlog-sync

**Problema secundário:** mesmo depois do O.1, comandos que legitimamente
precisam do bootstrap pesado (ex: `shugo audit`, `shugo status`) ainda pagam
o custo do `initPlanBacklogSync` + retroactive scan sempre, mesmo quando o
comando não toca backlog. Não investigado a fundo nesta sessão — sugestão
para quem for mexer: checar se dá pra tornar esse passo específico
lazy/condicional dentro do `ensureHeavyBootstrap`, do mesmo jeito que o
`ensureHeavyBootstrap` inteiro já é lazy em relação ao `HEAVY_COMMANDS`.

---

## Ordem de execução sugerida

1. **O.1** — 1 arquivo, ~10 linhas, zero risco, benefício imediato pra
   testes *e* usuários reais. Fazer primeiro.
2. **O.4** — configuração, não mexe em lógica. Fazer em seguida pra já ter
   `test:unit` disponível enquanto o resto avança.
3. **O.2 + O.3** — refactor incremental, começar pelos comandos já tocados
   nesta auditoria (`plan done`, `plan status`), medir o ganho real, decidir
   se vale estender pros outros 35+ comandos ou parar quando o tempo total
   já estiver bom o suficiente.
4. **O.5** — nice-to-have, sem pressa.

**Critério de aceite geral:** `npm run test:unit` rodando em segundos (não
minutos) pro loop de desenvolvimento do dia a dia; `npm run test` (suíte
completa, CI) com o tempo total reduzido pela soma de O.1 (menos tempo por
teste E2E que sobrar) + O.2 (menos testes precisando de subprocess) — sem
perder nenhuma cobertura real, só removendo custo de infraestrutura pago à
toa.
