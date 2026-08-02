---
category: engineering
lifecycle: Active
---

# KNOWLEDGE_LIFECYCLE — Ciclo de Vida do Conhecimento

> **Versão:** 1.0
> **Data:** 2026-07-09
> **Autoridade:** Shitenno
> **Propósito:** Formalizar como o conhecimento nasce, amadurece e passa a fazer parte do sistema

---

## Princípio Fundamental

> **Nem todo conhecimento precisa chegar à automação.**
> Cada estágio possui objectivos e critérios claros.
> O conhecimento que não evolui é conhecimento estagnado.

---

## Fluxo Completo

```
Observação
   │
   ▼
Hipótese
   │
   ▼
Experimento
   │
   ▼
Decisão
   │
   ▼
ADR
   │
   ▼
Skill
   │
   ▼
Contrato
   │
   ▼
Automação
   │
   ▼
CLI
```

---

## Estágios Detalhados

### 1. Observação

O ponto de partida. Algo é notado — um padrão, um problema, uma oportunidade.

| Propriedade | Descrição |
|---|---|
| **Origem** | Código, incidents, reviews, discussões |
| **Forma** | Nota, comentário, issue, feedback |
| **Critério de avanço** | A observação é clara e reproduzível |

**Exemplo:**
> "O deploy demora 15 minutos em média e falha 20% das vezes."

### 2. Hipótese

A observação é transformada numa explicação provável.

| Propriedade | Descrição |
|---|---|
| **Origem** | Análise da observação |
| **Forma** | Afirmação testável |
| **Critério de avanço** | A hipótese é falsificável |

**Exemplo:**
> "O deploy demora porque o build não usa cache entre CI runs."

### 3. Experimento

A hipótese é testada de forma controlada.

| Propriedade | Descrição |
|---|---|
| **Origem** | Validação da hipótese |
| **Forma** | Script, teste, protótipo |
| **Critério de avanço** | Resultado confirmado ou refutado |

**Exemplo:**
> "Adicionar cache de node_modules reduziu build de 15min para 3min."

### 4. Decisão

O resultado do experimento leva a uma decisão formal.

| Propriedade | Descrição |
|---|---|
| **Origem** | Evidência do experimento |
| **Forma** | Escolha documentada com justificação |
| **Critério de avanço** | Decisão registada com ADR |

**Exemplo:**
> "Decidimos usar cache de dependências no CI para reduzir tempo de build."

### 5. ADR (Architecture Decision Record)

A decisão é formalizada num documento imutável.

| Propriedade | Descrição |
|---|---|
| **Origem** | Decisão formalizada |
| **Forma** | Ficheiro `docs/adrs/ADR-XXXX.md` |
| **Critério de avanço** | ADR criado e referenciado |

**Campos obrigatórios:**
- Título
- Estado (proposed / accepted / deprecated / superseded)
- Contexto
- Decisão
- Consequências

### 6. Skill

O conhecimento é extraído do ADR e transformado num padrão reutilizável.

| Propriedade | Descrição |
|---|---|
| **Origem** | Padrão extraído de um ou mais ADRs |
| **Forma** | Ficheiro `docs/skills/<nome>.md` |
| **Critério de avanço** | A skill é referenciada em pelo menos um workflow |

**Estrutura de uma Skill:**
- Nome e descrição
- Quando aplicar
- Como executar
- Anti-padrões
- Referências

### 7. Contrato

O conhecimento é formalizado num contrato que define comportamentos esperados.

| Propriedade | Descrição |
|---|---|
| **Origem** | Skill operacionalizada |
| **Forma** | Ficheiro `governance/agents/AI-CONTRACT-*.yaml` |
| **Critério de avanço** | Contrato activo e auditável |

**Campos de um Contrato:**
- Papel (role)
- Responsabilidades
- Restrições
- Input/Output esperado

### 8. Automação

O contrato é implementado como código executável.

| Propriedade | Descrição |
|---|---|
| **Origem** | Contrato implementado |
| **Forma** | Script, CLI command, pipeline |
| **Critério de avanço** | Automação funciona e tem testes |

**Exemplo:**
> `scripts/validate-session.ts` — valida integridade da sessão

### 9. CLI

A automação é exposta como comando de CLI acessível.

| Propriedade | Descrição |
|---|---|
| **Origem** | Automação embutida no CLI |
| **Forma** | Comando `shugo <subcomando>` |
| **Critério de avanço** | Comando documentado e testado |

**Comandos disponíveis:**
- `shugo init` — Instalação por capacidades
- `shugo status` — Estado do projecto
- `shugo validate` — Validação de integridade
- `shugo sync` — Sincronização de templates
- `shugo upgrade` — Actualização de capacidades
- `shugo assess` — Avaliação de maturidade (Phase 2)

---

## Mapa de Maturidade por Estágio

| Estágio | Maturidade | Artefacto | Guarda |
|---|---|---|---|
| Observação | 🟢 Inicial | Nota / Issue | Ninguém |
| Hipótese | 🟢 Inicial | Afirmação | Ninguém |
| Experimento | 🟡 Em desenvolvimento | Script / Teste | Equipa |
| Decisão | 🟡 Em desenvolvimento | Documento | Tech Lead |
| ADR | 🟠 Maduro | `adrs/ADR-*.md` | Imutável |
| Skill | 🟠 Maduro | `skills/*.md` | Peer review |
| Contrato | 🔴 Estável | `agents/*.yaml` | Tech Lead |
| Automação | 🔴 Estável | Script / Pipeline | Imutável |
| CLI | 🔴 Estável | `shugo <cmd>` | Imutável |

---

## Regras de Transição

### Regra 1: Cada transição requer evidência

Nenhum conhecimento avança de estágio sem evidência que justifique a transição.

### Regra 2: Retrocesso é permitido

Se um estágio falhar, o conhecimento pode regressar ao estágio anterior para reavaliação.

### Regra 3: Não é obrigatório chegar ao fim

Nem todo conhecimento precisa de chegar à CLI. Muitas decisões vivem felizes como ADRs.

### Regra 4: ADRs são imutáveis

Um ADR aceite não pode ser alterado — pode ser supersedido por um novo ADR.

### Regra 5: Skills são reutilizáveis

Uma skill pode ser referenciada por múltiplos workflows e contratos.

---

## Integração com Capacidades

| Capacidade | Estágios que suporta |
|---|---|
| **Core** | Observação, Hipótese |
| **Knowledge** | Skill, ADR |
| **Architecture** | Decisão, ADR |
| **Governance** | Contrato, WORKFLOW |
| **AI** | Automação, CLI |
| **Quality** | Experimento, Validação |
| **Metrics** | Evidências, Evolução |
| **Operations** | Automação, CLI |
| **Compliance** | Contrato, Regras |

---

## Indicadores de Saúde do Ciclo

| Indicador | Critério Saudável | Acção se não cumprido |
|---|---|---|
| ADRs por decisão | ≥ 1 ADR por decisão arquitetural | Criar ADR retrospectivo |
| Skills sem ADR | 0 | Criar ADR de referência |
| Contratos sem testes | 0 | Adicionar testes de contrato |
| Automação sem contrato | 0 | Criar contrato ou remover |
| Observações sem hipótese | < 5 pendentes | Formular hipóteses |

---

## Referências

- `CONCEPTUAL_MODEL.md` — Modelo conceitual canónico
- `governance/WORKFLOW.md` — Fluxos de sessão
- `docs/adrs/ADR-TEMPLATE.md` — Template de ADR
- `docs/skills/` — Skills operacionais
- `governance/agents/` — Contratos de agentes
- `maturity-profile.ts` — Perfil de maturidade
