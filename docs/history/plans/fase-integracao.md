---
category: reference
lifecycle: Historical
---

# Plano de Integração — Transformar CLI em Sistema

## Contexto

5 módulos de infraestrutura foram criados mas não integrados. 3 módulos antigos continuam órfãos. Total: ~2.500 linhas de código morto. O Shugo continua sendo 10 ferramentas isoladas.

## Escopo

**Objetivo:** Conectar todos os módulos via event bus, eliminar duplicação, ativar os sistemas órfãos.

**Resultado esperado:** Um sistema onde módulos comunicam, comandos usam infraestrutura compartilhada, e o pipeline roda como uma unidade coesa.

---

## Fase 1 — Refatorar Comandos com shared.ts (8 etapas)

**Objetivo:** Eliminar ~280 linhas de duplicação e padronizar comandos.

| # | Etapa | Arquivo | Ação |
|---|-------|---------|------|
| 1.1 | Criar `resolveProjectContext()` usage | `src/shared.ts` | Já existe, verificar se funciona |
| 1.2 | Refatorar `status.ts` | `src/commands/status.ts` | Substituir init guard + banner + JSON boilerplate por `createShugoCommand()` |
| 1.3 | Refatorar `detect.ts` | `src/commands/detect.ts` | Mesmo padrão |
| 1.4 | Refatorar `audit.ts` | `src/commands/audit.ts` | Mesmo padrão |
| 1.5 | Refatorar `validate.ts` | `src/commands/validate.ts` | Mesmo padrão |
| 1.6 | Refatorar `assess.ts` | `src/commands/assess.ts` | Mesmo padrão |
| 1.7 | Refatorar `upgrade.ts` | `src/commands/upgrade.ts` | Mesmo padrão |
| 1.8 | Refatorar `doctor.ts`, `clean.ts`, `sync.ts` | 3 arquivos | Mesmo padrão |

**Critério:** Todos os 219 testes continuam passando. Linhas totais dos comandos reduzem ~800.

---

## Fase 2 — Criar Comando `shugo run` (3 etapas)

**Objetivo:** Entry point para o pipeline de análise completa.

| # | Etapa | Arquivo | Ação |
|---|-------|---------|------|
| 2.1 | Criar `src/commands/run.ts` | Novo | Implementa `shugo run` usando Pipeline + createPipelineContext |
| 2.2 | Registrar no CLI | `bin/shugo.ts` | Adicionar `run` ao program |
| 2.3 | Teste de integração | `src/__tests__/cli-integration.test.ts` | Adicionar teste para `shugo run` |

**Pipeline stages:** analyze → score → detect → audit → evolve

**Critério:** `shugo run` roda todas as análises em sequência e produz um relatório consolidado.

---

## Fase 3 — Wire Event Bus nos Comandos (10 etapas)

**Objetivo:** Todo comando publica eventos após completar.

| # | Comando | Eventos a Publicar | Ponto de Inserção |
|---|---------|-------------------|-------------------|
| 3.1 | `init` | `init:completed`, `maturity:initialized`, `capability:installed` | Após `invalidateCache()` (linha 196) |
| 3.2 | `status` | `status:completed`, `complexity:computed` | Após `writeComplexityReport()` (linha 105) |
| 3.3 | `detect` | `detect:completed`, `detect:patterns:found` | Após `writePatternReport()` (linha 82) |
| 3.4 | `audit` | `audit:completed`, `audit:issues:found` | Após `writeHealthReport()` (linha 82) |
| 3.5 | `assess` | `assess:completed`, `maturity:changed`, `capability:recommended` | Após `recordMaturitySnapshot()` (linha 192) |
| 3.6 | `upgrade` | `upgrade:completed`, `capability:installed` | Após `installCapabilities()` (linha 113/207) |
| 3.7 | `validate` | `validate:completed`, `session:valid/invalid` | Após `runValidationChecks()` (linha 55) |
| 3.8 | `doctor` | `doctor:completed`, `doctor:risk:detected` | Após `runDoctorAnalysis()` (linha 310) |
| 3.9 | `clean` | `cache:invalidated` | Após `invalidateCache()` (linha 61) |
| 3.10 | `sync` | `sync:completed` | Após sincronização (linha 193) |

**Critério:** Cada comando publica pelo menos 1 evento. `bus.getHistory()` registra todas as publicações.

---

## Fase 4 — Conectar Módulos Órfãos ao Event Bus (6 etapas)

**Objetivo:** Ativar knowledge-graph, rule-engine e auto-evolution.

### 4.1 knowledge-graph.ts → Event Bus
| Evento Subscrito | Ação |
|-----------------|------|
| `adr.created` | `discoverArtifacts()` + `discoverRelations()` |
| `skill.created` | Reconstruir grafo |
| `capability:installed` | Reconstruir grafo |

### 4.2 rule-engine.ts → Event Bus
| Evento Subscrito | Ação |
|-----------------|------|
| `session:start` | Executar regras com trigger `session_start` |
| `session:end` | Executar regras com trigger `session_end` |
| `validation:completed` | Executar regras com trigger `validation_fail/pass` |
| `maturity:changed` | Executar regras com trigger `maturity_change` |
| `detect:patterns:found` | Executar regras com trigger `pattern_detected` |
| `audit:completed` | Executar regras com trigger `health_check` |

### 4.3 auto-evolution.ts → Pipeline
| Pipeline Stage | Ação |
|---------------|------|
| `evolve` | Chamar `analyzeEvolution()` como último stage |

### 4.4 knowledge-graph.ts → auto-evolution
| Evento | Ação |
|--------|------|
| Grafo atualizado | Gerar `architecture_improvement` recommendations |

### 4.5 rule-engine.ts → feedback-loops
| Evento | Ação |
|--------|------|
| Rule executada | Gravar feedback da execução |

### 4.6 Testes de integração
- Testar que events flow: command → event bus → module reaction
- Testar que rule engine fires on events
- Testar que knowledge graph rebuilds on events

---

## Fase 5 — Lifecycle State Checks (4 etapas)

**Objetivo:** Cada comando verifica estado antes de executar.

| # | Comando | Estado Requerido | Onde Verificar |
|---|---------|-----------------|----------------|
| 5.1 | `init` | `uninitialized` | Início do action (já existe check ad-hoc, substituir) |
| 5.2 | `status/detect/audit/upgrade/doctor` | `discovered`+ | Após resolveProjectContext |
| 5.3 | `validate/sync/clean` | `discovered`+ | Após resolveProjectContext |
| 5.4 | `run` | `assessed`+ | No início do action |

**Implementação:** Em `shared.ts`, adicionar `checkLifecycleGate(command, projectRoot, shitennoDir)` que chama `detectLifecycleState()` + `canRunCommand()`.

---

## Fase 6 — Feedback Recording (4 etapas)

**Objetivo:** Gravar aceitação/rejeição de recomendações.

| # | Ponto de Gravação | Comando | O que Gravar |
|---|-------------------|---------|--------------|
| 6.1 | Após `upgrade` com sucesso | `upgrade` | Capability instalada, ação: accepted |
| 6.2 | Após `assess` com recomendações | `assess` | Recomendações geradas, ação: proposed |
| 6.3 | Após `doctor` com melhorias | `doctor` | Melhorias sugeridas, ação: proposed |
| 6.4 | Após `detect` com candidate rules | `detect` | Rules candidatas, ação: proposed |

---

## Fase 7 — Plugin Loading (3 etapas)

**Objetivo:** Carregar plugins no init e no pipeline.

| # | Etapa | Arquivo | Ação |
|---|-------|---------|------|
| 7.1 | Load plugins no init | `src/commands/init.ts` | Após scaffolding, chamar `loadPlugins()` e registrar no HookBus |
| 7.2 | Executar hooks no pipeline | `src/pipeline.ts` | Antes/depois de cada stage, executar `pre-analysis`/`post-analysis` hooks |
| 7.3 | Executar custom checks no audit | `src/commands/audit.ts` | Após health audit, executar `custom-check` hooks |

---

## Fase 8 — Testes e Validação (4 etapas)

**Objetivo:** Garantir que tudo funciona junto.

| # | Etapa | Ação |
|---|-------|------|
| 8.1 | Testes de integração do event bus | Testar fluxo completo: command → event → module |
| 8.2 | Testes do pipeline completo | Testar `shugo run` end-to-end |
| 8.3 | Testes de lifecycle gates | Testar que comandos são bloqueados em estados errados |
| 8.4 | Typecheck + lint + todos os testes | `npx tsc --noEmit && npm test` |

---

## Ordem de Execução

```
Fase 1 (refactor)  → Fase 2 (shugo run) → Fase 3 (event bus wiring)
                                                │
                                                ▼
                                          Fase 4 (orphan modules)
                                                │
                                                ▼
                                          Fase 5 (lifecycle gates)
                                                │
                                                ▼
                                          Fase 6 (feedback)
                                                │
                                                ▼
                                          Fase 7 (plugins)
                                                │
                                                ▼
                                          Fase 8 (tests)
```

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---------|-------|--------|
| Módulos integrados ao event bus | 1 (pipeline) | 8+ |
| Comandos publicando eventos | 0 | 10 |
| Código duplicado nos comandos | ~280 linhas | ~0 |
| Módulos órfãos | 8 | 0 |
| Comando `shugo run` | Não existe | Funcional |
| Lifecycle gates enforced | 0 | 10 |
| Feedback gravado | Nunca | Sempre |
| Plugins carregados | Nunca | Sempre |
| Testes | 219 | 250+ |
