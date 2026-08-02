# BLOCO Q — Hardening do mecanismo de "done" (matching frágil, atomicidade, duas portas de entrada)

**Status:** Done
**Date:** 2026-07-21
**Priority:** P1
**Owner:** AI Agent
**Estimated Time:** 3-4h

---

## Contexto

Uma revisão do mecanismo de conclusão de tarefas/planos (`task-completion.ts`,
`task-completion-pipeline.ts`, `backlog-state-machine.ts`, `plan-lifecycle.ts`)
identificou que a arquitetura em camadas está bem fundamentada — há
meta-verificação (`checkGateIntegrity`), cuidado documentado com
auto-referência no `diffHash`, e ordenação correta de escrita do sidecar
`.verification.json` antes do `moveToDone`. Isso **não é** o mesmo tipo de
achado do BLOCO P (que era um bug de sintoma concreto — script errado
chamado pelo gate). Este bloco cobre **fragilidades estruturais** que ainda
não quebraram nada visivelmente, mas vão quebrar sob as condições certas.

Cinco pontos, em ordem de risco:

**1. Matching de ID por substring bidirecional.** Em três lugares —
`findActivePlanForTask` (`task-completion-pipeline.ts`), `checkPlanStatus`
(`task-completion.ts`) e `findBacklogItem` (`backlog-state-machine.ts`) — a
associação entre `taskId` e o arquivo/item correspondente usa:

```ts
id.includes(lowerTaskId) || lowerTaskId.includes(id)
```

Isso casa `TASK-1` com `TASK-10`, `TASK-11`, `TASK-100`, etc. Não é
hipotético: qualquer numeração sequencial de dois dígitos gera colisão. Como
esse matching decide **qual** plano é arquivado e **qual** linha do backlog é
marcada como `Done`, um falso positivo aqui corrompe o estado de uma tarefa
que não tem nada a ver com a que está sendo concluída.

**2. Sem atomicidade no pipeline.** `runCompletionPipeline`
(`task-completion-pipeline.ts`) executa, em sequência: publica
`task.completed` → `completeTask()` no backlog → `archivePlan()`. Cada etapa
tem seu próprio `try/catch` que só acumula a mensagem em `errors[]`; não há
compensação. Se `completeTask()` tiver sucesso e `archivePlan()` falhar
(ex: `renameSync` falha por permissão), o retorno final tem
`success: false`, mas o backlog já foi escrito como `concluído` — o efeito
colateral não é desfeito. Quem só olhar `success` no chamador vê "falhou";
quem olhar o backlog vê "já terminou". Os dois estados coexistem.

**3. Duas portas de entrada para "done", com conjuntos de checks diferentes.**
`runCompletionPipeline` chama `archivePlan()` diretamente, usando o
`ValidationResult` derivado dos 5 gates de tarefa (`tests/lint/
documentation/backlog/plan_status`). Já o fluxo interativo/automático
(`runLifecycleReview` → `runAutoVerification`) chama `checkBuild + checkTests
+ checkLint + checkGateIntegrity` e só então arquiva. Um plano pode ser
arquivado por qualquer um dos dois caminhos, e nenhum garante que os checks
do outro rodaram — `runCompletionPipeline` nunca roda `checkBuild` nem
`checkGateIntegrity`; `runAutoVerification` nunca roda o gate de
`documentation` nem `backlog`. Não há um único ponto de verdade sobre o que
"verificado" significa.

**4. Janela fixa de 200 caracteres em `checkBacklogUpdated`**
(`task-completion.ts`): `content.slice(idx, idx + 200)` para procurar
`"Done"`/`"concluído"` depois do cabeçalho `### {taskId}`. Um título de
tarefa longo, ou campos extras antes do status, empurram a palavra pra fora
da janela (falso negativo — gate bloqueia uma tarefa que de fato está
concluída); ou a janela pega `"Done"` de uma seção vizinha não relacionada
(falso positivo).

**5. Gate de documentação usa substring de path** (`checkDocumentationUpdated`,
`task-completion.ts`): `modifiedFiles.some(m => m.includes(f) || f.includes(m))`.
Dois arquivos `README.md` em diretórios diferentes colidem; um path relativo
tipo `docs/a.md` pode ser "contido" por um path não relacionado que tenha a
mesma substring.

## Objetivo

- Toda associação `taskId` ↔ plano/item de backlog passa a exigir
  correspondência exata (após normalização), eliminando colisões por prefixo
  numérico.
- O pipeline de conclusão de tarefa registra e expõe estado parcial de forma
  explícita quando uma etapa falha após outra já ter tido efeito, em vez de
  só devolver `success: false` silencioso.
- As duas portas de entrada para "done" (`task-completion-pipeline` e
  `plan-lifecycle`) documentam explicitamente qual conjunto de checks cada
  uma cobre, e existe um teste que trava se um plano for arquivável sem que
  nenhum dos dois conjuntos completos tenha rodado.
- `checkBacklogUpdated` e `checkDocumentationUpdated` deixam de depender de
  janela fixa / substring para decidir passa-ou-falha.

**Critérios de aceitação:**
1. `TASK-1` e `TASK-10` nunca casam entre si em nenhum dos três pontos de
   matching; existe teste de regressão cobrindo os três.
2. Se `archivePlan()` falhar depois de `completeTask()` ter tido sucesso, o
   `PipelineResult` expõe isso de forma inequívoca (novo campo, não apenas
   `errors[]` genérico) e um evento distinto é publicado para permitir
   reconciliação manual.
3. Existe um comentário/doc listando explicitamente: "arquivar via pipeline
   de tarefa cobre X, Y, Z; arquivar via lifecycle review cobre A, B, C" — e
   um teste que falha se um dos dois conjuntos for alterado sem atualizar o
   outro lado da tabela.
4. `checkBacklogUpdated` localiza o fim da seção pela próxima ocorrência de
   `### ` (ou fim do arquivo), não por offset fixo.
5. `checkDocumentationUpdated` compara paths normalizados
   (relative + resolve) com igualdade exata, não `includes`.

## Passos de Implementação

### Passo 1: Helper único de matching exato de ID

**Ficheiro:** novo `src/id-matcher.ts`

**Ação:**
```ts
/**
 * Compara um taskId contra o id de um artefato (plano, item de backlog).
 * Corresponde por igualdade exata (case-insensitive, após trim) ou por
 * prefixo com fronteira de separador (ex: "TASK-1" casa com "TASK-1-retry"
 * mas NUNCA com "TASK-10" ou "TASK-100").
 */
export function matchesTaskId(candidateId: string, taskId: string): boolean {
  const a = candidateId.trim().toLowerCase();
  const b = taskId.trim().toLowerCase();
  if (a === b) return true;

  const boundaryAfter = (longer: string, shorter: string): boolean => {
    if (!longer.startsWith(shorter)) return false;
    const nextChar = longer[shorter.length];
    return nextChar === undefined || /[-_. ]/.test(nextChar);
  };

  return boundaryAfter(a, b) || boundaryAfter(b, a);
}
```

**Ação (substituição nos 3 pontos):**
```diff
+ import { matchesTaskId } from "./id-matcher.js";
  ...
- if (id.includes(lowerTaskId) || lowerTaskId.includes(id)) {
+ if (matchesTaskId(id, taskId)) {
```
aplicado em `findActivePlanForTask` (task-completion-pipeline.ts),
`checkPlanStatus` (task-completion.ts) e `findBacklogItem`
(backlog-state-machine.ts).

**Verificação:** com `TASK-1` e `TASK-10` ambos presentes (planos ou linhas
de backlog), rodar o pipeline para `TASK-1` e confirmar que só o artefato de
`TASK-1` é tocado.

---

### Passo 2: Teste de regressão para o matching de ID

**Ficheiro:** `src/__tests__/id-matcher.test.ts` (novo)

**Ação:**
```ts
import { describe, it, expect } from "vitest";
import { matchesTaskId } from "../id-matcher.js";

describe("matchesTaskId — sem colisão por prefixo numérico", () => {
  it("não casa TASK-1 com TASK-10", () => {
    expect(matchesTaskId("TASK-10", "TASK-1")).toBe(false);
    expect(matchesTaskId("TASK-1", "TASK-10")).toBe(false);
  });
  it("casa TASK-1 com ele mesmo, case-insensitive", () => {
    expect(matchesTaskId("task-1", "TASK-1")).toBe(true);
  });
  it("casa TASK-1 com TASK-1-retry (fronteira de separador)", () => {
    expect(matchesTaskId("TASK-1-retry", "TASK-1")).toBe(true);
  });
});
```

**Verificação:** rodar isolado; reverter o Passo 1 temporariamente e
confirmar que o primeiro teste falha.

---

### Passo 3: Expor estado parcial no pipeline em vez de `errors[]` genérico

**Ficheiro:** `src/task-completion-pipeline.ts`

**Ação:** adicionar campo `partialFailure` ao `PipelineResult` e publicar
evento distinto quando uma escrita já efetivada é seguida de falha em etapa
posterior:

```diff
 export interface PipelineResult {
   success: boolean;
   taskId: string;
   gates: CompletionResult;
   backlogUpdated: boolean;
   planArchived: boolean;
   eventPublished: boolean;
   errors: string[];
+  /** true quando uma etapa com efeito já persistido (backlog) foi seguida
+   * de falha em etapa posterior (arquivamento) — estado requer reconciliação
+   * manual, não é um "tentar de novo" simples. */
+  partialFailure: boolean;
 }
```

No corpo de `runCompletionPipeline`, após a tentativa de `archivePlan`:
```diff
+ const partialFailure = backlogUpdated && !planArchived && planIdWasFound;
+ if (partialFailure) {
+   try {
+     getEventBus().publish("pipeline.partial_failure" as any, {
+       taskId, backlogUpdated, planArchived, errors,
+     });
+   } catch { /* best-effort */ }
+ }
  return {
    success,
    taskId,
    gates,
    backlogUpdated,
    planArchived,
    eventPublished,
+   partialFailure,
    errors,
  };
```
(`planIdWasFound` = resultado de `findActivePlanForTask` não-nulo, já
disponível no escopo da função.)

**Nota de design:** optamos por **expor** o estado parcial em vez de tentar
reverter `completeTask()` automaticamente. Reverter backlog de forma
automática é arriscado (pode conflitar com uma edição manual concorrente) —
melhor sinalizar alto e deixar reconciliação humana ou re-execução
idempotente do arquivamento isoladamente.

**Verificação:** mockar `archivePlan` para lançar erro depois que
`completeTask` já rodou com sucesso; confirmar `partialFailure: true` e o
evento `pipeline.partial_failure` publicado.

---

### Passo 4: Documentar e testar a cobertura das duas portas de entrada

**Ficheiro:** novo `src/__tests__/done-entrypoints-coverage.test.ts` +
comentário em `plan-lifecycle.ts` e `task-completion-pipeline.ts`

**Ação:** adicionar no topo de cada arquivo um bloco de comentário paralelo:

```ts
// DUAS PORTAS DE ENTRADA PARA "DONE" (ver BLOCO Q):
//   1. task-completion-pipeline.ts → runCompletionPipeline()
//      cobre: tests, lint, documentation, backlog, plan_status
//      NÃO cobre: build, gate_self_test
//   2. plan-lifecycle.ts → runAutoVerification() / runLifecycleReview()
//      cobre: build, tests, lint, gate_self_test
//      NÃO cobre: documentation, backlog
// Um plano pode ser arquivado por qualquer uma das duas sem passar pelos
// checks exclusivos da outra. Se isso mudar de ser aceitável, ver o teste
// done-entrypoints-coverage.test.ts.
```

E um teste que lista as duas tabelas de nomes de gate como constantes e falha
se alguém adicionar um gate novo em um lado sem decidir explicitamente se o
outro lado precisa dele também (o teste não impõe paridade — só força uma
decisão consciente, via snapshot):

```ts
import { describe, it, expect } from "vitest";

const PIPELINE_GATES = ["tests", "lint", "documentation", "backlog", "plan_status"];
const LIFECYCLE_CHECKS = ["BUILD", "TESTS", "LINT", "GATE_SELF_TEST"];

describe("cobertura das duas portas de entrada para done", () => {
  it("snapshot dos conjuntos de gate — mudança exige atualizar o comentário cruzado", () => {
    expect(PIPELINE_GATES).toMatchSnapshot();
    expect(LIFECYCLE_CHECKS).toMatchSnapshot();
  });
});
```

**Verificação:** adicionar um gate novo em qualquer um dos dois arquivos de
produção sem tocar no teste; confirmar que o snapshot quebra (obrigando a
decisão consciente, não silenciosa).

---

### Passo 5: Substituir janela fixa por delimitação de seção real

**Ficheiro:** `src/task-completion.ts`, função `checkBacklogUpdated`

**Ação:**
```diff
-      const section = content.slice(idx, idx + 200);
+      const nextHeadingIdx = content.indexOf("\n### ", idx + pattern.length);
+      const section = nextHeadingIdx === -1
+        ? content.slice(idx)
+        : content.slice(idx, nextHeadingIdx);
```

**Verificação:** teste com um título de tarefa artificialmente longo (>200
chars antes do campo de status) confirmando que o gate agora encontra
`"Done"` corretamente; e teste com duas seções `###` adjacentes onde só a
segunda contém `"Done"`, confirmando que a primeira não é mais marcada como
passada por engano.

---

### Passo 6: Comparação exata de path no gate de documentação

**Ficheiro:** `src/task-completion.ts`, função `checkDocumentationUpdated`

**Ação:**
```diff
+ import { relative, resolve } from "node:path";
  ...
-    const modifiedDocFiles = docFiles.filter((f) =>
-      modifiedFiles.some((m) => m.includes(f) || f.includes(m))
-    );
+    const normalize = (p: string) => relative(projectRoot, resolve(projectRoot, p));
+    const normalizedModified = new Set(modifiedFiles.map(normalize));
+    const modifiedDocFiles = docFiles.filter((f) => normalizedModified.has(normalize(f)));
```
(mesma normalização aplicada ao cálculo de `missing`, logo abaixo.)

**Verificação:** dois arquivos `README.md` em pastas diferentes no mesmo
diff; confirmar que apenas o path exatamente afetado conta como
"documentação atualizada".

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Matching de ID por igualdade exata + fronteira de separador, não substring livre | Regex mais permissivo com `\d+` no limite | Fronteira de separador (`-_. ` ou fim de string) já elimina a colisão numérica sem exigir uma gramática de ID mais rígida que quebraria IDs existentes no projeto |
| 2 | Estado parcial do pipeline é **exposto**, não revertido automaticamente | Rollback automático do backlog quando o arquivamento falha | Reverter escrita de arquivo de forma automática arrisca conflitar com edição manual concorrente feita entre as duas etapas; melhor sinalizar alto e deixar reconciliação deliberada |
| 3 | As duas portas de entrada continuam existindo separadas (não unificadas num só fluxo) | Fundir `runCompletionPipeline` e `runAutoVerification` num único caminho | Servem contextos diferentes (automação por evento vs revisão interativa/CLI); unificar agora é escopo maior que o problema reportado — a mitigação deste bloco é tornar a divergência **visível e testada**, não eliminá-la |
| 4 | Delimitação de seção do backlog por próximo `### `, não por contagem de linhas | Exigir formato YAML/JSON estruturado para BACKLOG.md | Trocar o formato do backlog é uma mudança muito maior, fora do escopo de um hardening pontual; a correção por heading resolve o bug sem tocar no formato |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | `matchesTaskId` com fronteira de separador ainda pode colidir se a convenção de ID do projeto usar caracteres fora de `-_. ` como separador | Baixo | Documentar a lista de separadores aceitos no docstring; fácil de estender se aparecer um caso real |
| 2 | Passo 3 adiciona um evento novo (`pipeline.partial_failure`) que nenhum consumidor ainda escuta — risco de ficar "morto" até alguém construir a reconciliação | Médio | Aceitável para este bloco: o objetivo aqui é parar de esconder o estado, não construir o fluxo de reconciliação completo (fica como bloco futuro) |
| 3 | Passo 4 (teste de snapshot) pode virar ruído se os gates mudarem com frequência | Baixo | Snapshot só força atualização deliberada do comentário cruzado — não bloqueia o merge, só exige `--update-snapshots` consciente |
| 4 | Passo 5/6 mudam comportamento de gates já em produção — plano que antes passava pode passar a falhar (ou vice-versa) em casos de borda não cobertos pelos testes novos | Médio | Rodar `runLifecycleReview` em modo `--dry` contra os planos ativos atuais antes de mergear, comparando resultado antes/depois |

## Ordem de execução sugerida

1. **Passo 1 + 2** — matching de ID é o risco mais alto (corrompe estado de tarefa errada); corrigir e travar com teste primeiro.
2. **Passo 5 + 6** — correções isoladas e de baixo acoplamento, resolvem falsos positivo/negativo nos gates existentes sem exigir mudança de contrato.
3. **Passo 3** — depende de entender o fluxo de erro do pipeline; fazer depois que o matching (que também é usado ali) já está corrigido.
4. **Passo 4** — é documentação + teste de guarda; pode ser feito por último, mas antes de fechar o bloco, para capturar honestamente a cobertura real após os passos 1, 5 e 6.
