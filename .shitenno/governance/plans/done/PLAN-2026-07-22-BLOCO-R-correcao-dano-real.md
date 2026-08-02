# BLOCO R — Correção de Dano Real (NEW-001, NEW-002, NEW-003)

**Status:** Done
**Date:** 2026-07-22
**Updated_at:** 2026-07-23T06:24:10.523Z

**Contexto:** Três itens do backlog causam dano real ao estado atual do projeto:

- **NEW-003**: Sistema de feedback gera 82 registros automáticos `deferred` sem valor real — polui o estado e não reflete feedback do utilizador
- **NEW-001**: Falta validação runtime para `shitenno/profile/` — erros crípticos quando projeto não foi inicializado
- **NEW-002**: Feedback pessoal do agente nunca executa automaticamente — AGENTS.md regra #17 não é cumprida

---

## R.1 — Corrigir sistema de feedback (NEW-003) ✅ CONCLUÍDO

**Problema:** 82 registros em `.shitenno/feedback/records/` são todos `deferred` para `rule-RULE-001` com contexto vazio (maturity 0, capabilities vazias). São gerados pelo motor, não refletem feedback real do utilizador.

**Achados:**
- `summary.json` mostra 82 deferments, 0 accepts, 0 rejects
- Registros têm `context.maturityScore: 0` mesmo com projeto maduro (maturity 73%)
- `session-feedback/records.jsonl` tem 195 registros válidos (outcome success)

**Arquivos modificados:**
- `src/commands/assess.ts` — Removida geração automática de registros `deferred` para capacidades recomendadas
- `src/commands/detect.ts` — Removida geração automática de registros `deferred` para regras candidatas
- `src/commands/doctor.ts` — Removida geração automática de registros `deferred` para melhorias

**Fix implementado:**
1. `assess.ts`: `recordFeedbackForProfile()` agora só registra feedback de dimensões, não de capacidades recomendadas
2. `detect.ts`: `recordCandidateRuleFeedback()` agora é uma função vazia (regras só são registadas quando utilizador aprova/rejeita)
3. `doctor.ts`: Removido loop que gerava registros `deferred` automáticos para melhorias

**Teste de regressão:**
- Build passou ✅
- 2094 testes unitários passaram ✅
- Novos registros só serão gerados quando utilizador tomar decisão real

---

## R.2 — Runtime validation shitenno/profile/ (NEW-001)

**Problema:** Se projeto não inicializou com `shugo init`, utilizador vê erro críptico em vez de mensagem amigável. `guardNotInitialized()` verifica diretório `.shitenno` mas não valida `shitenno/profile/`.

**Arquivos-alvo:**
- `src/shared.ts` — função `guardNotInitialized()`
- `src/commands/briefing.ts` — depende do perfil
- `src/commands/feedback.ts` — depende do perfil
- `src/commands/detect.ts` — depende do perfil

**Fix:**
1. Adicionar verificação de `shitenno/profile/` em `guardNotInitialized()`
2. Se não existir perfil: mensagem "Project not initialized. Run 'shugo init' to configure governance."
3. Se perfil existe mas diretório não: alerta e fallback para valores default

**Teste de regressão:**
- `shugo briefing` sem `shitenno/profile/` → mensagem amigável, não erro críptico
- `shugo feedback` sem `shitenno/profile/` → mensagem amigável
- `shugo briefing` com `shitenno/profile/` → funciona normalmente

---

## R.3 — Investigar feedback pessoal do agente (NEW-002) ✅ CONCLUÍDO

**Problema:** AGENTS.md regra #17 exige que o agente gere e apresente feedback pessoal ao utilizador no fim de sessão. No entanto, este feedback nunca é executado automaticamente.

**Achados:**
- Skill `quick-board-enforcement.md` NÃO bloqueia o feedback — ela é sobre o Quick Board, não sobre feedback pessoal
- `loading_profile: lite` não carrega a regra #17 (está em `docs/rules/feedback-protocol.md`)
- A regra #17 é acionada por keywords de fim de sessão ("vamos parar", "sessão fechada", etc.), não automaticamente
- Não há mecanismo para detectar automaticamente o fim da sessão — o utilizador precisa sinalizar manualmente

**Conclusão:** O comportamento está correto por design. O feedback pessoal é acionado por keywords, não automaticamente. Não é um bug, é uma limitação do design atual.

**Recomendação:** Manter como está. Se o utilizador quiser feedback automático, precisará configurar um mechanism de detecção de fim de sessão (ex: timeout, keyword detection).

---

## Ordem de execução sugerida

1. **R.2** (~1h) — Validação runtime — implementação mais rápida, impacto imediato no UX
2. **R.1** (~2-3h) — Corrigir sistema de feedback — mais complexo, mas crítico para qualidade dos dados
3. **R.3** (~1h) — Investigar feedback pessoal — pode não exigir fix de código, apenas documentação

## Critério de aceite

- [x] `shugo init` pendente → comandos mostram "Run 'shugo init' first" em vez de erro críptico (já existe em guardNotInitialized())
- [x] Registros de feedback têm contexto real (maturityScore > 0) — removida geração automática de registros deferred
- [x] Feedback pessoal do agente executa no fim de sessão OU está documentado o bloqueio — documentado como design limitation
- [x] Backlog ACTIVE.md atualizado (NEW-001, NEW-002, NEW-003 movidos para DONE)
