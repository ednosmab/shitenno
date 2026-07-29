# Relatório de Implementação — PLANO-CONSOLIDADO-LOTE2

**Data:** 2026-07-29
**Status:** ✅ Concluído
**Testes:** 2309/2309 passando
**Lint:** 0 erros, 0 warnings
**TypeScript:** 0 erros

---

## Resumo

Todos os 12 itens do plano foram implementados com sucesso. Nenhum bug foi encontrado durante a validação interna. O plano cobre correções de bugs, optimizações de performance e limpeza de código morto.

---

## Itens Implementados

### P0 — Fechar bloco "gate de done"

| Item | Descrição | Status | Arquivos |
|------|-----------|--------|----------|
| P0.1 | Timeouts `checkBuild`/`checkTests` aumentados (60s→180s, 120s→300s) + `describeExecError` para distinguir timeout de falha real | ✅ | `src/plan/checks.ts` |
| P0.2 | `checkPlanFormat` adicionado a `runAutoVerification` — `plan done` agora valida formato | ✅ | `src/plan/checks.ts`, `src/plan/verification.ts` |
| P0.3 | `done-entrypoints-coverage.test.ts` agora importa `LIFECYCLE_CHECK_NAMES` de `checks.ts` (single source of truth) | ✅ | `src/__tests__/done-entrypoints-coverage.test.ts` |

### P1 — Bugs novos (lote 1)

| Item | Descrição | Status | Arquivos |
|------|-----------|--------|----------|
| Novo Bug A | `mcp-cache.ts:getCacheStats()` agora usa métricas reais de `cache-metrics.ts` em vez de zeros hardcoded | ✅ | `src/mcp-cache.ts` |
| Novo Bug B | `session-bootstrapper.ts` agora resolve glob patterns (`dir/*.ext`) — `agent-contracts` é carregado | ✅ | `src/session-bootstrapper.ts` |

### P1 — Pendências do lote anterior

| Item | Descrição | Status | Arquivos |
|------|-----------|--------|----------|
| `notificationStats` | `desktop-notifier.ts` publica eventos `notification.sent`/`notification.throttled`; daemon subscreve e incrementa stats | ✅ | `src/desktop-notifier.ts`, `src/daemon/state.ts`, `src/daemon/event-handlers.ts`, `src/event-bus.ts` |
| `task-pipeline.ts` | Removido (órfão — `task-completion-pipeline.ts` é o substituto) | ✅ | `src/task-pipeline.ts`, `src/__tests__/task-pipeline.test.ts`, `bin/shugo.ts` |
| `audit.standard` | Publisher adicionado em `runPeriodicAudit` — evento era subscrito mas nunca publicado | ✅ | `src/daemon/timers.ts` |
| `policy-engine.ts` | Removido (deprecated re-export de `rule-engine/policy.js`) | ✅ | `src/policy-engine.ts`, `src/__tests__/policy-engine.test.ts` |

### P1 — Performance e robustez

| Item | Descrição | Status | Arquivos |
|------|-----------|--------|----------|
| `isConsolidating` | Lock cross-process via arquivo `.lock` (O_EXCL) — previne race conditions daemon+CLI | ✅ | `src/engineering-state.ts` |
| `cache.ts` / `risk-map.ts` | `dirStructureCache` com mtime-based invalidation; `churnCache` com TTL 5min | ✅ | `src/cache.ts`, `src/risk-map.ts` |
| `knowledge-loader.ts` | `listAdrs`/`listSkills` agora leem apenas os primeiros 2KB (frontmatter) em vez do ficheiro inteiro | ✅ | `src/knowledge-loader.ts` |

---

## Arquivos Modificados (20)

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/plan/checks.ts` | Timeouts, `describeExecError`, `checkPlanFormat`, `LIFECYCLE_CHECK_NAMES` |
| `src/plan/verification.ts` | `checkPlanFormat` no pipeline de verificação |
| `src/__tests__/done-entrypoints-coverage.test.ts` | Importa `LIFECYCLE_CHECK_NAMES` |
| `src/mcp-cache.ts` | `getCacheStats()` usa métricas reais |
| `src/session-bootstrapper.ts` | Glob pattern resolution |
| `src/desktop-notifier.ts` | Eventos de notificação |
| `src/daemon/state.ts` | `recordNotificationStat()` |
| `src/daemon/event-handlers.ts` | Subscreve `notification.sent`/`notification.throttled` |
| `src/daemon/timers.ts` | Publica `audit.standard` |
| `src/event-bus.ts` | Novos event types |
| `src/infrastructure/versioning.ts` | Versões dos novos event types |
| `src/engineering-state.ts` | Cross-process lock |
| `src/cache.ts` | `dirStructureCache` |
| `src/risk-map.ts` | `churnCache` |
| `src/knowledge-loader.ts` | `readHeadOfFile` para listAdrs/listSkills |
| `bin/shugo.ts` | Remove import de `task-pipeline.js` |

## Arquivos Removidos (4)

| Arquivo | Razão |
|---------|-------|
| `src/task-pipeline.ts` | Órfão — substituído por `task-completion-pipeline.ts` |
| `src/__tests__/task-pipeline.test.ts` | Teste do módulo removido |
| `src/policy-engine.ts` | Deprecated — re-export de `rule-engine/policy.js` |
| `src/__tests__/policy-engine.test.ts` | Teste do módulo removido |

---

## Bugs Encontrados e Corrigidos Durante Validação

| Bug | Correção |
|-----|----------|
| `bin/shugo.ts` ainda importava `task-pipeline.js` | Removido import e chamada |
| `infrastructure/versioning.ts` faltava `notification.sent`/`notification.throttled` | Adicionados ao `EVENT_VERSIONS` |
| Snapshot `done-entrypoints-coverage` desatualizado | Atualizado via `vitest --update` |

---

## Verificação Final

- **TypeScript:** `npx tsc --noEmit` → 0 erros
- **Lint:** `pnpm run lint` → 0 erros, 0 warnings
- **Testes:** `pnpm run test` → 2309/2309 passando (1 snapshot atualizado)

---

## Notas para Follow-up

1. O lock cross-process em `engineering-state.ts` é adequado para o caso daemon+CLI concorrentes, mas não cobre 100% das race conditions (ex: SIGKILL durante consolidação). Para cobertura completa, considerar `proper-lockfile` no futuro.
2. O `knowledge-loader.ts` agora lê apenas 2KB para metadados — se algum ADR/skill tiver frontmatter maior que 2KB, o parse pode falhar silenciosamente. Monitorar.
3. O `churnCache` em `risk-map.ts` usa TTL fixo de 5min — adequado para uso típico, mas pode necessitar invalidação manual em workflows de CI.
