---
category: reference
lifecycle: Historical
---

# Fase: System Live — Transformar Infraestrutura em Sistema Funcional

## Contexto

A infraestrutura está completa (8 módulos, 226 testes). Mas os módulos são "fachada":
- Rule engine tem 6 regras default mas nenhuma está escrita em disco
- Knowledge graph reconstrói mas não mostra insights ao usuário
- Auto-evolution gera recomendações mas não há comando para ver/aceitá-las
- Feedback grava mas não influencia recomendações futuras
- Plugin system existe mas nenhum plugin foi criado
- Lifecycle gates permitem todos os comandos (requerem apenas "discovered")

**Objetivo:** Criar os "carros na estrada" — comandos, regras, plugins e loops que façam o sistema agir, não apenas existir.

---

## 6 Gaps a Preencher

| # | Gap | O que falta | Esforço | Impacto |
|---|-----|-------------|---------|---------|
| 1 | **Comando `shugo evolve`** | Criar comando que mostra recomendações e grava feedback | Médio | **Alto** |
| 2 | **Regras default em disco** | `initializeRules()` gravar 10 regras em `governance/rules/` | Baixo | **Alto** |
| 3 | **Knowledge graph no audit** | Mostrar health score, órfãos, hubs, sugestões no audit | Baixo | **Médio** |
| 4 | **Feedback influencia evolução** | `analyzeEvolution()` consultar feedback e ajustar confiança | Médio | **Alto** |
| 5 | **Plugin de demonstração** | Criar `shitenno-plugins/health-check/` com hooks reais | Baixo | **Médio** |
| 6 | **Lifecycle gates restritivos** | Tornar gates mais exigentes (upgrade→assessed, sync→governed) | Baixo | **Médio** |

---

## Ordem de Execução

```
Gap 2 (regras)     →  Gap 1 (evolve)  →  Gap 4 (feedback loop)
       ↓                                        ↓
Gap 3 (graph audit) →  Gap 5 (plugin)  →  Gap 6 (gates)
```

---

## Detalhe por Gap

### Gap 1 — Comando `shugo evolve`

**Ficheiro:** `src/commands/evolve.ts` (novo)

**Funcionalidades:**
- Mostra recomendações do `analyzeEvolution()` por prioridade (urgent → high → medium → low)
- Para cada recomendação: título, descrição, impacto esperado, comando sugerido, confiança
- `--accept <id>` → grava feedback aceitação via `recordFeedback()`
- `--reject <id>` → grava feedback rejeição
- `--auto` → executa automaticamente recomendações urgentes com confiança > 0.8
- Publica evento `evolution.recommended` no event bus
- Mostra padrões de feedback ("Você rejeita sempre recomendações de X")

**Integrações:**
- `auto-evolution.ts` → `analyzeEvolution()`
- `feedback-loops.ts` → `recordFeedback()`, `detectFeedbackPatterns()`
- `event-bus.ts` → `publish("evolution.recommended", ...)`

---

### Gap 2 — Regras default em disco

**Ficheiro:** `src/rule-engine.ts` (modificar `initializeRules()`)

**Mudança:** Se `governance/rules/` estiver vazio, gravar 10 regras JSON:

| Regra | Trigger | Condição | Ação |
|-------|---------|----------|------|
| RULE-001 | session_start | — | log_event |
| RULE-002 | session_end | — | log_event |
| RULE-003 | validation_fail | failCount > 3 | trigger_health_check + create_reminder |
| RULE-004 | maturity_change | delta > 10 | update_quick_board |
| RULE-005 | knowledge_debt_detected | gapCount > 0 | update_backlog + create_reminder |
| RULE-006 | pattern_detected | patternCount > 0 | log_event |
| RULE-007 | pipeline_complete | healthScore < 50 | create_reminder "Melhorar saúde" |
| RULE-008 | adr_created | — | log_event + suggestion (verificar skill) |
| RULE-009 | validation_completed | passRate == 100 | log_event "Validação completa" |
| RULE-010 | session_start | knowledgeDebt > threshold | create_reminder |

---

### Gap 3 — Knowledge graph no audit

**Ficheiro:** `src/commands/audit.ts` (modificar)

**Adicionar secção "Knowledge Graph" com:**
- Health score do grafo (barra visual 0-100)
- Top 5 artefactos órfãos (nome + tipo)
- Top 5 hubs (nome + nº de conexões)
- Top 3 sugestões de melhoria
- Total de artefactos e relações

**Integrações:**
- `knowledge-graph.ts` → `discoverArtifacts()`, `discoverRelations()`, `analyzeGraph()`
- Publicar evento `knowledge.analyzed`

---

### Gap 4 — Feedback influencia auto-evolution

**Ficheiro:** `src/auto-evolution.ts` (modificar `analyzeEvolution()`)

**Mudanças:**
1. Carregar `getAllFeedbackSummaries()` no início
2. Para cada recomendação:
   - Se `rejectCount >= 5` → suprimir (não mostrar)
   - Se `acceptCount > 0` → aumentar confiança (+10%)
   - Se `rejectCount > 0` → diminuir confiança (-10%)
3. Adicionar campo `feedbackAdjusted: boolean` ao `EvolutionRecommendation`
4. No resumo: "X recomendações suprimidas pelo seu histórico"

**Ficheiro:** `src/commands/evolve.ts` (mostrar insights)

**Mostrar:**
- Padrões detetados: "Você rejeita sempre recomendações de capability_install"
- Taxa de aceitação geral
- Recomendações mais aceites/rejeitadas

---

### Gap 5 — Plugin de demonstração

**Ficheiro:** `shitenno-plugins/health-check/plugin.ts` (novo)

```typescript
// Plugin: health-check
// Hooks: custom-check, custom-recommendation

export default {
  name: "health-check",
  version: "1.0.0",
  description: "Verificações extras de saúde do projecto",
  hooks: {
    "custom-check": async (projectRoot, shitennoDir, report) => {
      // 1. Verificar se ADRs têm >90 dias → warning
      // 2. Verificar se há testes (tests/ ou *.test.ts)
      // 3. Verificar se governance/WORKFLOW.md existe
      // Retorna issues adicionais
    },
    "custom-recommendation": async (shitennoDir) => {
      // Se 0 ADRs → recomendar "Criar primeiro ADR"
    }
  }
}
```

**Ficheiro:** `shitenno-plugins/README.md` (novo)
- Instruções de como criar plugins
- Estrutura de directório
- Hooks disponíveis com exemplos

---

### Gap 6 — Lifecycle gates restritivos

**Ficheiro:** `src/shitenno-state-machine.ts` (modificar `COMMAND_GATES`)

| Comando | Gate Antes | Gate Depois |
|---------|------------|-------------|
| init | uninitialized | uninitialized |
| status | discovered | discovered |
| detect | discovered | discovered |
| audit | discovered | discovered |
| doctor | discovered | discovered |
| assess | discovered | discovered |
| **upgrade** | discovered | **assessed** |
| **validate** | discovered | **assessed** |
| **run** | discovered | **assessed** |
| **sync** | discovered | **governed** |
| **clean** | discovered | **governed** |
| **evolve** | discovered | **governed** |

**Racional:** Upgrade, validate e run precisam de contexto (assessment). Sync, clean e evolução precisam de governança ativa.

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Comandos novos | 0 | 1 (`evolve`) |
| Regras em disco | 0 | 10 |
| Insights no audit | 0 | 4 secções |
| Feedback influencia evolução | Não | Sim |
| Plugins funcionais | 0 | 1 |
| Comandos bloqueados por gates | 0 | 6 |

---

## Verificação

Para cada gap:
1. `npm test` → todos os 226+ testes passam
2. Novos testes escritos para funcionalidade nova
3. `shugo run` continua funcional
4. `shugo audit` mostra knowledge graph
5. `shugo evolve` mostra recomendações e grava feedback
6. Regras existem em `governance/rules/`
7. Plugin de demonstração é carregado em `shugo audit`
