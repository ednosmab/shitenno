# RELATÓRIO: Maturidade das Capacidades do Projeto

**Data:** 2026-07-29
**Estado actual:** 9 capacidades instaladas, 1 activa, 8 configuradas
**Score geral:** 46/100

---

## 1. Diagnóstico Actual

### 1.1 Estado das Capacidades

| Capacidade | Maturidade | Score | Sinais Detectados |
|---|---|---|---|
| core | configured | 40 | ficheiros ✅ |
| knowledge | active | 75 | ficheiros ✅, skills ✅, relatórios ✅ |
| architecture | configured | 40 | ficheiros ✅ |
| governance | configured | 40 | ficheiros ✅ |
| ai | configured | 40 | ficheiros ✅ |
| quality | configured | 40 | ficheiros ✅ |
| metrics | configured | 55 | ficheiros ✅, relatórios ✅ |
| operations | configured | 40 | ficheiros ✅ |
| compliance | configured | 40 | ficheiros ✅ |

### 1.2 Sistema de Pontuação Actual

| Verificação | Pontos | O que verifica | Capacidades que ganham |
|---|---|---|---|
| Base (instalada) | 20 | Capacidade está na lista | Todas (9) |
| Ficheiros existem | +20 | Paths específicos no `.shitenno/` | Todas (9) |
| Regras com tag = ID | +20 | `governance/rules/*.json` tem tag igual ao ID | Nenhuma (0) |
| Skills instaladas | +15 | `docs/skills/` tem ficheiros .md | knowledge (1) |
| Templates | +10 | `templates/` existe e tem ficheiros | Nenhuma (0) |
| Relatórios/métricas | +15 | `reports/` tem ficheiros .json | metrics (1) |

### 1.3 Problema Identificado

**Nenhuma regra tem tags que correspondam aos IDs das capacidades.**

Tags existentes nas regras:
```
adrs, auto-audit, automation, backlog, briefing, buffer, completion,
context, critical, debt, docs, fix, handbook, health, hygiene, knowledge,
lifecycle, maturity, next_p0, plan, plans, reminder, semantic, session,
sync, tracking, validation, verification
```

IDs das capacidades:
```
core, knowledge, architecture, governance, ai, quality, metrics,
operations, compliance
```

**Intersecção: apenas "knowledge"** (existe como tag E como ID).

Isto significa que 8/9 capacidades nunca ganham os +20 pontos de regras.

---

## 2. Opções de Correcção

### Opção A: Baixar Thresholds

| Maturidade | Actual | Proposto |
|---|---|---|
| optimized | ≥ 80 | ≥ 70 |
| active | ≥ 60 | ≥ 50 |
| configured | ≥ 40 | ≥ 30 |

**Efeito.projected:**

| Capacidade | Score Actual | Novo Nível |
|---|---|---|
| core | 40 | active |
| knowledge | 75 | optimized |
| architecture | 40 | active |
| governance | 40 | active |
| ai | 40 | active |
| quality | 40 | active |
| metrics | 55 | active |
| operations | 40 | active |
| compliance | 40 | active |

**Resultado:** 8 active, 1 optimized, 0 configured/dormant

| Prós | Contras |
|---|---|
| Mudança mínima (3 linhas) | "Active" perde significado — basta ter ficheiros |
| Efeito imediato | Capacidades sem regras/skills ficam "activas" |
| Sem breaking changes | Incentivo ZERO para melhorar sinais |
| | Score geral sobe artificialmente |

**Ficheiros a modificar:** `src/capability-engine/maturity.ts` (linhas 28-31)

---

### Opção B: Adicionar Sinais de Detecção

Novos sinais a verificar:

| # | Sinal | Fonte de Dados | Pontos | Capacidades |
|---|---|---|---|---|
| 1 | ADRs escritos | `docs/adrs/ADR-[0-9]*.md` (exclui TEMPLATE) | +10 | architecture |
| 2 | Políticas activas | `governance/rules/*.json` com `enabled: true` | +10 | governance, compliance |
| 3 | Knowledge graph populated | `governance/knowledge-graph/artifacts.jsonl` tem >0 linhas | +5 | knowledge |
| 4 | Eventos no bus | `telemetry/` tem registos | +5 | ai |
| 5 | Contratos de agentes | `governance/agents/AI-CONTRACT-*.yaml` existe | +5 | ai |
| 6 | Scripts executados | `scripts/close-session.ts` existe e tem conteúdo | +5 | operations |
| 7 | Runbooks escritos | `docs/runbooks/*.md` (exclui TEMPLATE) | +5 | operations |
| 8 | Premortem preenchido | `governance/premortem/PREMORTEM.md` tem conteúdo | +5 | compliance |

**Efeito.projected (com threshold actual ≥ 60):**

| Capacidade | Score Actual | + Sinais | Score Final | Novo Nível |
|---|---|---|---|---|
| core | 40 | — | 40 | configured |
| knowledge | 75 | +5 (graph) | 80 | optimized |
| architecture | 40 | +10 (ADRs) | 50 | configured |
| governance | 40 | +10 (políticas) +5 (graph) | 55 | configured |
| ai | 40 | +5 (eventos) +5 (contratos) | 50 | configured |
| quality | 40 | — | 40 | configured |
| metrics | 55 | — | 55 | configured |
| operations | 40 | +5 (scripts) +5 (runbooks) | 50 | configured |
| compliance | 40 | +10 (políticas) +5 (premortem) | 55 | configured |

**Resultado:** 1 optimized, 0 active, 8 configured (melhor precisão, mas nenhum sobe de nível com threshold ≥ 60)

| Prós | Contras |
|---|---|
| Maturidade reflecte uso real | Mais código a manter (~80-100 linhas novas) |
| Dados já existem no filesystem | Sinais podem ser frágeis com refactors |
| Incentiva preencher gaps | Implementação demorada (~2-3h) |
| Sem alterar thresholds | Nenhuma capacidade atinge "active" |

**Ficheiros a modificar:** `src/capability-engine/maturity.ts` (+80-100 linhas)

---

### Opção C: Híbrida (Recomendada)

Combinar:
1. Baixar threshold de "active" de **60 para 50**
2. Adicionar **3 sinais de alto impacto** que já existem

**Sinais a adicionar:**

| # | Sinal | Fonte | Pontos | Capacidades |
|---|---|---|---|---|
| 1 | ADRs escritos | `docs/adrs/ADR-[0-9]*.md` | +10 | architecture |
| 2 | Políticas activas | `governance/rules/*.json` com `enabled: true` | +10 | governance, compliance |
| 3 | Knowledge graph populated | `artifacts.jsonl` com >0 linhas | +5 | knowledge |

**Efeito.projected:**

| Capacidade | Score Actual | + Sinais | Score Final | Threshold 50 | Threshold 60 |
|---|---|---|---|---|---|
| core | 40 | — | 40 | configured | configured |
| knowledge | 75 | +5 (graph) | 80 | optimized | optimized |
| architecture | 40 | +10 (ADRs) | 50 | **active** | configured |
| governance | 40 | +10 (políticas) +5 (graph) | 55 | **active** | configured |
| ai | 40 | — | 40 | configured | configured |
| quality | 40 | — | 40 | configured | configured |
| metrics | 55 | — | 55 | **active** | configured |
| operations | 40 | — | 40 | configured | configured |
| compliance | 40 | +10 (políticas) | 50 | **active** | configured |

**Resultado (threshold 50):** 1 optimized, 4 active, 4 configured
**Resultado (threshold 60):** 1 optimized, 0 active, 8 configured

| Prós | Contras |
|---|---|
| Equilíbrio entre precisão e esforço | Threshold 50 pode ser baixo demais |
| Sinais usam dados já existentes | Ainda precisa de ~40-50 linhas novas |
| 4 capacidades atingem "active" | governance e compliance dependem de regras |
| Implementação rápida (~1h) | core e ai ficam em "configured" |

**Ficheiros a modificar:** `src/capability-engine/maturity.ts` (~40-50 linhas)

---

## 3. Matriz de Decisão

| Critério | Opção A | Opção B | Opção C |
|---|---|---|---|
| Esforço de implementação | ⭐⭐⭐ (minimo) | ⭐ (alto) | ⭐⭐ (médio) |
| Precisão dos dados | ⭐ (baixa) | ⭐⭐⭐ (alta) | ⭐⭐ (média) |
| Impacto no utilizador | ⭐⭐ (visual) | ⭐⭐⭐ (real) | ⭐⭐ (equilibrado) |
| Manutenção futura | ⭐⭐⭐ (nenhuma) | ⭐ (manutenção) | ⭐⭐ (pouca) |
| Breaking changes | Nenhum | Nenhum | Nenhum |
| Tempo de implementação | ~5 min | ~2-3h | ~1h |

---

## 4. Recomendação

**Opção C (Híbrida)** — Baixar threshold para 50 + adicionar 3 sinais.

**Justificação:**
- Knowledge já está em 80 (optimized) — o sistema funciona
- Architecture, governance, metrics, compliance merecem "active" porque têm sinais reais
- Core e ai ficam "configured" porque realmente não têm sinais suficientes ainda
- O esforço é razoável (~1h) e o resultado é significativo
- Se depois quiseres mais precisão, podes sempre adicionar os sinais da Opção B

---

## 5. Dados para Referência

### 5.1 Sinais Disponíveis ( filesystem actual)

```
✅ docs/adrs/ADR-001.md ... ADR-010.md     (10 ADRs escritos)
✅ governance/rules/*.json                   (13 regras, 0 com tags de capacidade)
✅ governance/knowledge-graph/artifacts.jsonl (dados presentes)
✅ governance/agents/AI-CONTRACT-*.yaml      (4 contratos)
✅ telemetry/*.jsonl                         (dados presentes)
✅ scripts/close-session.ts                  (existe)
✅ docs/runbooks/*.md                        (existe)
✅ governance/premortem/PREMORTEM.md         (existe)
❌ templates/                                (directório não existe)
```

### 5.2 Referência de Thresholds

| Nível | Significado | Actual | Proposto (C) |
|---|---|---|---|
| optimized | Capitaliza plenamente | ≥ 80 | ≥ 80 |
| active | Em uso regular | ≥ 60 | ≥ 50 |
| configured | Configurada mas subutilizada | ≥ 40 | ≥ 40 |
| installed | Apenas instalada | < 40 | < 40 |

---

*Gerado automaticamente para análise. Dados de: 2026-07-29*
