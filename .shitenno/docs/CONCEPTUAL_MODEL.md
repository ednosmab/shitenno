---
category: engineering
lifecycle: Active
---

# CONCEPTUAL_MODEL — Modelo Conceitual Canónico

> **Versão:** 1.0
> **Data:** 2026-07-04
> **Autoridade:** Shitenno
> **Propósito:** Referência canónica para toda decisão arquitetural

---

## Princípio Fundamental

> **O Shugo não é um framework de documentação.**
> **O Shugo não é um framework para IA.**
> **O Shugo não é uma CLI.**
>
> Todos esses elementos são apenas mecanismos.
> O verdadeiro domínio do Shugo é:
>
> **«Gestão da Evolução de Produtos através de Conhecimento, Governança e Automação.»**

---

## Domínio Fundamental

O Shugo gerencia a evolução de um produto ao longo do seu ciclo de vida. O ciclo começa com um produto e termina com evidências de evolução que retroalimentam o próprio produto.

```
Produto
   │
   ▼
Domínio
   │
   ▼
Conhecimento
   │
   ▼
Decisão
   │
   ▼
Governança
   │
   ▼
Execução
   │
   ▼
Evidências
   │
   ▼
Evolução ────────► Produto (ciclo repete)
```

---

## Conceitos Fundamentais

### 1. Produto

O objecto de trabalho — software, plataforma, sistema. É o ponto de partida e o destinatário de toda evolução.

| Propriedade | Descrição |
|---|---|
| **Identidade** | Nome, repositório, stack tecnológica |
| **Estado Actual** | Maturidade, capacidades instaladas, dívida |
| **Histórico** | Decisões tomadas, evolução, lições aprendidas |

### 2. Domínio

O contexto de negócio em que o produto opera. Define as restrições, oportunidades e linguagem partilhada.

| Propriedade | Descrição |
|---|---|
| **Linguagem Ubíqua** | Termos partilhados entre equipa e produto |
| **Limites** | O que pertence ao domínio e o que não pertence |
| **Regras** | Restrições de negócio que influenciam decisões técnicas |

### 3. Conhecimento

Toda informação que o produto acumula ao longo do tempo. O conhecimento nasce como observação e pode evoluir até se tornar automação.

| Propriedade | Descrição |
|---|---|
| **Natureza** | Pode ser técnica, organizacional, ou de negócio |
| **Vida** | Nasce, amadurece, e eventualmente se torna código/processo |
| **Forma** | Documentos, ADRs, skills, contratos, código |

> **Ver:** `shitenno/docs/KNOWLEDGE_LIFECYCLE.md` para o ciclo de vida completo.

### 4. Decisão

Um ponto de inflexão onde o conhecimento se transforma em acção. Toda decisão deve ser rastreável e justificada.

| Propriedade | Descrição |
|---|---|
| **Rastreabilidade** | Toda decisão deve ter ADR associado |
| **Justificação** | Contexto, opções consideradas, razão da escolha |
| **Impacto** | O que muda com esta decisão |

### 5. Governança

O conjunto de regras, processos e estruturas que garantem que decisões são tomadas de forma consistente e rastreável.

| Componente | Função |
|---|---|
| **WORKFLOW.md** | Fluxos de sessão — entrada única |
| **AGENTS.md** | Regras do time — hierarquia P0-P4 |
| **FORBIDDEN_OPERATIONS** | Proibições absolutas |
| **CONTRACTS** | Contratos de agentes IA |
| **context_buffer.yaml** | Memória RAM da sessão |

### 6. Execução

A implementação concreta de decisões. A execução é sempre cirúrgica, testada e validada antes de ser consolidada.

| Propriedade | Descrição |
|---|---|
| **Atómica** | Mudanças pequenas, verificáveis |
| **Testada** | Todo código deve ter testes |
| **Validada** | Typecheck, lint, integridade |

### 7. Evidências

Toda execução gera evidências que alimentam o ciclo de evolução. Evidências incluem testes, métricas, feedback e resultados de assessment.

| Tipo | Exemplo |
|---|---|
| **Técnica** | Testes passam, typecheck limpo |
| **Métrica** | Score de maturidade, complexidade |
| **Qualitativa** | Feedback de sessão, reviews |
| **Histórica** | Snapshots de maturidade, changelogs |

### 8. Evolução

O processo contínuo de melhoria do produto. A evolução é impulsionada pelas evidências e mediada pelo conhecimento acumulado.

| Propriedade | Descrição |
|---|---|
| **Contínua** | Nunca termina — o produto sempre evolui |
| **Medida** | Maturidade, capacidades, dívida de conhecimento |
| **Orientada** | Guiada por assessment e recomendações |

---

## Mapa Conceptual

```
┌─────────────────────────────────────────────────────────┐
│                    SHUGO SYSTEM                          │
│            Gestão da Evolução de Produtos                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐      │
│  │ PRODUTO  │───►│  DOMÍNIO     │───►│CONHECIMENTO│     │
│  └──────────┘    └──────────────┘    └────┬─────┘      │
│       ▲                                   │             │
│       │                                   ▼             │
│  ┌────┴────┐    ┌──────────────┐    ┌──────────┐      │
│  │Evolução │◄───│  Evidências  │◄───│  Decisão  │      │
│  └─────────┘    └──────────────┘    └────┬─────┘      │
│                                          │             │
│                                          ▼             │
│                                    ┌──────────┐        │
│                                    │Governança│        │
│                                    └────┬─────┘        │
│                                         │              │
│                                         ▼              │
│                                    ┌──────────┐        │
│                                    │ Execução  │        │
│                                    └──────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Relações entre Conceitos

| Relação | Descrição |
|---|---|
| Produto → Domínio | O produto opera dentro de um domínio |
| Domínio → Conhecimento | O domínio gera conhecimento |
| Conhecimento → Decisão | O conhecimento alimenta decisões |
| Decisão → Governança | Decisões são formalizadas em governança |
| Governança → Execução | A governança orienta a execução |
| Execução → Evidências | A execução gera evidências |
| Evidências → Evolução | Evidências impulsionam evolução |
| Evolução → Produto | A evolução transforma o produto |

---

## Capacidades do Shugo

O Shugo implementa este modelo através de 9 capacidades modulares:

| Capacidade | Conceito Shugo | Descrição |
|---|---|---|
| **Core** | Produto | Configuração base, workspace |
| **Knowledge** | Conhecimento | Skills, documentação, referências |
| **Architecture** | Decisão | ADRs, SDRs, planos |
| **Governance** | Governança | Workflows, context buffer, SYSTEM_MAP |
| **AI** | Execução | Agentes IA, prompts, orquestração |
| **Quality** | Evidências | Validação, health checks |
| **Metrics** | Evidências | Relatórios, scoring, telemetria |
| **Operations** | Execução | Scripts, sessões, runbooks |
| **Compliance** | Governança | FORBIDDEN_OPERATIONS, reviews |

> **Ver:** `src/maturity-profile.ts` para o cálculo de maturidade por capacidade.
> **Ver:** `src/capability-mapping.ts` para o mapeamento capacidade→ficheiros.

---

## Referências

- `shitenno/docs/KNOWLEDGE_LIFECYCLE.md` — Ciclo de vida do conhecimento
- `governance/WORKFLOW.md` — Fluxos de sessão
- `docs/AGENTS.md` — Regras do time
- `docs/FORBIDDEN_OPERATIONS.md` — Regras vinculantes
- `docs/Shitenno_GUIDE.md` — Guia completo do sistema
