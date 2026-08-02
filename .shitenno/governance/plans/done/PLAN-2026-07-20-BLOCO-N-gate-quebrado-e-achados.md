# BLOCO N — Gate de verificação quebrado + achados desta auditoria

**Status:** Done
**Updated_at:** 2026-07-22T04:18:34.505Z
**Date:** 2026-07-21
**Contexto:** Auditoria do zip `shitenno-feat-audit__2_.zip`. O usuário reportou:
"o mecanismo no done não está validando mais os planos, dá falha, mas no log não
explica o motivo; o status de checked passa a voltar In progress, deveria ser
refused" + trava de lint em 300 warnings + notificação `notify-send` confusa.

**Já aplicado e validado nesta sessão de auditoria** (N.1–N.3 abaixo já têm o
código corrigido e testado manualmente ponta a ponta contra `dist/bin/shugo.js`
real — build limpo, `tsc --noEmit` limpo, suíte completa passando exceto N.6).
Este plano documenta o diff exato para reaplicar/revisar no repositório real,
mais os itens N.4–N.7 que ainda precisam de trabalho.

---

## N.1 — `statusDisplayText` nunca foi definida (causa-raiz)

**Arquivo:** `src/markdown-plan-engine.ts`

**Problema:** `updateStatus()` chama `statusDisplayText(newStatus)` na linha 368,
mas essa função não existe em lugar nenhum do arquivo (nem import). `tsup`/esbuild
não faz checagem de tipos → `npm run build` "passa" com uma referência quebrada.
`npx vitest run` direto pula o `pretest` (`tsc --noEmit`) que pegaria isso.
Em runtime: `ReferenceError: statusDisplayText is not defined`, lançado **antes**
do `writeFileSync` — nada é persistido, o plano trava no status anterior
("In Progress" em vez de avançar pra "check"/"blocked"/"done").

**Reprodução:**
```bash
npx tsc --noEmit
# src/markdown-plan-engine.ts(368,29): error TS2552: Cannot find name 'statusDisplayText'.
```

**Fix:**
```diff
--- a/src/markdown-plan-engine.ts
+++ b/src/markdown-plan-engine.ts
@@ function normalizeStatusValue(raw: string): MarkdownPlanStatus {
   if (lower.includes("blocked") || lower.includes("bloqueado")) return "blocked";
   return "andamento";
 }
+
+/**
+ * Map a canonical MarkdownPlanStatus to the text written into the
+ * **Status:** frontmatter field. Cada status precisa de um texto que,
+ * ao ser relido por normalizeStatusValue(), volte pro mesmo status
+ * canônico (round-trip) — senão o sinal (ex: "blocked") se perde
+ * silenciosamente na releitura.
+ */
+function statusDisplayText(status: MarkdownPlanStatus): string {
+  switch (status) {
+    case "done":
+      return "Done";
+    case "parado":
+      return "Paused";
+    case "check":
+      return "Checking";
+    case "blocked":
+      return "Blocked";
+    case "andamento":
+    default:
+      return "In Progress";
+  }
+}
```

**Critério de aceite:** `npx tsc --noEmit` limpo, e `shugo plan status <id> check`
persiste `**Status:** Checking` no arquivo (verificado, ver N.4 para o teste
automatizado que hoje não existe).

---

## N.2 — `archivePlan` engolia o erro real (`catch {}` vazio)

**Arquivo:** `src/plan-lifecycle.ts`

**Problema:** o mesmo padrão de bug que M.7 já tinha corrigido em `checkBuild`
voltou aqui. `catch { return false; }` descarta a `ReferenceError` (ou qualquer
outro erro real) sem logar nem repassar — por isso `shugo plan done` só mostrava
"Failed to archive plan: X" sem nenhuma pista do motivo.

**Fix:**
```diff
--- a/src/plan-lifecycle.ts
+++ b/src/plan-lifecycle.ts
@@ export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
     engine.updateStatus(planId, "done");
     return true;
-  } catch {
-    return false;
-  }
+  } catch (error) {
+    // Não engolir o motivo real — os chamadores (md-done.ts,
+    // runLifecycleReview) já têm try/catch próprio que exibe
+    // error.message; só precisamos parar de esconder.
+    logger.warn(
+      "plan-lifecycle",
+      `archivePlan failed for ${planId}: ${error instanceof Error ? error.message : String(error)}`
+    );
+    throw error;
+  }
 }
```

**Nota de compatibilidade:** `archivePlan` muda de "sempre retorna boolean" para
"lança em caso de erro". Os dois pontos de chamada já existentes
(`md-done.ts` e `runLifecycleReview` em `plan-lifecycle.ts`) **já têm**
`try/catch` ao redor da chamada e já sabem exibir `error.message` — checar
antes de aplicar que nenhum outro call site novo trate isso como bool puro
sem `try/catch`.

**Critério de aceite:** forçar um erro em `updateStatus` (ex: plano inexistente)
e confirmar que a mensagem real aparece no output do CLI, não um genérico
"Failed to archive plan".

---

## N.3 — `shugo plan done` nunca rodava build/test/lint (o "gate que não valida")

**Arquivo:** `src/commands/plan/md-done.ts`

**Problema:** este é o ponto mais grave — o comando ia direto pro archive sem
nenhuma checagem, diferente do pipeline do daemon/close-session
(`runAutoVerification`, que já existe e já faz isso corretamente). Nenhum teste
cobre `shugo plan done` diretamente (`grep` confirmou zero ocorrências em
`src/__tests__`), por isso passou despercebido.

**Fix:**
```diff
--- a/src/commands/plan/md-done.ts
+++ b/src/commands/plan/md-done.ts
@@
-import { archivePlan } from "../../plan-lifecycle.js";
+import { runAutoVerification } from "../../plan-lifecycle.js";
@@
   cmd
     .command("done")
-    .description("Mark markdown plan as done and move to done/")
+    .description("Verify (build/test/lint) and mark markdown plan as done, or block it if verification fails")
     .argument("<id>", "Plan ID")
     .option("--json", "Output as JSON")
     .action((id: string, opts: Record<string, unknown>) => {
       const isJson = opts.json === true;
       const ctx = guardNotInitialized(opts, isJson);
       if (!ctx) return;

       const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
       try {
-        const success = archivePlan(shitennoDir, id);
-        if (isJson) outputJson({ success, planId: id });
-        else {
-          if (success) {
-            output(chalk.green(`  ✓ Plan marked as done: ${id}`));
-            output(chalk.dim(`    Moved to done/ directory`));
-          } else {
-            output(chalk.red(`  Failed to archive plan: ${id}`));
-          }
-        }
+        const record = runAutoVerification(shitennoDir, ctx.projectRoot, id);
+        if (isJson) {
+          outputJson({ success: record.passed, planId: id, checks: record.checks });
+        } else if (record.passed) {
+          output(chalk.green(`  ✓ Plan verified and marked as done: ${id}`));
+          output(chalk.dim(`    Moved to done/ directory`));
+        } else {
+          output(chalk.red(`  ✗ Plan blocked — verification failed: ${id}`));
+          for (const check of record.checks.filter((c) => !c.passed)) {
+            output(chalk.yellow(`    ${check.name}: ${check.message}`));
+          }
+        }
       } catch (error) {
         if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
         else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
       }
     });
```

**Critério de aceite:**
- Projeto sem `test` script → `plan done` reporta `blocked` com
  `TESTS: No 'test' script in package.json — cannot verify`.
- Projeto com build/test/lint passando → `plan done` move pra `done/` e
  escreve `.verification.json` com os três checks `passed: true`.

---

## N.4 — Cobertura de teste que teria pego os 3 bugs acima

**Problema:** `src/__tests__/plan-lifecycle.test.ts` mocka
`MarkdownPlanEngine` inteiro (`vi.mock("../markdown-plan-engine.js", ...)`),
então `updateStatus` real nunca roda nos testes — por isso a suíte ficava
verde com o `ReferenceError` em produção. Mesma categoria de falso positivo já
registrada no handoff para `checkBuild`/`checkTests`.

**Sugestão de teste novo (sem mock do engine, usando arquivo real em tmpdir):**
```ts
// src/__tests__/markdown-plan-engine-status.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";

describe("MarkdownPlanEngine.updateStatus — real filesystem, no mocks", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "shugo-status-"));
    const plansDir = join(dir, "governance", "plans");
    require("node:fs").mkdirSync(plansDir, { recursive: true });
    writeFileSync(
      join(plansDir, "PLAN-X.md"),
      "# Plano X\n\n**Status:** In Progress\n\n- [x] a\n- [ ] b\n"
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("persists 'check' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "check")).not.toThrow();
    const content = readFileSync(join(dir, "governance", "plans", "PLAN-X.md"), "utf-8");
    expect(content).toMatch(/\*\*Status:\*\*\s*Checking/);
  });

  it("persists 'blocked' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "blocked")).not.toThrow();
    const content = readFileSync(join(dir, "governance", "plans", "PLAN-X.md"), "utf-8");
    expect(content).toMatch(/\*\*Status:\*\*\s*Blocked/);
  });

  it("round-trips every canonical status through re-parse", () => {
    const engine = new MarkdownPlanEngine(dir);
    for (const status of ["andamento", "parado", "check", "blocked"] as const) {
      engine.updateStatus("PLAN-X", status);
      const reread = engine.getById("PLAN-X");
      expect(reread?.status).toBe(status);
    }
  });
});
```

E um teste de integração real (sem mock) pro CLI `plan done`:
```ts
// adicionar em src/__tests__/cli-integration.test.ts, describe("shugo plan")
it("shugo plan done blocks when there is no test script", async () => {
  const { dir } = scaffoldTestProject("plan-done-block", "junior");
  dirs.push(dir);
  // criar um plano ativo mínimo em dir/.shitenno/governance/plans/PLAN-A.md
  // remover/gerar package.json sem "test" script no dir
  const { stdout, exitCode } = await runShugo("plan done PLAN-A", dir);
  expect(stdout).toMatch(/blocked/i);
  expect(stdout).toMatch(/TESTS/);
});
```

**Critério de aceite:** rodar os testes acima na branch *antes* de N.1–N.3 e
confirmar que falham (prova que capturam a regressão); depois confirmar que
passam com o fix aplicado.

---

## N.5 — Lint em 298/300 warnings: a trava de segurança está prestes a disparar

**Problema:** `"lint": "eslint 'src/**/*.ts' --max-warnings=300"` — rodei e o
projeto já está em **298 warnings**. Qualquer PR que adicione mais 2-3 warnings
derruba o `npm run lint` globalmente, e como consequência também o `checkLint`
usado dentro de `runAutoVerification` (N.3) — ou seja, planos legítimos vão
começar a ser bloqueados por warnings não relacionados ao que a IA estava
fazendo naquele plano especificamente.

**Maiores ofensores encontrados nesta sessão** (mostra de exemplo, não é lista
completa — rodar `npm run lint` de novo pra pegar o total atualizado):
- `readKnowledgeState`: 94 linhas (máx 50) + complexidade 27 (máx 15)
- `readProjectState`: 75 linhas (máx 50)
- `readSessionMemory`: complexidade 20 (máx 15)
- `runCompletionPipeline`: 87 linhas (máx 50) + bloco aninhado em profundidade 5 (máx 4)
- `checkDocumentationUpdated`: 64 linhas (máx 50)
- `checkPlanStatus`: 56 linhas (máx 50)

**Duas frentes de correção, não excludentes:**

1. **Curto prazo (paliativo, 1 linha):** baixar o limite pra criar margem de
   segurança real e forçar quem introduzir warning novo a limpar algo:
   ```diff
   -    "lint": "eslint 'src/**/*.ts' --max-warnings=300",
   +    "lint": "eslint 'src/**/*.ts' --max-warnings=280",
   ```
   Isso por si só *não resolve* nada — só antecipa o problema pra agora, com
   folga, em vez de deixar estourar em produção sem aviso.

2. **Médio prazo (a correção de verdade):** quebrar as funções acima em
   funções menores — a maioria dos warnings de `max-lines-per-function` e
   `complexity` em código de "leitura de estado" (`readKnowledgeState`,
   `readProjectState`, `readSessionMemory`) geralmente indica um único método
   fazendo parse + validação + fallback + normalização tudo junto. Extrair
   cada uma dessas etapas em uma função privada separada tende a resolver os
   dois warnings (linhas e complexidade) ao mesmo tempo, já que são
   sintomas do mesmo problema.

**Critério de aceite:** `npm run lint` com `--max-warnings` no valor escolhido
passando, e uma issue/plano de follow-up rastreando a redução gradual do
número absoluto de warnings (não só do limite).

---

## N.6 — `verification-lock-concurrent.test.ts` falha de forma consistente (não é flaky)

**Problema:** o teste "after child crash (SIGKILL), parent reclaims the stale
lock" falha sempre, não intermitentemente. Não é bug em `verification-lock.ts`
— a lógica de `isProcessAlive`/`acquireVerificationLock` está correta. O bug
está no teste: ele spawna o worker via `tsx` (`spawn(tsxBin, [scriptPath])`),
mas o `tsx` 4.x faz fork interno pra rodar o script de verdade — então
`holder.child.pid` é o PID do processo wrapper do `tsx`, **não** o PID real
que fica gravado no lock (esse vem do `process.pid` capturado *dentro* do
script executado pelo processo-neto). `child.kill("SIGKILL")` mata só o
wrapper; o processo-neto real continua vivo e órfão — por isso
`acquireVerificationLock` corretamente recusa reclamar um lock que ainda
pertence a um processo vivo (só que o teste esperava o contrário).

**Fix sugerido — matar pelo PID real reportado via IPC, não pelo PID do spawn:**
```diff
--- a/src/__tests__/verification-lock-concurrent.test.ts
+++ b/src/__tests__/verification-lock-concurrent.test.ts
@@
-function killChild(child: ChildProcess): Promise<void> {
+function killChild(child: ChildProcess, realPid?: number): Promise<void> {
   return new Promise((resolve) => {
-    if (!child.pid || child.killed) {
+    const pidToKill = realPid ?? child.pid;
+    if (!pidToKill || child.killed) {
       resolve();
       return;
     }
     child.on("exit", () => resolve());
-    child.kill("SIGKILL");
+    // tsx faz fork interno: child.pid é o wrapper, não o processo que
+    // de fato grava o lock. Matar pelo PID real reportado no "result".
+    try {
+      process.kill(pidToKill, "SIGKILL");
+    } catch { /* already dead */ }
     setTimeout(resolve, 1000);
   });
 }
```
E no teste, passar o PID real capturado no `childResult.pid`:
```diff
     const childResult = await waitForStdoutLine(holder, "result") as { acquired: boolean; pid: number };
     expect(childResult.acquired).toBe(true);
@@
-    await killChild(holder.child);
+    await killChild(holder.child, childResult.pid);
     await new Promise((r) => setTimeout(r, 300));
```

**Alternativa (mais robusta, mas mais invasiva):** trocar `spawn(tsxBin, ...)`
por `spawn(tsxBin, [...], { detached: true })` e matar o *grupo* de processos
com `process.kill(-child.pid, "SIGKILL")` — isso mata wrapper + processo-neto
juntos sem depender de capturar o PID real via stdout, e cobre casos em que
o `tsx` faça mais de um nível de fork no futuro.

**Critério de aceite:** rodar `npx vitest run src/__tests__/verification-lock-concurrent.test.ts`
isolado 5x seguidas e confirmar que passa consistentemente (hoje falha 100%
das vezes, não é timing-dependent — então 1 execução já deve bastar, mas
rodar mais de uma vez serve pra garantir que o fix não introduziu uma nova
flakiness).

---

## N.7 — `notify-send` "Shugo Session" confuso + possível loop de sessões curtas

**Ainda não investigado a fundo** (próxima etapa). Evidência já coletada:
notificações desktop consecutivas com durações `17m43s`, `14m38s`, `14m34s`,
`11s`, `11s`, `12s` em poucos minutos — as três últimas de poucos segundos
sugerem sessões reabrindo em loop rápido, não só texto de notificação ruim.

**Passos de investigação (a fazer):**
1. Localizar o hook/script que dispara `notify-send "Shugo Session"` —
   candidato mais provável é `src/templates/base/scripts/close-session.ts`
   (já confirmado nesta sessão que ele chama `runAutoVerification`, mesma
   função do N.3 — verificar se ele também dispara a notificação, ou se é
   outro script separado que só reage ao evento de fim de sessão).
2. Checar se há uma condição de corrida/loop: um watcher de arquivo reagindo
   à própria escrita que ele mesmo faz (ex: `close-session.ts` grava algo em
   `.shitenno/`, o daemon detecta como `plan.file_changed`, dispara nova
   rodada de verificação, que por sua vez conta como nova "sessão encerrada").
3. Só depois de descartar/corrigir o loop, melhorar o texto da notificação
   pra ser acionável (hoje "2 eventos: Sessao encerrada: OK (14m38s)..." não
   diz o que aconteceu nem por que há "2 eventos" numa notificação só).

**Critério de aceite:** notificações não devem mais aparecer em sequência de
poucos segundos entre si sem uma ação real do usuário correspondente; texto
da notificação deve indicar o que foi verificado e o resultado, não só "OK".

---

## Ordem de execução sugerida

1. N.1, N.2, N.3 — já corrigidos nesta sessão, só formalizar/reaplicar no
   repositório real e conferir com `tsc --noEmit` + rebuild.
2. N.4 — escrever os testes de regressão *antes* de considerar N.1–N.3
   fechados (senão a próxima sessão pode reintroduzir o mesmo bug sem
   ninguém perceber, exatamente como aconteceu aqui).
3. N.5 — aplicar o paliativo (baixar `--max-warnings`) imediatamente; abrir
   item de follow-up separado pra redução real dos warnings.
4. N.6 — corrigir o teste do lock (não é urgente, não bloqueia nada em
   produção, mas está mascarando um teste real quebrado na suíte).
5. N.7 — investigar na próxima sessão com acesso ao ambiente onde o
   `notify-send` roda de fato (não reproduzível só com o zip).
