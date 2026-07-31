# Plano Final Consolidado (2026-07-29) — respostas às duas perguntas

**Status:** Done
**Updated_at:** 2026-07-31T05:18:34.319Z
**Date:** 2026-07-29

## 1. "Vamos corrigir o mecanismo de notificação nesse último plano?"

Sim — e a versão final é a do adendo (não a original), porque a causa raiz real do S1 é outra. Resumo do que entra no plano, já corrigido:

- **S1 — task.completed nunca dispara.** Não é "religar o pipeline antigo". É: (a) separar o trigger `command.completed` de `task_completed` no `EVENT_TO_TRIGGER` do rule engine — hoje colidem e fazem `RULE-016`/`RULE-017` disparar em todo comando do CLI e falhar silenciosamente por falta de `taskId`; (b) publicar `task.completed` de dentro de `executeUpdateBacklogStatus` (`src/rule-engine/actions.ts`), quando a transição chega a um estado terminal; (c) decisão sua: apagar `task-completion-pipeline.ts` (órfão, superado pela migração pra `plan-lifecycle.ts`) ou só deixar ele quieto. Recomendo apagar.
- **S2 — plano concluído nunca notifica.** Sem mudança: `desktop-notifier.ts` precisa se inscrever em `plan.archived`/`plan.status_changed`, que já são publicados corretamente.

Os dois continuam na Fase 1 (código direto), na mesma posição de prioridade (logo depois de T1, porque S1 tem uma dependência nova: a mudança no `EVENT_TO_TRIGGER` precisa ser testada antes de S2, já que os dois mexem em vizinhança de código do rule engine/event bus).

## 2. "O start de cada sessão ainda usa 8+ arquivos?"

Sim — na verdade **10**, com uma duplicata, e a causa é o mesmo padrão do S1: existe um mecanismo pronto pra resolver isso, mas ele nunca foi ligado.

**O que carrega hoje, de fato**, no `instructions[]` do `opencode.json` (conferi contra o `.shitenno/governance` real deste próprio projeto, não um projeto vazio):

```json
"instructions": [
  "./.shitenno/docs/AGENTS.md",                    // 10,6 KB
  "./.shitenno/docs/opencode-context.md",           // 3,8 KB
  "./.shitenno/governance/MANDATORY_CONTEXT.md",    // 1,8 KB
  "./.shitenno/governance/**/*.yaml",               // glob — casa 7 arquivos:
  //   agents/AI-CONTRACT-planner-v1.yaml
  //   agents/AI-CONTRACT-orchestrator-v1.yaml
  //   agents/AI-CONTRACT-executor-v1.yaml
  //   agents/AI-CONTRACT-reviewer-v1.yaml
  //   rule-manifest.yaml
  //   skill-manifest.yaml
  //   context/context_buffer.yaml   <- já casado pelo glob acima
  "./.shitenno/governance/context/context_buffer.yaml"  // <- E listado de novo aqui, redundante
]
```
3 arquivos `.md` explícitos + 7 `.yaml` pelo glob = **10 arquivos**, sendo que `context_buffer.yaml` entra duas vezes na lista (uma via glob, uma explícita) — puro desperdício, sem função.

**A parte que mais importa:** existe `src/session-bootstrapper.ts`, com um comentário dizendo literalmente *"This replaces the heavy instructions\[\] in opencode.json"* — um sistema de lazy-loading já pronto, com orçamento de token (2000 essenciais / 1000 sob demanda / 3000 total), cache de 5 min, e uma lista enxuta de "essenciais" (só `AGENTS.md` + `context_buffer.yaml`, 2 arquivos) mais o resto sob demanda via MCP. **Ninguém chama esse módulo.** Fiz a mesma checagem que fiz pro S1 — zero import em `src/` ou `bin/` fora do próprio arquivo. É o segundo caso, nesta auditoria, do mesmo padrão: mecanismo certo, construído, testado (isoladamente), nunca plugado no fluxo real.

**Sugestão de correção — Bloco AA:**

1. Remover a duplicata óbvia primeiro (baixíssimo risco, ganho imediato):
   ```json
   // src/templates/base/opencode.json — remover a linha context_buffer.yaml solta,
   // já que o glob "governance/**/*.yaml" já pega ela.
   "instructions": [
     "./.shitenno/docs/AGENTS.md",
     "./.shitenno/docs/opencode-context.md",
     "./.shitenno/governance/MANDATORY_CONTEXT.md",
     "./.shitenno/governance/**/*.yaml"
   ]
   ```
2. Decisão sua antes do agente ir além: o `opencode.json` é lido pelo próprio OpenCode (fora do controle do shitenno) — trocar `instructions[]` por uma lista curta e mover o resto pro `session-bootstrapper.ts` via MCP tool (`getMandatoryContext`, que já existe e faz exatamente esse papel de "contexto sob demanda") é a correção "de verdade", mas ela muda o que o agente vê automaticamente no primeiro turno vs. o que ele precisa pedir explicitamente. Duas rotas:
   - **Rota curta (baixo risco):** só remover a duplicata (passo 1) e reduzir o glob pra excluir `agents/*.yaml` (4 arquivos que provavelmente só interessam quando o agente troca de papel, não em todo início de sessão) — cai de 10 pra ~4 arquivos sem tocar em nenhum código, só no template.
   - **Rota completa (o que o `session-bootstrapper.ts` foi desenhado pra fazer):** `instructions[]` vira só `AGENTS.md`, e todo o resto (contratos de agente, manifests, contexto obrigatório) passa a vir do MCP tool `getMandatoryContext`/`getSkills` quando o agente realmente precisar — aí sim os 2000/1000/3000 tokens de orçamento do bootstrapper fazem sentido. Isso exige atualizar o `AGENTS.md` do template pra instruir explicitamente "chame getMandatoryContext no início da sessão" em vez de contar com o carregamento automático — mudança de comportamento, não só de código, por isso é decisão sua.

   Meu voto, sem saber o quanto o agente hoje realmente usa `agents/*.yaml` logo de cara: começar pela rota curta agora (praticamente zero risco) e decidir a rota completa numa sessão dedicada, com dados reais de quanto token cada arquivo custa por sessão — que é exatamente o tipo de medição que caiu no Bloco Z (lacunas de medição) do plano anterior.

---

## Ordem de execução final, consolidada (substitui a lista da mensagem anterior)

**Fase 1 — código direto:**
1. T1 — formatação de plano sem cabeçalho
2. S1 (corrigido) — separar trigger `command.completed`/`task_completed` + publicar `task.completed` no lugar novo
3. S2 — notificar `plan.archived`
4. **AA1 (novo)** — remover duplicata de `context_buffer.yaml` no `instructions[]` do `opencode.json` (baixíssimo risco, fazer junto com S1/S2 já que é a mesma sessão de trabalho no template)
5. U1 — banner MCP pro stderr
6. V2 — auditoria periódica incremental
7. V1 — dirty-check no persistState
8. Y1 — `getBriefing` vs `getMandatoryContext`
9. U2/U3 — banner de tools dinâmico + key obrigatória no cache
10. V3 (ajustado) — reaproveitar hook `post-commit` já instalado, em vez de polling de 5 min

**Fase 2 — decisões de escopo, precisam de você antes do agente codar:**
- **AA2** — rota curta vs. rota completa pro `instructions[]`/`session-bootstrapper.ts` (acima)
- **S1-decisão** — apagar `task-completion-pipeline.ts` ou só deixar quieto
- **W2** — os 9 eventos realmente órfãos (número corrigido), caso a caso
- **X** — governança em 7 formatos, por último

Nada na Fase 1 depende de decisão sua — pode ir direto pro agente. A Fase 2 precisa da sua palavra antes.
