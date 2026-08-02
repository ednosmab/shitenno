---
category: engineering
lifecycle: Active
---

# ADR-008: Precedência Humana sobre Execução Autônoma (CLI vs Daemon)

**Status:** Proposed
**Date:** 2026-07-16
**Deciders:** Tech Lead (via auditoria de código assistida)

## Context

O sistema tem dois centros de decisão que agem sobre o mesmo estado: o CLI (invocado sob demanda, com um humano no loop — `decision-engine.ts`, `action-engine.ts`) e o daemon (reativo, sem supervisão humana — `rule-engine`, `proactive-engine`). Auditoria de código confirmou que hoje eles não têm nenhuma coordenação: `RULE-016.json`, uma regra em produção, muda o status de um item de backlog automaticamente ao detectar `task_completed`, sem checar se um usuário está com `shugo act` ou `shugo decide` aberto sobre o mesmo item. Não existe, em `rule-engine/engine.ts`, nenhum gate antes de `executeAction` que verifique conflito com uma sessão humana ativa.

Isso é agravado por `run_shugo_command` ser um tipo de ação válido do rule-engine — uma regra do daemon pode invocar o próprio CLI programaticamente, o que significa que o raio de ação do daemon inclui, em tese, qualquer coisa que o CLI também pode fazer.

Sem uma regra de precedência explícita, o sistema tem dois caminhos com poder de agir sobre o mesmo recurso e nenhum critério definido para quando um deve ceder ao outro.

## Decision

Adotar um princípio de precedência assimétrico e não negociável: **execução autônoma (daemon) sempre cede a decisão humana (CLI) quando os dois competem pelo mesmo recurso.** O daemon opera com autoridade delegada e revogável, nunca com autoridade própria.

Isso é operacionalizado em três níveis (tiers), por tipo de ação:

- **Tier 1** (`log_event`, `send_notification`, `trigger_health_check`, `create_reminder`, `update_context_buffer`, etc.) — baixo impacto, reversível. Executa sempre, sem checagem.
- **Tier 2** (`archive_plan`, `update_backlog_status`, `create_adr`, `create_skill`, etc.) — impacto médio. Executa autonomamente, mas cede se o recurso (planId/taskId) estiver reclamado por uma sessão CLI ativa no momento (mecanismo de claim com TTL, reaproveitando `LRUCache` já existente em `daemon-resources.ts`).
- **Tier 3** (`update_file`, `remove_file`, `run_local_script`, `run_script`, `run_shugo_command`) — alto impacto. Nunca executa autonomamente por padrão; vira proposta (`challenge.generated`) para confirmação humana via CLI. Só executa autônomo se a regra tiver `"autonomous": true` explícito, documentado com justificativa.

## Consequences

### Positive

- Existe, pela primeira vez, um critério objetivo e testável para "quem decide" quando os dois caminhos colidem — em vez de depender de sorte de timing.
- Ações de alto impacto (mutação de arquivo arbitrária, execução de comando) nunca acontecem sem confirmação humana por padrão, reduzindo a superfície de erro silencioso do daemon.
- O daemon continua totalmente autônomo para a maior parte do que já faz hoje (Tier 1, que cobre a maioria dos triggers observacionais) — a mudança não reduz a capacidade reativa do sistema, só limita onde ela pode agir sem supervisão.
- Compatível com a arquitetura orientada a eventos já estabelecida (ADR-002) — a precedência é implementada via eventos (`resource.claimed`/`resource.released`, `challenge.generated`), não via acoplamento direto entre CLI e daemon.

### Negative

- Ações Tier 2 podem ser adiadas em cenários de uso intenso simultâneo (muitas sessões CLI ativas ao mesmo tempo), atrasando automações que hoje rodam sem esse gate.
- Regras Tier 3 que hoje talvez estivessem implicitamente configuradas para rodar sem confirmação (não há evidência de que isso ocorra na prática, mas é tecnicamente possível) precisarão de auditoria e opt-in explícito — trabalho de migração único, mas real.
- Adiciona uma dependência: o mecanismo de claim só funciona corretamente depois que `session.start`/`session.end` estiverem publicados de fato pelo CLI (hoje só existem em testes, não em produção — ver plano de resiliência, Fase 1.2/1.3).

## Alternatives Considered

### Option A: Colaboração simétrica (negociação em tempo real entre CLI e daemon)
- Pros: nenhum dos dois lados é estruturalmente "mais fraco"; parece mais "justo".
- Cons: exige um protocolo de negociação/consenso a mais para construir e testar; não resolve o problema de fundo (quem decide em caso de empate ainda precisa de uma regra) — só adia a decisão para tempo de execução, criando risco de deadlock ou race condition.

### Option B: Daemon totalmente autônomo, CLI só consultivo
- Pros: simplifica o modelo — só uma autoridade.
- Cons: inaceitável para um produto cujo valor central é governança confiável; um sistema que age sozinho sobre mutação de arquivos e execução de comandos, sem supervisão humana possível, é o oposto do que um usuário de uma ferramenta de governança espera poder confiar.

### Option C: CLI totalmente autônomo, daemon só observacional (sem `rule-engine`/`proactive-engine` ativos)
- Pros: elimina o risco de colisão por completo.
- Cons: joga fora capacidade reativa real já construída e testada (arquivamento automático de planos concluídos, detecção de inconsistência, regras declarativas) — contradiz a decisão já tomada em ADR-002 de ter um sistema orientado a eventos com reação autônoma.

## References

- `src/rule-engine/engine.ts`, `src/rule-engine/validation.ts` (tipos de ação e dispatch)
- `src/daemon-resources.ts` (`LRUCache` reaproveitado para o mecanismo de claim)
- `shitenno/governance/rules/RULE-016.json` (exemplo real de mutação autônoma sem gate hoje)
- PLAN-2026-07-16-cli-daemon-authority-arbitration.md
- PLAN-2026-07-16-system-resilience-REVISADO.md (Fase 1.2/1.3, pré-requisito para `sessionId` real)
- ADR-002-event-driven-state.md (arquitetura orientada a eventos, mantida e respeitada por esta decisão)
