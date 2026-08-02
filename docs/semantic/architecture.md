---
category: product
lifecycle: Active
---

# Arquitectura do Semantic Layer

## Visão Geral

O Semantic Layer transforma eventos brutos do sistema em conhecimento semântico
estruturado. O sistema classifica, detecta padrões, raciocina e apresenta
opções ao utilizador — tudo de forma determinística e auditável.

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVENT BUS (76 eventos)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SIGNAL CLASSIFIER                             │
│  src/semantic/signal-classifier.ts                              │
│  • Classifica cada evento num domínio semântico                 │
│  • Usa regras regex (src/semantic/rules.ts)                     │
│  • Taxonomia: 12 domínios, 60+ subdomínios                     │
│  • Output: SemanticClassification { domain, subdomain, ... }   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CHANGE JOURNAL                                │
│  src/semantic/change-journal.ts                                 │
│  • Time-series de classificações semânticas                     │
│  • Persistido em JSONL (.shitenno/governance/change-journal)    │
│  • Query por domínio, sinal, confiança, período                 │
│  • Rotação automática a 2MB                                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PATTERN MATCHER                               │
│  src/semantic/pattern-matcher.ts                                │
│  • Analisa journal para detectar padrões temporais              │
│  • 6 regras: architectural_shift, scope_drift, security_...    │
│  • Publica semantic.pattern_detected no event bus               │
│  • Histórico de detecções para auditoria                        │
└──────────┬────────────────────────────────────┬─────────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│      REASONER            │  │         CORRELATOR                │
│  src/semantic/reasoner.ts│  │  src/semantic/correlator.ts       │
│  • 6 regras de raciocínio│  │  • 4 regras de correlação        │
│  • Connecte padrões com  │  │  • Risk-Maturity Divergence      │
│    risk, maturity, health│  │  • Health-Knowledge Mismatch     │
│  • Gera insights com     │  │  • Domain Isolation              │
│    prioridade            │  │  • Cascade Effect                │
└──────────┬───────────────┘  └──────────────────┬───────────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DUAL PATH PRESENTER                           │
│  src/semantic/dual-path-presenter.ts                            │
│  • Formata padrões detectados em Path A + Path B                │
│  • 6 templates por tipo de padrão                               │
│  • Adaptado pelo Growth Profile do utilizador                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GROWTH PROFILE                                │
│  src/semantic/growth-profile.ts                                 │
│  • Registra escolhas do utilizador                              │
│  • Calcula growthCapacity e challengeLevel                      │
│  • Adapta nível por domínio                                     │
│  • Detecta padrões de comportamento                             │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

### 1. Classificação (tempo real)

```
Evento bruto → Signal Classifier → SemanticClassification → Journal
```

Cada evento que entra no event bus é classificado instantaneamente.
A classificação é gravada no journal para consulta futura.

### 2. Detecção de Padrões (periódica — 15min)

```
Journal → Pattern Matcher → DetectedPattern[] → Event Bus
```

O daemon roda o pattern matcher no timer de consolidação.
Padrões detectados são publicados como eventos.

### 3. Raciocínio (periódica — 15min)

```
Patterns + Risk + Maturity + Health → Reasoner → SemanticInsight[] → Event Bus
```

O reasoner connecta padrões com dados de outros subsistemas
para gerar insights de nível superior.

### 4. Correlação (periódica — 15min)

```
Journal + Risk + Maturity + Health → Correlator → Correlation[]
```

O correlator detecta correlações entre subsistemas que
um subsistema isolado não consegue ver.

### 5. Apresentação (sob demanda)

```
DetectedPattern + GrowthProfile → DualPathPresentation → Utilizador
```

Quando o utilizador executa um comando (evolve, detect, etc.),
os padrões são formatados em dual path e apresentados.

## Princípios de Design

### 1. Determinístico

Mesma entrada sempre produz mesma saída. Sem LLMs, sem randomização.
Cada classificação pode ser rastreada até uma regra específica.

### 2. Auditável

O journal mantém histórico completo de todas as classificações.
O pattern matcher mantém histórico de todas as detecções.
Cada insight tem evidência rastreável.

### 3. Incremental

Cada fase é útil isoladamente:
- **Fase 1** (classificação) — já fornece visibilidade
- **Fase 2** (padrões) — adiciona detecção temporal
- **Fase 3** (dual path) — adiciona interacção humana
- **Fase 4** (raciocínio) — adiciona insights cross-system

### 4. Não-invasivo

O Semantic Layer é um **consumer** do event bus — não modifica
comportamento existente. É integrado no daemon como um
módulo adicional que se subscreve a eventos.

## Dependências

```
semantic/taxonomy.ts        ← (sem dependências externas)
semantic/rules.ts           ← taxonomy.ts
semantic/signal-classifier.ts ← taxonomy.ts, rules.ts, event-bus.ts
semantic/change-journal.ts  ← taxonomy.ts, logger.ts
semantic/pattern-rules.ts   ← taxonomy.ts, change-journal.ts
semantic/pattern-matcher.ts ← pattern-rules.ts, change-journal.ts, event-bus.ts
semantic/growth-profile.ts  ← pattern-rules.ts, growth-profile.ts (base)
semantic/dual-path-presenter.ts ← pattern-rules.ts, growth-profile.ts, chalk
semantic/reasoner.ts        ← taxonomy.ts, pattern-rules.ts, change-journal.ts
semantic/correlator.ts      ← taxonomy.ts, change-journal.ts
semantic/index.ts           ← (barrel export de tudo)
```

## Decisões Arquiteturais

| # | Decisão | Alternativa Rejeitada | Ração |
|---|---------|----------------------|-------|
| 1 | Consumer do event bus, não modificador | Modificar event bus | Não-invasivo |
| 2 | JSONL para journal | SQLite | Simplicidade, append-only, sem dependências |
| 3 | Regras regex para classificação | ML/LLM | Determinístico, auditável, sem custo |
| 4 | Singleton com factory functions | Classes estáticas | Testabilidade (reset entre testes) |
| 5 | Timer de 15min para consolidação | Contínuo | Performance, sem overhead desnecessário |
| 6 | Dual path com templates | Geração dinâmica | Consistência, previsibilidade |

## Métricas de Performance

| Métrica | Target | Notas |
|---------|--------|-------|
| Latência de classificação | <1ms por evento | Regras regex são rápidas |
| Journal size | <2MB | Rotação automática |
| Pattern detection | <100ms | Depende do tamanho do journal |
| Reasoning | <500ms | Depende do número de padrões |
| Correlation | <200ms | Lê ficheiros JSON existentes |
