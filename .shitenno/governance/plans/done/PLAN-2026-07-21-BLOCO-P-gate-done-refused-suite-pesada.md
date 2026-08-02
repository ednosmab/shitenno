# BLOCO P — Gate de "done" sempre `refused` por "falha nos testes"

**Status:** Checked
**Date:** 2026-07-21
**Priority:** P0
**Owner:** AI Agent
**Estimated Time:** 1-2h

---

## Contexto

O usuário reportou que o mecanismo de verificação automática de "done"
(`runAutoVerification`, em `src/plan-lifecycle.ts`) está recusando planos de
forma consistente — não intermitente —, e os logs indicam que o motivo é
falha na etapa de testes.

`runAutoVerification` roda, nesta ordem, `checkBuild → checkTests → checkLint
→ checkGateIntegrity`. A causa raiz está em `checkTests()`:

```ts
// src/plan-lifecycle.ts, linha ~157
export function checkTests(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.test) { ... }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("test")}`, {   // ← chama o script "test", não "test:unit"
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 420000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    ...
```

No `package.json` atual:

```json
"test": "vitest run",
"test:unit": "vitest run --exclude '**/cli-integration.test.ts' --exclude '**/dashboard.test.ts' --exclude '**/heavy-bootstrap-scoping.test.ts' --exclude '**/bench.test.ts'",
"test:e2e": "npm run build && vitest run src/__tests__/cli-integration.test.ts src/__tests__/dashboard.test.ts src/__tests__/heavy-bootstrap-scoping.test.ts",
```

`checkTests()` chama `run("test")`, que é `vitest run` **sem nenhuma
exclusão** — ou seja, todo `pnpm run test`/`npm run test` disparado pelo gate
inclui os 4 arquivos pesados (`cli-integration.test.ts`, `dashboard.test.ts`,
`heavy-bootstrap-scoping.test.ts`, `bench.test.ts`), que escalonam o CLI real
via subprocess dezenas de vezes em diretórios temporários.

Isso **não é** o mesmo bug já coberto pelo BLOCO N (aquele era
`statusDisplayText` indefinida). E também não é falta de build: `checkBuild`
roda antes de `checkTests` na mesma lista, então `dist/bin/shugo.js` já
existe fresco quando os testes pesados rodam — a suíte de fato executa, só
que ela é cara demais para caber dentro do timeout do gate.

A própria auditoria anterior do projeto (BLOCO O) já mediu isso:
`cli-integration.test.ts` sozinho leva **~250-260s**, e junto com
`dashboard.test.ts` + `heavy-bootstrap-scoping.test.ts` + `bench.test.ts`
facilmente aproxima ou ultrapassa o timeout de **420000ms (7min)** configurado
em `checkTests()` — especialmente em máquina sem paralelismo alto (o mesmo
ambiente de auditoria já registrado como "1 vCPU"). Quando `execSync`
estoura o timeout, ele lança um erro cujo `stderr`/`stdout` viram a mensagem
`"Tests failed: ..."` — indistinguível, pros logs, de uma asserção que
falhou de verdade. Por isso parece "falha nos testes" de forma consistente:
na prática é o gate pagando o custo de uma suíte de integração pesada que
foi **desenhada para não rodar nesse contexto** (é exatamente por isso que
`test:unit` existe — só que nada no gate de done está usando esse script).

## Objetivo

- O gate de "done" (`checkTests`) passa a rodar `test:unit` em vez de `test`,
  eliminando o custo estrutural dos 4 arquivos pesados do caminho crítico de
  toda verificação de plano.
- Erros de timeout ficam distinguíveis de falhas reais de asserção na
  mensagem do gate, para que o próximo problema desse tipo não exija
  investigação manual do zero.
- Existe teste de regressão que barra qualquer futura reintrodução do script
  errado no gate.

**Critérios de aceitação:**
1. `checkTests()` invoca `test:unit`, e um plano com testes unitários
   passando (mas sem depender da suíte pesada) sai como `passed: true`.
2. Um teste de regressão falha se `checkTests()` voltar a chamar `run("test")`
   em vez de `run("test:unit")`.
3. Mensagem de timeout, quando ocorrer, é diferenciável de falha de asserção
   (ex: prefixo `"Tests timed out after Xms"` em vez de `"Tests failed: ..."`
   genérico).

## Passos de Implementação

### Passo 1: Trocar o script usado pelo gate de testes

**Ficheiro:** `src/plan-lifecycle.ts`

**Ação:**
```diff
 export function checkTests(projectRoot: string): CompletionCheck {
   const pkg = readPackageJsonSafe(projectRoot);
-  if (!pkg?.scripts?.test) {
+  // O gate de "done" usa test:unit, não test — a suíte completa inclui
+  // 4 arquivos de e2e/bench (cli-integration, dashboard,
+  // heavy-bootstrap-scoping, bench) que escalonam o CLI real via
+  // subprocess dezenas de vezes; rodá-los a cada verificação de plano
+  // estoura o timeout do gate (ver BLOCO P). Suíte completa continua
+  // reservada para `npm run test` manual / CI.
+  const gateScript = pkg?.scripts?.["test:unit"] ? "test:unit" : "test";
+  if (!pkg?.scripts?.[gateScript]) {
     // No test script — blocking. "done" without any runnable test suite defeats the
     // whole purpose of the Bloco F verification gate.
     return { name: "TESTS", passed: false, message: "No 'test' script in package.json — cannot verify" };
   }
   const { run } = resolveRunner(projectRoot);
   try {
-    execSync(`${run("test")}`, {
+    execSync(`${run(gateScript)}`, {
       encoding: "utf-8",
       cwd: projectRoot,
       timeout: 420000,
       stdio: ["pipe", "pipe", "pipe"],
     });
     return { name: "TESTS", passed: true, message: "Tests passed" };
   } catch (err) {
     const detail = extractExecError(err);
     return { name: "TESTS", passed: false, message: `Tests failed: ${String(detail).slice(0, 300)}` };
   }
 }
```

**Por que `test:unit` com fallback pra `test`, e não hardcoded:** projetos de
terceiro (o Shitenno é instalado em outros repos, não só nele mesmo) podem não
ter a convenção `test:unit`. Se não existir, cai de volta pro `test` genérico
— mantém compatibilidade sem quebrar instalações externas. No próprio
repositório do Shitenno, `test:unit` existe, então o fallback nunca é
exercido aqui — mas protege o caso geral.

**Verificação:** rodar um plano de teste (`shugo plan status <id> check` →
`shugo plan done <id>`) num projeto onde só a suíte pesada falharia (ex:
mockar timeout) e confirmar que agora passa usando `test:unit`.

---

### Passo 2: Diferenciar timeout de falha real de asserção

**Ficheiro:** `src/plan-lifecycle.ts`

**Ação:** hoje `extractExecError` trata timeout e falha de asserção do mesmo
jeito. Adicionar checagem explícita do sinal de timeout do Node
(`err.signal === "SIGTERM"` quando `execSync` mata o processo por timeout, ou
`err.killed === true`):

```diff
 function extractExecError(err: unknown): string {
   if (err instanceof Error) {
-    const execErr = err as Error & { stderr?: string; stdout?: string };
+    const execErr = err as Error & { stderr?: string; stdout?: string; killed?: boolean; signal?: string };
+    if (execErr.killed) {
+      return `[TIMEOUT] Processo interrompido por exceder o tempo limite. ${execErr.stderr || execErr.stdout || ""}`.trim();
+    }
     return execErr.stderr || execErr.stdout || err.message;
   }
   return String(err);
 }
```

**Verificação:** forçar um timeout artificial (ex: `execFn` mockado que
demora mais que o `timeout` passado) e confirmar que a mensagem do gate
começa com `[TIMEOUT]` em vez de um trecho de stack trace genérico.

---

### Passo 3: Teste de regressão — o gate nunca mais chama o script errado

**Ficheiro:** `src/__tests__/plan-lifecycle-gate-script.test.ts` (novo)

**Ação:**
```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkTests } from "../plan-lifecycle.js";

describe("checkTests — usa test:unit quando disponível, nunca a suíte pesada", () => {
  it("roda test:unit, não test, quando ambos existem", () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-script-"));
    try {
      // "test" está propositalmente quebrado (exit 1); "test:unit" passa.
      // Se checkTests() ainda chamar "test", este teste falha — é o canário
      // que impede a regressão descrita no BLOCO P.
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "gate-script-fixture",
          scripts: {
            test: "node -e \"process.exit(1)\"",
            "test:unit": "node -e \"process.exit(0)\"",
          },
        })
      );

      const result = checkTests(dir);
      expect(result.passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cai de volta pra 'test' quando 'test:unit' não existe (projeto de terceiro)", () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-script-fallback-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "gate-script-fallback-fixture",
          scripts: { test: "node -e \"process.exit(0)\"" },
        })
      );
      const result = checkTests(dir);
      expect(result.passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

**Verificação:** rodar este arquivo isolado (`npx vitest run
src/__tests__/plan-lifecycle-gate-script.test.ts`) e confirmar que os 2 testes
passam; reverter o Passo 1 temporariamente e confirmar que o primeiro teste
falha (prova que ele de fato captura a regressão).

---

### Passo 4 (opcional, mas recomendado): mover a suíte pesada pro checkpoint de sessão, não descartá-la

**Contexto:** os 4 arquivos pesados continuam valiosos (cobrem o bundle real,
argv parsing, exit codes — ver BLOCO O.3), só não deveriam rodar a cada
`plan done` individual. Como o projeto já tem um checkpoint de fronteira de
sessão (fecha a sessão e varre planos pendentes — decisão registrada
anteriormente), esse é o lugar natural para rodar `test:e2e` pelo menos uma
vez por sessão, não a cada plano.

**Ficheiro:** script de fim de sessão (`close-session.ts`, mencionado no
achado N.7)

**Ação:** ao final do checkpoint de sessão, além do que já roda hoje, disparar
`npm run test:e2e` de forma assíncrona/best-effort (sem bloquear o fechamento
da sessão), registrando o resultado como um reminder separado em
`context_buffer.yaml` (`P1`, não `P0`) caso falhe — para não competir com os
reminders de drift semântico já existentes, mas ainda assim ficar visível no
início da próxima sessão.

**Verificação:** ao fechar uma sessão, confirmar que `test:e2e` roda em
background e que uma falha nele gera um reminder distinto (prefixo
`"e2e-suite:"`) sem bloquear o encerramento da sessão em si.

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | `checkTests()` usa `test:unit` com fallback pra `test` | Hardcode `test:unit` sem fallback | Projetos de terceiro instalando o Shitenno podem não ter essa convenção de script; fallback evita quebrar instalações externas |
| 2 | Não aumentar o timeout de 420s pra "caber" a suíte pesada | Subir timeout pra 900s+ | Só adiaria o problema (suíte pesada tende a crescer) e deixaria cada `plan done` ainda mais lento sem necessidade — a suíte pesada não devia estar no caminho crítico, ponto |
| 3 | Suíte pesada migra pro checkpoint de sessão (Passo 4), não é descartada | Remover os 4 arquivos pesados da cobertura de done inteiramente | Eles cobrem regressões reais (bundle publicado, argv, exit codes) que só um teste de processo real pega — remover perderia cobertura, só precisa rodar com frequência menor |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | `test:unit` no repositório do usuário ficar desatualizado (alguém adiciona um teste pesado novo sem excluí-lo de `test:unit`) e o gate voltar a ficar lento silenciosamente | Médio | Passo 3 cobre só a escolha do script, não a lista de exclusões; considerar um teste adicional que compara os arquivos de `src/__tests__` contra a lista de exclusão de `test:unit` e falha se um teste que importa `CLI_PATH`/`dist/` não estiver excluído |
| 2 | Timeout ainda ocorrer mesmo com `test:unit` (ex: cache frio na primeira execução) | Baixo | Passo 2 garante que a mensagem deixa isso óbvio (`[TIMEOUT]`) em vez de parecer uma falha de asserção — investigação futura fica direta |
| 3 | Fallback do Passo 1 mascarar silenciosamente um projeto de terceiro que *deveria* ter `test:unit` mas não tem | Baixo | Mensagem do gate já expõe o `gateScript` escolhido; se necessário, adicionar log informativo (`logger.info`) quando o fallback for usado |

## Ordem de execução sugerida

1. **Passo 1** — a correção em si, isolada, baixo risco, resolve o sintoma reportado.
2. **Passo 3** — escrever o teste de regressão logo em seguida (mesma lógica do BLOCO N.4: garantir que a lição não se perde na próxima sessão).
3. **Passo 2** — melhoria de diagnóstico, não bloqueia nada, mas evita que o próximo problema pareça o mesmo bug de novo.
4. **Passo 4** — pode ficar para uma sessão separada; não é urgente e depende do script de fim de sessão que já está em outra frente de trabalho.
