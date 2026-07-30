# Auditoria Shitenno — Blocos S/T/U/V (2026-07-29)

**Status:** Refused

> Continuação da auditoria de ponta a ponta (após R1–R6, Bloco P e Bloco Q).
> Todos os achados abaixo foram confirmados **lendo o código-fonte real** do zip `shitenno-feat-refactor__8_.zip`, não por inferência. Onde relevante, o rastro de chamadas (quem chama quem) foi seguido até a origem.

---

## Sumário executivo

| Bloco | Tema | Achados confirmados | Severidade máxima |
|---|---|---|---|
| S | Notificações | 2 achados (1 crítico: pipeline morto) | **Crítica** |
| T | Formatação de plano ("sem cabeçalho") | 1 achado (bug duplicado em 2 arquivos) | **Alta** |
| U | MCP — inteligência/eficiência | 3 achados | Média/Alta |
| V | Eficiência geral / timers reativos | 3 achados | Média |

Ordem de execução sugerida ao agente: **S1 → T1 → U1 → V2 → V1 → S2 → U2/U3 → V3**, porque S1 e T1 são os que mais impactam sua experiência diária (é literalmente por isso que "quase não recebe notificação" e "o status às vezes não muda").

---

## Bloco S — Sistema de notificações

### S1 (CRÍTICO) — O pipeline que gera `task.completed` nunca é chamado por ninguém

**Evidência:** `src/task-completion-pipeline.ts` exporta `runCompletionPipeline` e `runCurrentTaskPipeline`, que são os únicos pontos do sistema que publicam o evento `task.completed`:

```ts
// src/task-completion-pipeline.ts:128
getEventBus().publish("task.completed", { ... });
```

Busquei por todos os `import` dessas duas funções em `src/` e `bin/`. O único resultado é o próprio arquivo de teste (`task-completion-pipeline.test.ts`), que testa a função isoladamente — **nenhum comando do CLI, nenhum handler do daemon, nenhum outro módulo chama essa pipeline em produção.** É código órfão: existe, tem 2249 linhas de teste cobrindo ele, mas nunca roda de verdade fora dos testes.

Isso explica sozinho a sua queixa "*mal recebo notificação de tarefa concluída*" — o `desktop-notifier.ts` está corretamente inscrito no evento `task.completed`, mas **o evento nunca é disparado no uso real**, porque nada no CLI invoca essa pipeline.

**Sugestão de correção (para o agente aplicar):**

1. Descobrir qual comando deveria estar chamando isso — pelo nome (`runCurrentTaskPipeline`) e pela assinatura, parece pensado para rodar quando o usuário marca uma tarefa do backlog como concluída (`shugo backlog complete <id>` ou equivalente). Peça ao agente para localizar esse comando com:
   ```bash
   grep -rn "\.command(\"backlog" bin/shugo.ts src/commands/
   ```
2. No handler desse comando, após a transição de estado do item do backlog, chamar:
   ```ts
   import { runCurrentTaskPipeline } from "../task-completion-pipeline.js";

   const pipelineResult = await runCurrentTaskPipeline({
     projectRoot,
     shitennoDir,
     taskId: item.id,
     // demais opções conforme PipelineOptions
   });
   if (!pipelineResult.success) {
     outputWarn(`Pipeline de conclusão retornou aviso: ${pipelineResult.reason ?? "desconhecido"}`);
   }
   ```
3. Adicionar um teste de integração (não unitário) que simule o comando real de conclusão de tarefa via CLI (`execa` ou chamada direta ao `action()` do commander) e assine `task.completed` num `EventBus` de teste, garantindo que o evento **de fato** é publicado nesse fluxo — hoje só existe teste unitário da função isolada, que não pega esse tipo de regressão de "ninguém chama isso".

> Nota para o agente: antes de simplesmente "pendurar" a chamada em qualquer lugar, confirmar a intenção original olhando o `PipelineOptions`/`PipelineResult` e os testes existentes — pode ser que o pipeline precise ser invocado em mais de um ponto (ex.: tanto em `backlog complete` quanto em `plan done` quando o plano fecha a última tarefa associada).

---

### S2 (ALTA) — `desktop-notifier.ts` não escuta os eventos de plano concluído

**Evidência:** o notifier se inscreve em exatamente 6 eventos:
```
task.completed, session.end, challenge.generated,
workdir.large_uncommitted_drift, plan.inconsistency_detected, briefing.generated
```
Mas o motor de planos publica dois eventos de conclusão que **não estão nessa lista**:
```ts
// src/markdown-plan-engine/file-operations.ts
getEventBus().publish("plan.status_changed", { ... });
getEventBus().publish("plan.archived", { ... }); // disparado quando o plano vai pra done/
```
Isso é a segunda metade da sua queixa: "*não recebo notificação de cada plano concluído*" — o evento existe e é publicado corretamente quando um plano é arquivado, só que **ninguém notifica sobre ele**.

**Sugestão de correção:**

```ts
// src/desktop-notifier.ts — junto às outras subscriptions em initDesktopNotifier()
getEventBus().subscribe("plan.archived", (payload) => {
  if (payload.newStatus !== "done") return; // não notificar "blocked"/"cancelled" com o mesmo tom de sucesso
  sendNotification({
    title: "Plano concluído",
    message: `${payload.planId ?? payload.planName} foi arquivado como done`,
    urgency: "normal",
  });
});
```

Ajustar o nome exato do payload (`planId`/`planName`/`newStatus`) conforme a interface publicada em `file-operations.ts` — pedir ao agente para conferir o tipo exato do evento antes de escrever o handler (evita bug de campo inexistente).

---

## Bloco T — "Quando não há cabeçalho com status, parece não funcionar"

### T1 (ALTA) — Confirmado: bug real, silencioso, em dois pontos do motor de planos

Você está certo. Encontrei a causa exata, e ela é mais séria do que "não atualiza" — em alguns casos ela **arquiva o plano sem nunca ter escrito o status nele**.

**Ponto 1 — leitura (`normalizePlanHeader`, chamado toda vez que um plano é lido):**
```ts
// src/markdown-plan-engine.ts (normalizePlanHeader)
const titleIndex = lines.findIndex((l) => l.startsWith("# "));
if (titleIndex === -1) return content; // <- silencioso: não insere Status, não avisa, não loga
```

**Ponto 2 — escrita (`updateLegacyStatus`, chamado sempre que o status muda e o plano não usa bloco YAML):**
```ts
// src/markdown-plan-engine/file-operations.ts
const statusMatch = content.match(/(\*\*Status:\*\*\s*)(.+)/);
if (statusMatch) {
  content = content.replace(...);
} else {
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));
  if (titleIndex !== -1) {
    lines.splice(titleIndex + 2, 0, "", `**Status:** ...`);
    content = lines.join("\n");
  }
  // else: nada acontece — content sai do jeito que entrou
}
```

**O efeito em cadeia é o pior detalhe:** `updateStatus()` (em `markdown-plan-engine.ts`) chama `updateLegacyStatus`, grava o resultado no disco (que pode ser idêntico ao original, sem status nenhum) e **na sequência publica `plan.status_changed`/`plan.archived` e move o arquivo para `done/` de qualquer forma**, porque essas ações usam o `newStatus` que foi *pedido*, não o que foi *efetivamente escrito no conteúdo*. Ou seja: um plano cujo arquivo markdown não começa com uma linha `# Título` pode ser movido para `governance/plans/done/` sem que o campo `**Status:**` jamais tenha sido gravado nele. Quando esse arquivo for lido de novo, `extractStatus()` cai no fallback heurístico (conta checkbox `- [ ]` vs `- [x]`), o que pode inclusive reportar um status diferente do real.

**Sugestão de correção (para o agente aplicar nos dois arquivos):**

```ts
// src/markdown-plan-engine/file-operations.ts
export function updateLegacyStatus(content: string, newStatus: MarkdownPlanStatus): string {
  const statusRegex = /(\*\*Status:\*\*\s*)(.+)/;
  const statusMatch = content.match(statusRegex);

  if (statusMatch) {
    return content.replace(statusRegex, `$1${statusDisplayText(newStatus)}`);
  }

  const lines = content.split("\n");
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));

  if (titleIndex !== -1) {
    lines.splice(titleIndex + 2, 0, "", `**Status:** ${statusDisplayText(newStatus)}`);
    return lines.join("\n");
  }

  // Fallback: sem "# título" nenhum — insere Status na primeira linha
  // não-vazia do arquivo, em vez de desistir silenciosamente.
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
  const insertAt = firstNonEmpty === -1 ? 0 : firstNonEmpty + 1;
  lines.splice(insertAt, 0, "", `**Status:** ${statusDisplayText(newStatus)}`);
  return lines.join("\n");
}
```

E, mais importante — fazer `updateStatus()` **falhar de forma visível** (não apenas seguir em frente) se a escrita não alterou o conteúdo de fato:

```ts
// src/markdown-plan-engine.ts, dentro de updateStatus(), logo após gravar:
const updatedContent = /* resultado de updateYamlStatus/updateLegacyStatus */;
if (updatedContent === originalContent) {
  throw new Error(
    `updateStatus: não foi possível localizar ou inserir o campo Status em ${filePath}. ` +
    `Verifique se o arquivo tem um cabeçalho "# Título" ou bloco YAML válido.`
  );
}
writeFileSync(filePath, updatedContent, "utf-8");
```

Isso transforma uma corrupção silenciosa de dado em um erro alto e imediato — exatamente o tipo de coisa que o `checkPlanFormat` (P0.2) já tenta pegar em *outro* momento (no gate de `plan done`), mas que hoje não impede o `updateStatus()` de rodar de qualquer jeito fora desse gate específico (ex.: transições intermediárias como `todo → andamento`, que não passam pelo gate de done).

**Teste de regressão sugerido:**
```ts
it("insere Status mesmo sem cabeçalho '# ' no arquivo", () => {
  const content = "Só um parágrafo qualquer, sem título markdown.\n";
  const result = updateLegacyStatus(content, "andamento");
  expect(result).toMatch(/\*\*Status:\*\*\s*andamento/i);
});

it("updateStatus lança erro em vez de arquivar silenciosamente se o status não foi escrito", () => {
  // arquivo deliberadamente "hostil" ao parser
  ...
  expect(() => engine.updateStatus(planId, "done")).toThrow(/não foi possível localizar/i);
});
```

---

## Bloco U — MCP: é inteligente? É eficiente? Dá pra melhorar?

**Resposta curta:** a arquitetura é boa (17 tools bem separadas por domínio, sem duplicação — o R3 antigo continua corrigido), mas tem um bug de protocolo real e caching subutilizado.

### U1 (ALTA) — Banner de inicialização ainda escreve no stdout, poluindo o protocolo stdio

Confirmado que o achado da sessão anterior **continua presente neste zip**. `outputError()` (usado no banner do `shugo mcp start`) escreve em `process.stdout`, não em `stderr`:

```ts
// src/output.ts
export function output(msg, opts) {
  ...
  process.stdout.write(msg + "\n"); // sempre stdout, mesmo vindo de outputError()
}
```

E `commands/mcp.ts` chama `outputError` (duas vezes, para o banner "Starting MCP server...") **antes** de conectar o `StdioServerTransport`, que exige que o stdout contenha *apenas* mensagens JSON-RPC. Isso já foi visto quebrando clientes MCP estritos.

**Sugestão de correção:**
```ts
// src/commands/mcp.ts — trocar as chamadas do banner
console.error(chalk.dim("shitenno-mcp: Starting MCP server over stdio..."));
console.error(chalk.dim(`shitenno-mcp: ${TOOL_NAMES.join(", ")}`));
// nunca usar output()/outputError() aqui — o processo inteiro (stdout)
// é reservado para JSON-RPC assim que startMcpServer() conectar o transport.
```
Ou, melhor ainda, corrigir a raiz do problema em `output.ts` para que `outputError` de fato escreva em `stderr` (isso é o comportamento esperado pelo nome da função em qualquer outro lugar do CLI também, não só no MCP):
```ts
export function outputError(msg: string): void {
  process.stderr.write(`${chalk.red("✗")} ${msg}\n`);
}
```
> Atenção ao aplicar essa segunda opção: como `outputError` é usada em dezenas de comandos fora do MCP, o agente precisa rodar a suíte de testes completa (não só `test:unit`) depois dessa mudança, porque testes que capturam stdout esperando ver mensagens de erro vão quebrar — é esperado, mas precisam ser atualizados para capturar stderr.

### U2 (MÉDIA) — Lista de tools no banner está desatualizada (9 de 17)

O array hardcoded no banner de `commands/mcp.ts` lista só 9 tools; faltam `addBacklogItem`, `transitionBacklogItem`, `deleteBacklogItem`, `getKnowledgeDebt`, `getChallenges`, `getAuditReport`, `getEvolution`, `getMandatoryContext`.

**Sugestão:** gerar a lista dinamicamente a partir do `TOOLS` array já definido em `mcp-server.ts`, em vez de manter uma segunda lista manual fadada a desatualizar de novo:
```ts
// commands/mcp.ts
import { TOOLS } from "../mcp-server.js"; // exportar TOOLS de lá se ainda não for exportado
console.error(chalk.dim(`shitenno-mcp: ${TOOLS.map(t => t.name).join(", ")}`));
```

### U3 (BAIXA, mas latente) — `withCache` tem uma armadilha de chave-padrão

`src/mcp-cache.ts` — quando `options.key` não é passado, a chave default vem de `handler.toString().slice(0, 64)`, ou seja, do **texto-fonte da função**, que é idêntico independentemente dos argumentos capturados no closure. Hoje isso não causa bug porque os dois únicos usos atuais (`handleGetRiskMap`, `handleGetEngineeringState`) sempre passam `key` explicitamente. Mas é uma armadilha para qualquer handler futuro que usar `withCache` sem perceber que precisa passar `key` manualmente — o cache vai devolver dados errados silenciosamente para argumentos diferentes.

**Sugestão:** tornar `key` obrigatório no tipo (remover o fallback perigoso):
```ts
export interface CacheOptions {
  key: string; // agora obrigatório, sem default por toString()
  ttlMs?: number;
}
```
Isso quebra a build em qualquer chamada futura que esqueça a key — de propósito, é melhor falhar no `tsc` do que servir cache errado silenciosamente em produção.

**Sobre cobertura de cache:** só 2 das 17 tools (`getRiskMap`, `getEngineeringState`) são cacheadas — as duas mais caras (fazem varredura de projeto inteiro), o que é a escolha certa. As demais são leituras de arquivo relativamente baratas; não vale a pena cachear todas só por cachear. Nessa parte específica, o sistema já é "inteligente" o suficiente — não precisa de mudança.

---

## Bloco V — Eficiência geral / timers que deveriam ser reativos

Confirmado, lendo `src/daemon/timers.ts`: dos itens do Bloco J anterior, **J.4 (lock/fila) foi implementado, mas J.1 e J.2 continuam pendentes** neste zip. Acrescento um novo achado (V3) sobre um timer que também deveria virar evento.

### V1 (MÉDIA) — `persistState` grava a cada 30s sem checar se algo mudou (J.1, ainda pendente)

```ts
// src/daemon/timers.ts
const persistTimer = setInterval(() => {
  persistState(ctx.state, ctx.statePath);
}, 30_000);
```
`persistState` sempre serializa e grava o `DaemonState` inteiro em disco, mesmo com o daemon completamente ocioso, para sempre, a cada 30s.

**Sugestão de correção — dirty flag simples:**
```ts
// src/daemon/state.ts
let dirty = false;
export function markDirty(): void { dirty = true; }

export function persistState(state: DaemonState, statePath: string, force = false): void {
  if (!dirty && !force) return;
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
    dirty = false;
  } catch (err) { /* ...igual ao atual... */ }
}
```
E chamar `markDirty()` em todo ponto que hoje muta `ctx.state` diretamente (ex.: dentro de `recordEvent`, ao atualizar `state.health`, etc.). O timer de 30s continua existindo (como salvaguarda / fallback), mas na prática só grava quando há mudança real:
```ts
export function recordEvent(state: DaemonState, eventType: string): void {
  state.events.push({ type: eventType, timestamp: new Date().toISOString() });
  if (state.events.length > MAX_EVENTS) state.events.shift();
  markDirty();
}
```

### V2 (MÉDIA) — Auditoria periódica do daemon não usa o modo incremental que já existe (J.2, ainda pendente)

`auditHealth()` já aceita um 4º parâmetro `changedFiles` para escanear só os arquivos alterados (é usado no modo `--changed` do CLI). Só que `runPeriodicAudit()` no daemon chama sem esse parâmetro:
```ts
// src/daemon/timers.ts
const report = await auditHealth(ctx.projectRoot, ctx.shitennoDir, level); // sem changedFiles
```
Resultado: toda auditoria periódica do daemon (a cada 4–6h) é sempre full-scan, mesmo quando só 2 arquivos mudaram desde a última — o daemon já tem a lista de arquivos alterados disponível via `startup-scan.ts`/git status.

**Sugestão de correção:**
```ts
// src/daemon/timers.ts
import { getChangedFilesSinceLastAudit } from "./startup-scan.js"; // ajustar import real

export async function runPeriodicAudit(ctx: DaemonContext): Promise<void> {
  try {
    const level = getAuditLevel(ctx);
    const changed = getChangedFilesSinceLastAudit(ctx); // pode retornar undefined se não souber
    const report = await auditHealth(ctx.projectRoot, ctx.shitennoDir, level, changed);
    ...
```
Peça ao agente para confirmar o nome exato da função que já lista arquivos alterados (`isLargeCommit` em `startup-scan.ts` sugere que a infraestrutura de "quais arquivos mudaram" já existe ali perto — reaproveitar, não duplicar).

### V3 (NOVO, MÉDIA) — `largeCommitTimer` faz polling de 5 em 5 minutos algo que já tem hook de git disponível

```ts
// src/daemon/timers.ts
const largeCommitTimer = setInterval(() => {
  if (isLargeCommit(ctx.shitennoDir, 50)) { ...dispara auditoria... }
}, 5 * 60 * 1000);
```
O sistema já tem infraestrutura de git hooks reativos (fase 2 do projeto original). Staged files só mudam quando o usuário roda `git add`/`git commit` — checar isso a cada 5 minutos por polling é exatamente o padrão que vocês decidiram evitar ao adotar a abordagem faseada (cache → git hooks → daemon).

**Sugestão de correção:** mover a checagem de "commit grande" para o hook `pre-commit` (ou `post-add`, se existir) já usado pelo projeto, publicando um evento que o daemon escuta, em vez de o daemon perguntar a cada 5 minutos:
```bash
# .git/hooks/pre-commit (ou script gerenciado pelo shitenno em hooks/)
staged=$(git diff --cached --name-only | wc -l)
if [ "$staged" -ge 50 ]; then
  shugo internal notify-large-commit --count "$staged"
fi
```
```ts
// novo comando interno, curto, só publica o evento pro daemon via IPC
getEventBus().publish("git.large_commit_detected", { count });
```
```ts
// src/daemon/timers.ts — remove o setInterval, adiciona subscribe
getEventBus().subscribe("git.large_commit_detected", () => {
  runPeriodicAuditFn();
});
```
Isso elimina completamente um dos timers de polling do daemon, reduzindo tanto overhead quanto latência (a auditoria dispara no exato momento do commit grande, não até 5 minutos depois).

> `consolidationTimer` (15 min, sempre roda `runSemanticCycle` incondicionalmente) e `scheduleCheckNag` (30 min, varre *todos* os planos mesmo quando nenhum está em `check`) têm o mesmo padrão de "poll cego". Não aprofundei o código-fonte de `semantic-runner.ts` nem o de detecção de planos presos nesta rodada — vale um Bloco W dedicado a esses dois se quiser continuar essa frente na próxima sessão.

---

## Plano de execução sequencial sugerido

1. **S1** — religar `runCurrentTaskPipeline` ao comando real de conclusão de tarefa (maior impacto na sua percepção de "o sistema não avisa nada").
2. **T1** — corrigir `updateLegacyStatus`/`normalizePlanHeader` + fazer `updateStatus` lançar erro em vez de arquivar silenciosamente.
3. **U1** — banner do MCP para stderr (ou corrigir `outputError` na raiz — decidir qual das duas opções antes de mandar pro agente, a segunda tem blast radius maior).
4. **V2** — plugar `changedFiles` na auditoria periódica do daemon (ganho de eficiência rápido, baixo risco).
5. **V1** — dirty-check no `persistState`.
6. **S2** — notificação de plano arquivado/concluído.
7. **U2 / U3** — lista de tools dinâmica no banner + tornar `key` obrigatório no `withCache`.
8. **V3** — mover checagem de commit grande de polling para hook reativo (maior esforço de todos, deixar por último).

Toda a suíte de 2309 testes (`pnpm run build && pnpm run test`) deve continuar em 2309/2309 depois de cada item — nenhuma das mudanças acima deveria exigir teste novo além dos de regressão sugeridos em T1 e S1. Se o agente adicionar testes extras, é sinal de que algo do fluxo saiu diferente do previsto aqui e vale conferir antes de seguir pro próximo item.
