**Status:** In Progress
**Updated_at:** 2026-08-11T14:46:28.778Z
**Date:** 2026-08-11

# Dead code cleanup — remove orphaned modules, duplicate files and dead events

## Context

Auditoria de código não ligado (2026-08-11) revelou código morto no repositório. A análise foi feita em 2 passadas: (1) scan estático de imports/exports, (2) análise profunda de dynamic imports, evento-bus (incluindo persisted-event reads), barrel re-exports e cadeias internas de chamada. **A análise profunda corrigiu 22 falsos positivos** — módulos como `model-config.ts` (dynamic import em `bin/shugo.ts:129`), `daemon.ts` (entry point tsup + spawn target), eventos `plan.format_warning`/`context.p4_loaded` (consumidos via persisted-event reads em `enrichments.ts` e `context-tier-detectors.ts`), e várias funções com cadeias internas de produção.

O que resta é código **genuinamente** morto: 15 ficheiros órfãos (5 duplicados, 5 infraestrutura não ligada, 5 comandos duplicados), 1 módulo aplicacional órfão, 2 eventos publicados com `as never` sem qualquer consumidor, e 28 funções test-only.

## Objetivo

Remover todo o código genuinamente morto sem quebrar comportamento, e corrigir publicações de eventos sem consumidor.

Critérios de aceitação:
1. Remover 16 ficheiros órfãos (15 + task-completion) e os seus testes associados
2. Remover 2 eventos sem consumidor (`challenge.resolved`, `challenge.resolution_undone`) do `challenge-responder.ts`
3. Remover 28 exports test-only (sem tocar nas funções com cadeias de produção)
4. `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:unit` verdes após cada fase
5. Pipeline completo (6 gates) verde no fim

## Checklist

- [ ] Fase 1: Remover 5 ficheiros substituídos (shared/errors, shared/utils, semantic/insight-rules, semantic/rules/classification-rules, persistence/manifest)
- [ ] Fase 2: Remover 6 módulos de infraestrutura não ligada (mandatory-context-generator, inference-cache, context-index-builder, backlog-transitions, atomic-write, task-completion)
- [ ] Fase 3: Remover 5 comandos duplicados (assess/profile, daemon/logs, doctor/display, feedback/modes, sync/display)
- [ ] Fase 4: Remover publicações de eventos sem consumidor (challenge.resolved, challenge.resolution_undone)
- [ ] Fase 5: Remover 28 exports test-only
- [ ] Fase 6: Verificação final — lint, typecheck, test:unit, pipeline full 6/6, sync-docs

## Passos de Implementação

### Fase 1: Remover ficheiros substituídos/duplicados (risco zero)

#### Step 1: Duplicados exactos de módulos activos
**Ficheiro:** `src/shared/errors.ts`
**Acção:** Remover ficheiro + testes que o importem (se existirem)
**Verificação:** `grep -rn "shared/errors" src/ | grep -v __tests__` vazio; `pnpm run typecheck` OK

**Ficheiro:** `src/shared/utils.ts`
**Acção:** Remover ficheiro + testes associados
**Verificação:** `grep -rn "shared/utils" src/ | grep -v __tests__` vazio; production usa `infrastructure/utils.js` (8 consumidores confirmados)

**Ficheiro:** `src/semantic/insight-rules.ts`
**Acção:** Remover ficheiro + testes associados
**Verificação:** `grep -rn "semantic/insight-rules" src/ | grep -v __tests__` vazio; production usa `./reasoner/insight-rules.js`

**Ficheiro:** `src/semantic/rules/classification-rules.ts`
**Acção:** Remover ficheiro agregador + testes associados
**Verificação:** `grep -rn "rules/classification-rules" src/ | grep -v __tests__` vazio; `semantic/rules.ts` importa os 3 sub-ficheiros directamente

**Ficheiro:** `src/infrastructure/persistence/manifest.ts`
**Acção:** Remover ficheiro (zero importações, zero testes)
**Verificação:** `grep -rn "persistence/manifest" src/` vazio; NOTA: NÃO confundir com `src/infrastructure/manifest.ts` (esse é importado por `commands/update.ts:85` — manter)

### Fase 2: Remover infraestrutura não ligada

#### Step 2: Módulos sem qualquer caminho de loading
**Ficheiro:** `src/infrastructure/mandatory-context-generator.ts`
**Acção:** Remover ficheiro + testes associados
**Verificação:** `grep -rn "mandatory-context-generator" src/ | grep -v __tests__` vazio; NOTA: `sync-docs.ts` tem lógica independente de MANDATORY_CONTEXT — não depende deste módulo

**Ficheiro:** `src/infrastructure/inference-cache.ts`
**Acção:** Remover ficheiro + testes (`inference-cache.test.ts`, refs em `performance-benchmark.test.ts`)
**Verificação:** `grep -rn "inference-cache" src/ | grep -v __tests__` vazio; remover refs nos testes

**Ficheiro:** `src/infrastructure/context-index-builder.ts`
**Acção:** Remover ficheiro + teste (`context-index-builder.test.ts`)
**Verificação:** `grep -rn "context-index-builder" src/ | grep -v __tests__` vazio

**Ficheiro:** `src/infrastructure/backlog-transitions.ts`
**Acção:** Remover ficheiro + teste (`backlog-transitions.test.ts`)
**Verificação:** `grep -rn "backlog-transitions" src/ | grep -v __tests__` vazio; NOTA: `canTransition` em `shitenno-state-machine.ts` é código diferente — manter

**Ficheiro:** `src/infrastructure/atomic-write.ts`
**Acção:** Remover ficheiro (zero importações prod e teste; JSDoc "Used by session-tracker and context-buffer-writer" é obsoleto — nenhum importa)
**Verificação:** `grep -rn "atomic-write" src/` vazio

#### Step 3: Módulo aplicacional órfão
**Ficheiro:** `src/application/task-completion.ts`
**Acção:** Remover ficheiro + teste (`task-completion.test.ts`)
**Verificação:** `grep -rn "task-completion" src/ | grep -v __tests__` vazio; `validateCompletionGate` não tem nenhum consumidor de produção (wire está previsto para close:session mas não existe)

### Fase 3: Remover comandos duplicados

#### Step 4: Ficheiros com implementações inlinadas no pai
**Ficheiro:** `src/commands/assess/profile.ts`
**Acção:** Remover ficheiro + testes associados (o pai `assess.ts` re-declara as 5 funções localmente)
**Verificação:** `grep -rn "assess/profile" src/` vazio

**Ficheiro:** `src/commands/doctor/display.ts`
**Acção:** Remover ficheiro + testes associados (o pai `doctor.ts` re-declara as 5 funções localmente)
**Verificação:** `grep -rn "doctor/display" src/` vazio

**Ficheiro:** `src/commands/sync/display.ts`
**Acção:** Remover ficheiro + testes associados (o pai `sync.ts` re-declara as 7 funções localmente)
**Verificação:** `grep -rn "sync/display" src/` vazio

#### Step 5: Ficheiros substituídos por irmãos activos
**Ficheiro:** `src/commands/daemon/logs.ts`
**Acção:** Remover ficheiro (pai usa `attachToDaemonLog` de `./daemon/display.ts`, versão idêntica; `handleLogsAction` re-declarado no pai)
**Verificação:** `grep -rn "daemon/logs" src/` vazio; `shugo daemon logs` continua a funcionar

**Ficheiro:** `src/commands/feedback/modes.ts`
**Acção:** Remover ficheiro (pai usa `./feedback/display.ts` com as mesmas 4 funções)
**Verificação:** `grep -rn "feedback/modes" src/` vazio; `shugo feedback` continua a funcionar

### Fase 4: Remover eventos sem consumidor

#### Step 6: Desligar publicações mortas
**Ficheiro:** `src/infrastructure/challenge-responder.ts`
**Acção:** Remover as 2 publicações `challenge.resolved` (linha 104) e `challenge.resolution_undone` (linha 156), ambas com cast `as never` (não estão no tipo `ShitennoEventType` e não têm consumidores de qualquer tipo — live, persisted-read, rule engine ou semantic runner)
**Verificação:** `grep -rn "challenge.resolved\|challenge.resolution_undone" src/ | grep -v __tests__` vazio; se houver testes a verificar estas publicações, removê-los

### Fase 5: Remover exports test-only

#### Step 7: Remover exports mortos (manter funções com cadeias de produção)
**Ficheiro:** `src/application/backlog-state-machine.ts`
**Acção:** Remover exports `parseBacklog`, `findBacklogItem`, `completeTask` (usar `parseBacklogItems`/`findItem`/`transitionTask` directamente); manter `transitionTask`
**Verificação:** `pnpm run typecheck` OK; testes `backlog-state-machine.test.ts` atualizados

**Ficheiro:** `src/application/briefing-injection.ts`
**Acção:** Remover exports `buildBriefingContextBlock`, `isTrivialPrompt` (consumidor previsto `.opencode/plugin/shitenno-briefing.ts` NÃO existe no repo)
**Verificação:** `pnpm run typecheck` OK; testes atualizados

**Ficheiro:** `src/application/challenge-generator.ts`
**Acção:** Remover exports `detectParadigmShift`, `ensureFlowState` (mantém `calculateKnowledgeGap` — usado via `generateChallengingAlternative` → `auto-evolution.ts`)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/application/state-manager.ts`
**Acção:** Remover exports `consolidateState` (deprecated), `stateToText`
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/domain/rules/context-rules.ts`
**Acção:** Remover export `contextRulesToMarkdown` (manter `generateContextRules` — produção)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/domain/rules/health-score-registry.ts`
**Acção:** Remover exports `getCodeSecurityScore`, `getOverallHealth` (manter `getEngineeringRiskScore`, `getKnowledgeHealthScore` — produção)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/domain/types/capability-mapping.ts`
**Acção:** Remover export `getCapabilityDirectories` (manter `getCapabilityMapping`, `getCapabilityFiles`)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/domain/types/help-data.ts`
**Acção:** Remover exports `findCommand`, `getAllCommandNames`
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/shared/formatting.ts`
**Acção:** Remover export `miniBar` (manter `healthBar`, `outputJson`, `banner` — produção)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/shared/cache-metrics.ts`
**Acção:** Remover exports `logCachePerformance`, `getAllCacheStats`, `resetMetrics`, `resetAllMetrics`, `getPerformanceReport` (sem consumidores de produção)
**Verificação:** `pnpm run typecheck` OK; verificar se `getCacheStats` base é usado em produção

**Ficheiro:** `src/shared/session-context.ts`
**Acção:** Remover export `getSessionStartedAt` (manter `setSessionContext`, `clearSessionContext` — usados em `bin/shugo.ts`)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/infrastructure/session-feedback.ts`
**Acção:** Remover exports `getFeedbackForSession`, `getLatestFeedback`
**Verificação:** `pnpm run typecheck` OK; testes `session-feedback-extended.test.ts` atualizados

**Ficheiro:** `src/infrastructure/usage-tracker.ts`
**Acção:** Remover export `getUsageStats` (manter `recordToolCall` — usado em `mcp-server.ts:241`)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/infrastructure/dynamic-rules.ts`
**Acção:** Remover export `dynamicRulesToMarkdown` (manter `generateDynamicRules` — produção)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/infrastructure/skill-manifest.ts` + `src/infrastructure/rule-manifest.ts`
**Acção:** Remover exports `resolveSkills`, `resolveRules` (production usa `partitionSkills`/`partitionRules`)
**Verificação:** `pnpm run typecheck` OK

**Ficheiro:** `src/infrastructure/plugin-system.ts`
**Acção:** Remover export `resetHookBus` (test helper; `HookBus` class mantém — usado via `getHookBus()`)
**Verificação:** `pnpm run typecheck` OK

### Fase 6: Verificação final

#### Step 8: Validação completa
**Acção:** Correr `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:unit`, `node ./dist/bin/shugo.js pipeline exec --full`
**Verificação:** 6/6 gates verdes; `npx tsx .shitenno/scripts/sync-docs.ts` sem erros; README statistics atualizadas (contagem de testes)

#### Step 9: Atualizar docs e contexto
**Acção:** Atualizar `docs/reference/events.md` (se menciona `challenge.resolved`), `docs/architecture/*` (context-map/registrations), SYSTEM_MAP_TREE via `sync-docs --fix`
**Verificação:** `sync-docs` 0 erros; `docs-audit` sem novos achados

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | NÃO remover `model-config.ts`, `daemon.ts`, `capability-engine.ts` | Remoção por scan estático | Análise profunda provou dynamic imports (`bin/shugo.ts:129`) e spawn targets — são código vivo |
| 2 | NÃO remover eventos `plan.format_warning`/`context.p4_loaded` | Remoção por falta de subscribers no bus | Consumidores indirectos via persisted-event reads (`enrichments.ts`, `context-tier-detectors.ts`) — remover quebraria briefing e audit |
| 3 | Manter funções com cadeias internas de produção | Remoção por falta de imports directos | `calculateKnowledgeGap`, `detectDirectoryScore`, `buildTrendSnapshots`, `recordPathChoice`-chain etc. são chamadas internamente por funções usadas |
| 4 | Remover `challenge.resolved`/`challenge.resolution_undone` | Adicionar subscribers | Publicadas com `as never` (fora do tipo), zero consumidores de qualquer tipo — adicionar subscribers seria inventar funcionalidade |
| 5 | Remover exports test-only sem deletar módulos | Deletar módulos inteiros | Módulos têm outras funções em produção — apenas os exports mortos são removidos |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Remover ficheiro que outro código importa por dynamic import não detetado | Alto | Grep duplo por cada ficheiro antes de remover; verificação via typecheck + pipeline após cada fase |
| 2 | `persistence/manifest.ts` confundido com `infrastructure/manifest.ts` | Médio | NOTA explícita no passo; o segundo é importado por `commands/update.ts:85` |
| 3 | Testes que importam ficheiros removidos ficam órfãos | Médio | Remover/atualizar testes na mesma fase; `test:unit` valida após cada fase |
| 4 | README statistics (contagem de testes) ficam desatualizadas | Baixo | `sync-docs --fix` no fim |
| 5 | `heavy-bootstrap-scoping.test.ts` detecta alterações no bootstrap | Baixo | Não adicionar imports pesados a paths leves; re-correr o teste específico |

## Notes

- Análise feita em 2026-08-11 com 3 passes: (1) scan estático de imports (2 agentes), (2) dynamic imports + barrel + configs (1 agente), (3) consumidores indirectos de eventos persistidos + cadeias internas (2 agentes)
- Resultado corrigido: 17→15 ficheiros órfãos, 5→1 módulos mortos, 4→2 eventos mortos, ~58→28 funções test-only
- Context-map registrations (`.shitenno/governance/context-map.md`?) referenciam módulos órfãos — atualizar quando removidos
- Este plano foi criado para execução posterior (2026-08-11): briefing atualizado, backlog tem item correspondente
