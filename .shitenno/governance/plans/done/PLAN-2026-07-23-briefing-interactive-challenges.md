# Briefing Interactivo — Resposta a Challenges Pendentes

**Status:** Done
**Date:** 2026-07-23
**Updated_at:** 2026-07-24T04:59:09.042Z
**Contexto:** Notificações proactivas do daemon são unidireccionais — o utilizador vê "Consider running health audit" mas não tem forma de responder. O briefing mostra challenges mas não permite acção. O ciclo de interacção está aberto.

---

## 🎯 Objectivo

Adicionar um prompt interactivo ao final do `shugo briefing` que apresenta challenges pendentes e permite ao utilizador responder (executar acção, adiar, ignorar). O briefing continua a funcionar como antes se não houver challenges.

---

## 📋 Steps

### Step 1: Criar módulo `src/challenge-responder.ts`
- **Ficheiro:** `src/challenge-responder.ts`
- **Acção:** Criar módulo que:
  1. Lê challenges pendentes de `daemon/state.json` (campo `challenges` com `resolved: false`)
  2. Para cada challenge, define acções sugeridas baseadas no tipo:
     - `plan_completed` → "Run health audit", "Start next P0", "Dismiss"
     - `drift_detected` → "Review changes", "Commit now", "Dismiss"
     - `health_dip` → "Run doctor", "Dismiss"
     - Default → "Acknowledge", "Dismiss"
  3. Expõe função `getPendingChallenges(shitennoDir)` que retorna lista de challenges com acções
  4. Expõe função `markChallengeResolved(shitennoDir, challengeId, action)` que:
     - Marca `resolved: true` no `daemon/state.json`
     - Registra a acção tomada em `session-feedback/records.jsonl` com outcome "challenge_acknowledged"
     - Publica evento `challenge.resolved` no event bus
- **Verificação:** `pnpm run typecheck` passa, módulo exporta funções correctas

### Step 2: Integrar prompt interactivo no briefing
- **Ficheiro:** `src/commands/briefing.ts`
- **Acção:** No final de `displayFullBriefing()`, antes de publicar `analysis.complete`:
  1. Chamar `getPendingChallenges(shitennoDir)`
  2. Se não houver challenges pendentes → nada muda
  3. Se houver challenges:
     - Mostrar secção `⚠️ Pending Challenges` com lista numerada
     - Usar inquirer `list` prompt: "O que deseja?"
     - Opções: "Executar acção sugerida", "Adiar para próxima sessão", "Marcar como lido", "Sair sem acção"
     - Chamar `markChallengeResolved()` conforme resposta
     - Se "Executar acção sugerida" → sugerir comando (ex: `shugo audit`) mas NÃO executar automaticamente (respeitar G-01)
  4. Se `--json` → incluir campo `pendingChallenges` no output JSON em vez de prompt
- **Verificação:** `pnpm run typecheck` passa, `shugo briefing` mostra prompt quando há challenges

### Step 3: Adicionar opção `--no-interactive` ao briefing
- **Ficheiro:** `src/commands/briefing.ts`
- **Acção:** Adicionar flag `--no-interactive` que:
  1. Desactiva o prompt interactivo
  2. Mantém a secção "Pending Challenges" no output (listagem apenas)
  3. Permite uso em CI/CD ou scripts automatizados
- **Verificação:** `shugo briefing --no-interactive` mostra challenges sem prompt

### Step 4: Actualizar `desktop-notifier.ts` para incluir hint
- **Ficheiro:** `src/desktop-notifier.ts`
- **Acção:** Na mensagem de notificação `handleChallengeGenerated`, adicionar:
  - Texto: "Run `shugo briefing` to respond"
  - Isto guia o utilizador para o ponto de interacção
- **Verificação:** Notificação mostra "Run `shugo briefing` to respond"

### Step 5: Actualizar briefing markdown output
- **Ficheiro:** `src/briefing.ts`
- **Acção:** Na função `briefingToMarkdown()`, adicionar secção:
  ```markdown
  ## ⚠️ Pending Challenges

  | # | Tipo | Severidade | Acção Sugerida |
  |---|---|---|---|
  | 1 | plan_completed | high | Run health audit |
  | 2 | drift_detected | medium | Review changes |

  Responder: `shugo briefing` (interactivo) ou `shugo acknowledge <id>`
  ```
- **Verificação:** `shugo briefing --write` gera BRIEFING.md com secção de challenges

### Step 6: Adicionar testes
- **Ficheiro:** `src/__tests__/challenge-responder.test.ts`
- **Acção:** Testes para:
  1. `getPendingChallenges()` retorna challenges não resolvidos
  2. `markChallengeResolved()` marca como resolvido e regista outcome
  3. Função retorna lista vazia quando não há challenges
  4. Acções sugeridas são correctas por tipo de challenge
- **Verificação:** `pnpm run test` passa com novos testes

### Step 7: Actualizar AGENTS.md e documentação
- **Ficheiro:** `src/templates/base/docs/AGENTS.md`
- **Acção:** Na secção "Comandos disponíveis", adicionar:
  ```
  - `shugo briefing` — agora inclui prompt interactivo para challenges pendentes
  ```
- **Ficheiro:** `src/templates/base/docs/Shitenno_GUIDE.md`
- **Acção:** Na Secção 15 (Comandos CLI), actualizar `shugo briefing` com descrição actualizada
- **Verificação:** Documentação consistente com implementação

---

## 🛡️ Salvaguardas S1..S6

**S1 — Não executar acções sem autorização:** O prompt sugere comandos mas NÃO os executa. O utilizador tem de copiar e executar manualmente (respeitar G-01).

**S2 — Não tocar código não-planeado:** Apenas criar `challenge-responder.ts` e modificar `briefing.ts` e `desktop-notifier.ts`. Não alterar lógica de negócio.

**S3 — Não avançar com falha:** Se `daemon/state.json` não existir ou estiver corrompido, challenges são ignorados (graceful degradation).

**S4 — G-01 explícito:** Nenhum `git commit` sem autorização. O plano termina antes do commit.

**S5 — Não duplicar lógica:** Reusar `daemon/state.json` existente, não criar novo armazenamento de challenges.

**S6 — Não quebrar output JSON:** Se `--json` estiver activo, challenges são incluídos como campo JSON, não como prompt interactivo.

---

## 📊 Métricas-alvo

| Métrica | Target | Tolerância |
|---|---|---|
| Linhas adicionadas em `challenge-responder.ts` | 80-120 linhas | ±20 |
| Linhas modificadas em `briefing.ts` | 30-50 linhas | ±10 |
| Linhas modificadas em `desktop-notifier.ts` | 5-10 linhas | ±3 |
| Testes novos | 4-6 testes | ±2 |
| Tempo de execução `shugo briefing` (com challenges) | < 2s | ±0.5s |
| Tokens adicionais no briefing (markdown) | < 100 tokens | ±20 |

---

## ⚠️ Pontos de pausa G-01

1. **Após Step 2:** Parar e pedir autorização antes de integrar prompt no briefing (modificação de comportamento do utilizador)
2. **Após Step 6:** Parar e pedir autorização antes de commitar (executar testes localmente primeiro)

---

## 📎 Referências

- `src/desktop-notifier.ts` — notificações proactivas actuais
- `src/briefing.ts` — geração de briefing
- `src/session-feedback.ts` — registo de outcomes
- `src/daemon/state.json` — armazenamento de challenges
- `src/commands/briefing.ts` — CLI command
- `governance/WORKFLOW.md` — workflow de sessão
