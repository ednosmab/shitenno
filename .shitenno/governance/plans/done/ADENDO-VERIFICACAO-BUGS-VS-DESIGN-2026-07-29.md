# Adendo de Verificação — Bugs vs. Design (2026-07-29)

**Status:** Done
**Updated_at:** 2026-07-31T05:03:06.359Z
**Date:** 2026-07-29

> Antes de mandar qualquer coisa pro agente, verifiquei cada achado dos blocos S–V contra o resto do sistema, procurando por um mecanismo que eu pudesse ter deixado passar (rule engine, hooks reativos, scripts de template, ADRs antigas). Resultado: **quase tudo é bug real**, mas um achado (S1) tinha uma causa raiz diferente da que eu descrevi, e o relatório do agente (Bloco W) usou um método que perdeu um terceiro mecanismo genérico de escuta — o que muda a contagem de "eventos órfãos".

---

## S1 — não é "ninguém chama o pipeline". É "o pipeline certo foi trocado por outro, e o evento ficou pra trás"

Fui atrás de por que `task-completion-pipeline.ts` existe do jeito que existe. Achei a ADR-005 (arquivada em `.shitenno/governance/plans/done/2026-07-08-adr005-automated-task-completion.md`), que documenta a intenção original: o pipeline deveria ser chamado a partir de `close-session.ts`, publicando `task.completed`, que por sua vez dispara duas regras do rule engine (`RULE-016`, transição automática de backlog; `RULE-017`, atualização de context buffer).

**O que descobri:** `close-session.ts` **foi completamente reescrito** desde a ADR-005 (hoje mora em `src/templates/base/scripts/close-session.ts`, como script de projeto, não mais comando embutido no CLI) e **não importa mais `task-completion-pipeline.ts`** — ele agora fala direto com `dist/plan-lifecycle.js` (`detectActivePlans`/`runAutoVerification`), um mecanismo mais novo (do trabalho de hardening dos Blocos P/Q). A migração aconteceu, mas o arquivo antigo (`task-completion-pipeline.ts`) não foi apagado nem sua função de publicar `task.completed` foi movida para o novo caminho.

**E tem uma segunda camada que eu não tinha visto:** o rule engine (`src/rule-engine/engine.ts`) tem um mapa `EVENT_TO_TRIGGER` que inclui:
```ts
"task.completed": "task_completed",
"command.completed": "task_completed",   // <- mesmo trigger que task.completed!
```
`command.completed` é publicado em **todo comando do CLI**, sem exceção (`src/cli-middleware.ts:132`, payload `{command, projectRoot, timestamp, duration}` — sem `taskId`). Como os dois eventos caem no mesmo trigger `"task_completed"`, `RULE-016`/`RULE-017` (ambas com `conditions: []`, ou seja, sem filtro) **disparam em toda invocação do `shugo`** — só que como `command.completed` não tem `taskId` no payload, `executeUpdateBacklogStatus` recebe `taskId` vazio e retorna erro silencioso (`"Missing required params"`) sem quebrar nada visivelmente. Ou seja: as regras que deveriam automatizar a transição de backlog na conclusão de tarefa **rodam sempre, mas nunca fazem o que prometem** — nem quando uma tarefa termina de verdade (porque `task.completed` nunca dispara) nem nos outros momentos (porque falta o `taskId`).

**Isso muda a correção sugerida.** Não é "religar `runCurrentTaskPipeline` a algum comando de backlog complete" (não existe esse comando — confirmei, não tem `shugo backlog complete`). O ponto certo de correção é mais cirúrgico:

1. **Separar o trigger.** `command.completed` mapear para `"task_completed"` é uma colisão de nomes, quase certamente não intencional — "um comando terminou" e "uma tarefa foi concluída" são conceitos diferentes. Sugestão:
   ```ts
   // src/rule-engine/engine.ts — EVENT_TO_TRIGGER
   "command.completed": "command_completed", // trigger novo e distinto, não reaproveitar "task_completed"
   ```
   (Precisa criar o `TriggerType` novo e ajustar qualquer regra que dependa do comportamento atual — hoje nenhuma regra padrão usa esse trigger errado a propósito, então o risco é baixo.)

2. **Publicar `task.completed` de verdade, no lugar certo.** O candidato mais provável, dado que o pipeline de negócio migrou para `plan-lifecycle.ts`, é publicar o evento dentro de `executeUpdateBacklogStatus` (`src/rule-engine/actions.ts`), quando a transição realmente chega a um estado terminal (`toState` igual a algo como `"concluído"`/`"done"`), e não tentar ressuscitar o `task-completion-pipeline.ts` inteiro — ele é código de uma geração arquitetural anterior:
   ```ts
   // src/rule-engine/actions.ts — dentro de executeUpdateBacklogStatus, após transitionTask ter sucesso
   if (result.success && isTerminalState(toState)) {
     getEventBus().publish("task.completed", {
       taskId,
       fromState,
       toState,
       timestamp: new Date().toISOString(),
     });
   }
   ```
3. **Decisão que precisa de você antes do agente mexer:** `task-completion-pipeline.ts` e `backlog-state-machine.ts` (ADR-005, fase 1–3) parecem ter sido parcialmente substituídos pelo par `plan-lifecycle.ts` + `rule-engine/actions.ts`, mas o `backlog-state-machine.ts` **ainda está em uso** (é chamado por `rule-engine/actions.ts` e `id-matcher.ts`). Só o *orquestrador* (`task-completion-pipeline.ts`) parece órfão de verdade. Vale pedir ao agente para confirmar isso com um `git log`/blame do arquivo antes de decidir entre (a) apagar `task-completion-pipeline.ts` e mover a única coisa útil dele (publicar o evento) para dentro de `rule-engine/actions.ts` como sugerido acima, ou (b) manter o arquivo e só adicionar a chamada que falta. Eu prefiro (a) — é menos código para manter fazendo a mesma coisa por dois caminhos — mas é uma opinião, não um fato.

**S2 (notificação de plano concluído) continua válido do jeito que descrevi antes** — confirmei que `plan.archived` é publicado de verdade quando `plan md done` roda (inclusive via `executeArchivePlan` do rule engine, que chama esse comando como subprocesso), e `desktop-notifier.ts` realmente não escuta esse evento. Nenhuma mudança aqui.

---

## Bloco W (relatório do agente) — a lista de "16 eventos órfãos" está superestimada

O relatório do agente corrigiu a contagem uma vez (de 29 para 21) ao achar 2 pontos de escuta genérica (`semantic-runner.ts`, 30 eventos; `event-handlers.ts`, 12 eventos). **Existe um terceiro ponto que ele não pegou:** o próprio `initializeRuleEngine` (`src/rule-engine/engine.ts`), que assina genericamente **41 tipos de evento** via o mapa `EVENT_TO_TRIGGER` mostrado acima — inclusive vários que estão na lista de "16 órfãos" do relatório.

Cruzando a lista dos 16 contra o `EVENT_TO_TRIGGER`, **7 deles têm, sim, um consumidor** (o rule engine, via trigger genérico `"file_change"`):
`pipeline.stage.start`, `pipeline.stage.complete`, `governance.policy_applied`, `entropy.calculated`, `doc.lifecycle.audited`, `system.updated`, `state.mutated`.

E dos "4 declarados, nunca usados dos dois lados", **3 também têm consumidor** pelo mesmo mecanismo (`pipeline.started`, `recommendation.accepted`, `recommendation.rejected`) — só `context.tier_mismatch` é de fato órfão dos dois lados.

**Isso não quer dizer que esses 10 eventos estão "funcionando bem"** — eles caem todos no trigger genérico `"file_change"`, que é tão genérico que, na prática, todos esses eventos diferentes acionam exatamente as mesmas regras (se houver alguma regra usando `trigger: "file_change"`), perdendo qualquer especificidade do que de fato aconteceu. Ou seja: tecnicamente "consumido", mas na prática **indistinguível de qualquer outro dos 14 outros eventos que caem no mesmo balde**. Isso é mais um sintoma do padrão "declarado com intenção específica, mas achatado num trigger genérico" do que dos "16 publicados no vácuo" como o relatório descreveu.

**Números corrigidos:**
- Publicado + consumido de forma específica (direto): continua o mesmo número do relatório do agente.
- Publicado + consumido só via trigger genérico `"file_change"` (efetivamente indistinto): **7 eventos** (a lista acima) — categoria nova, nem "funcionando" nem "órfão", é "existe mas perdeu a identidade".
- Verdadeiramente sem nenhum consumidor, nos 3 mecanismos genéricos + assinatura direta: **9 eventos** (não 16): `plan.format_warning`, `context.p4_loaded`, `watcher.error`, `daemon.ready`, `proactive.digest_ready`, `action.pre_sensitive`, `pipeline.partial_failure`, `semantic.pattern_detected`, `semantic.insight_detected`.
- Declarado, nunca publicado, mas COM subscriber esperando (via rule engine): `pipeline.started`, `recommendation.accepted`, `recommendation.rejected` — 3 eventos, categoria "metade do contrato existe".
- Declarado, morto dos dois lados de verdade: só `context.tier_mismatch`.

**O que isso muda no plano consolidado:** o Bloco W2 (decidir caso a caso os "16 publishers órfãos") passa a ser sobre **9 eventos**, não 16 — reduz o escopo da decisão de escopo/design que só você toma. Os 7 que caem no trigger genérico `file_change` são um problema diferente (granularidade perdida, não ausência de consumidor) e podem virar um item à parte, de menor prioridade, sobre se vale a pena dar a alguns desses eventos um trigger próprio no rule engine em vez de todos caírem em `file_change`.

---

## T1, U1, V1, V2 — confirmados como bugs reais, sem mecanismo escondido

Procurei especificamente por explicação de design para cada um antes de bater o martelo:

- **T1 (formatação sem cabeçalho):** não achei nenhuma validação anterior que garanta que todo plano sempre tenha `# Título` antes de chegar em `updateStatus()`. A criação via `MarkdownPlanEngine.create()` sempre inclui o título (então planos criados pelo próprio sistema não pisam nesse bug), mas nada impede um plano editado à mão ou importado de cair nesse caminho sem cabeçalho — e quando cai, o comportamento é silencioso, não um erro. Continua sendo bug real, ainda que provavelmente raro na prática (por isso talvez nunca tenha sido notado até agora).
- **U1 (banner MCP no stdout):** não há nenhum modo especial que redirecione `output()`/`outputError()` quando `shugo mcp start` está ativo — o `globalJsonMode` existe mas não é ligado automaticamente nesse comando. Bug real, confirmado de novo.
- **V1 (persistState sem dirty-check):** não achei nenhum throttle escondido em outro lugar do daemon que já resolva isso. É só simplicidade original, não decisão documentada. Vale a pena corrigir, mas é o item de menor severidade real de todo o plano — se o agente tiver pouco tempo, é o primeiro a poder ficar pra depois.
- **V2 (auditoria periódica sem `changedFiles`):** não achei nenhum comentário ou ADR justificando "auditoria periódica deve sempre ser full-scan por design". Parece só um parâmetro esquecido na chamada. Bug real.
- **V3 (polling de commit grande):** aqui teve uma correção importante — o `shugo init` já instala hooks reativos por padrão (`installReactiveHooks`), mas **só `post-commit` e `post-merge`**, não `pre-commit`. Minha sugestão original (usar `pre-commit` para checar staged files) não se encaixa no padrão de hooks que o projeto já instala por padrão. Ajuste: em vez de criar um novo tipo de hook, aproveitar o `post-commit` que já existe e checar o tamanho do commit que **acabou de ser feito** (`git diff HEAD~1..HEAD --name-only`), não os arquivos staged antes do commit — o efeito prático (detectar commit grande) é o mesmo, mas usando a infraestrutura de hook que já é instalada por padrão, sem exigir mudança na instalação.

---

## Resumo da mudança no plano consolidado

- **S1** muda de "religar comando" para "separar o trigger `command.completed`/`task_completed` colidido + publicar `task.completed` dentro de `executeUpdateBacklogStatus`, com decisão sua sobre apagar ou não `task-completion-pipeline.ts`".
- **Bloco W2** encolhe de 16 para 9 eventos verdadeiramente órfãos, mais um novo sub-item (baixa prioridade) sobre os 7 eventos que têm consumidor mas perdem granularidade no trigger genérico `file_change`.
- **V3** muda de "criar hook pre-commit" para "reaproveitar o post-commit já instalado, olhando pro commit recém-feito em vez de pro staging".
- **T1, U1, V1, V2** confirmados sem alteração — nenhum mecanismo escondido os justifica como design intencional.
