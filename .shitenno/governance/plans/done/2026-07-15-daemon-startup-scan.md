# Daemon Startup Scan — Funções Proativas

**Status:** In Progress
**Updated_at:** 2026-07-21T15:11:11.054Z
**Date:** 2026-07-15
**Priority:** P0
**Backlog refs:** daemon-reactive-fix, proactive-scan

---

## Problema

O daemon do shitenno-go usa `ignoreInitial: true` no file-watcher. Quando o daemon arranca, ignora ficheiros existentes — só detecta alterações **depois** de iniciar. Isto significa que:
1. Planos com status "done" que já existem quando o daemon arranca nunca são arquivados
2. O daemon é puramente reactivo — não executa nenhuma função proativa ao arrancar
3. Não há auditoria periódica automática

## Solução

### FASE 1: Scan Inicial ao Arrancar (uma vez)

Adicionar secção "Initial Scan" no `daemon.ts`, entre `startWatching()` e "Daemon ready":

| # | Função | Descrição | Prioridade |
|---|---|---|---|
| 1 | `checkAndArchiveDonePlans()` | Arquiva planos com status "done" em plans/ | P0 (bug fix) |
| 2 | `initPlanBacklogSync()` | Sincroniza BACKLOG.md ↔ planos (reativo) | P1 |
| 3 | `consolidateEngineeringState()` | Actualiza estado de engenharia | P1 |
| 4 | `initializeKnowledgeGraph()` | Reconstrói grafo de conhecimento | P2 |
| 5 | `checkInconsistencies()` | Detecta planos com status inconsistente | P2 (NOVO) |
| 6 | `validateReminders()` | Verifica se reminders ainda são válidos | P2 (NOVO) |
| 7 | `moveCompletedBacklogToDone()` | Move itens concluído do backlog para done/ | P1 (NOVO) |

### FASE 2: Novas Funções a Criar

#### 2.1 `checkInconsistencies()` — NOVO
- Usa `InferenceEngine` existente (`inference-engine.ts`)
- Detecta planos com status "done" mas checkboxes abertos, ou vice-versa
- Publica evento `plan.inconsistency_detected` para o daemon registar

#### 2.2 `validateReminders()` — NOVO
- Lê `context_buffer.yaml` → `reminders[]`
- Verifica se cada reminder ainda é válido:
  - Reminder de "docs" → verificar se o doc ainda existe
  - Reminder de "bug" → verificar se o bug foi corrigido (plano associated done)
  - Reminder de "feature" → verificar se a feature foi implementada
  - Reminder com > 7 dias → marcar como "stale"
- Remove reminders stale via `clearRemindersByCategory()` (já existe)
- Publica evento `reminder.validated`

#### 2.3 `moveCompletedBacklogToDone()` — NOVO
- Lê `BACKLOG.md`, procura itens com `[x]` (concluídos)
- Cria directório `governance/plans/done/` se não existir
- Move itens concluídos para ficheiro datado: `done/YYYY-MM-DD-completed.md`
- Publica evento `backlog.items_archived`

### FASE 3: Reatividade Adicional

#### 3.1 Novo subscriber: `backlog.updated` → `moveCompletedBacklogToDone()`
Quando o backlog é actualizado, verificar se há itens novos concluídos e movê-los.

#### 3.2 Novo subscriber: `plan.inconsistency_detected` → log + tracking
O daemon regista inconsistências detectadas no state.

### FASE 4: Auditoria Periódica Adaptativa

O daemon calcula o intervalo de auditoria com base no `healthScore`:

| Health Score | Nível de Auditoria | Intervalo |
|---|---|---|
| > 70 | `quick` | 2 horas |
| 40-70 | `standard` | 30 minutos |
| < 40 | `code-review` | 10 minutos |

O sistema:
1. Lê o último `healthScore` do `engineering_state`
2. Calcula o intervalo adequado
3. Agenda `setInterval()` com o intervalo calculado
4. Executa `auditHealth(projectRoot, shitenDir, level)` periodicamente
5. Actualiza o intervalo se o health score mudar

## Ficheiros a Alterar

| Ficheiro | Acção |
|---|---|
| `src/daemon.ts` | Adicionar startup scan + novos subscribers + audit periódico |
| `src/plan-lifecycle.ts` | Já existe `checkAndArchiveDonePlans()` |
| `src/inference-engine.ts` | Já existe `InferenceEngine` — usar para inconsistências |
| `src/context-buffer-writer.ts` | Já existe `clearRemindersByCategory()` — usar para limpeza |
| `src/health-auditor.ts` | Já existe `auditHealth()` — usar para auditoria periódica |
| `src/engineering-state.ts` | Já existe `consolidateEngineeringState()` — usar no startup |

## Checklist

- [ ] FASE 1: Adicionar startup scan no daemon.ts
- [ ] FASE 2.1: Criar `checkInconsistencies()`
- [ ] FASE 2.2: Criar `validateReminders()`
- [ ] FASE 2.3: Criar `moveCompletedBacklogToDone()`
- [ ] FASE 3: Adicionar novos subscribers reactivos
- [ ] FASE 4: Implementar auditoria periódica adaptativa
- [ ] Testar: daemon arranca e executa scan inicial
- [ ] Testar: reminders stale são removidos
- [ ] Testar: backlog items concluídos são movidos
- [ ] Testar: auditoria periódica adjusta intervalo
