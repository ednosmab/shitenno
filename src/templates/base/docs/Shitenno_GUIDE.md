# Shitenno — Guia Completo do Sistema de Governança de Conhecimento

> **Nome público:** Shitenno
> **Ficheiro guia:** `shitenno/docs/Shitenno_GUIDE.md`
> **Versão:** 1.2.0
> **Data:** 2026-07-18

---

## 1. O que é o Shitenno

O **Shitenno** é um sistema de governança de conhecimento de engenharia. Observa o teu projecto, mantém um modelo persistente e verificável do que já se sabe sobre ele — decisões, riscos, cobertura de testes, padrões, lacunas de conhecimento — e serve esse estado como contexto fiável para humanos e agentes IA que trabalham no repositório.

### O Problema Que Resolve

**Knowledge Debt** — conhecimento que existe mas está desconectado, não verificado, ou nunca chega a quem precisa no momento de agir. Sessões de trabalho (humanas ou IA) que começam do zero, sem memória do que já foi decidido, testado ou partilhado antes.

### O Que Não É

- **Não é um framework de documentação** — a documentação é um mecanismo, não o domínio
- **Não é um framework para IA** — o sistema existe independentemente de IA
- **Não é uma CLI** — a CLI (Shugo) é o ponto de entrada, não a identidade do sistema
- **Não é um linter/formatter** — recomenda, não aplica alterações sozinho
- **Não é um wrapper de IA** — não chama nenhum LLM; é a camada de contexto que um LLM externo consulta
- **Não é hosted ou multi-tenant** — cada instância é local e isolada por projecto

### Domínio Fundamental

> **«Gestão da Evolução de Produtos através de Conhecimento, Governança e Automação.»**

O Shitenno gere a evolução de um produto ao longo do seu ciclo de vida:

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

### Os Três Componentes

| Componente | O que é |
|---|---|
| **Shugo** | O binário/CLI — ponto de entrada único (~38 comandos) |
| **`.shitenno/`** | Artefacto gerado por projecto pelo `shugo init` — estado, cache, histórico, daemon |
| **Daemon** | Processo de fundo, um por projecto — observa ficheiros, escuta event bus, acciona verificações |

### Ponte IA

O servidor MCP (`shugo mcp`) expõe o estado do projecto como ferramentas que um agente LLM pode consultar antes e durante o trabalho: `getBriefing`, `getRiskMap`, `getRules`, `getEngineeringState`, `getBacklog`, `getADRs`, `getSkills`. Recebe o resultado de volta via `submitFeedback`, fechando o ciclo entre recomendação e realidade.

---

## 2. Ciclo de Vida do Conhecimento

O Shitenno formaliza como o conhecimento nasce, amadurece e se torna automação:

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

Nem todo conhecimento precisa chegar ao fim. Cada estágio tem critérios claros de avanço. Muitas decisões vivem felizes como ADRs.

### Mapa de Maturidade

| Estágio | Maturidade | Artefacto |
|---|---|---|
| Observação | 🟢 Inicial | Nota / Issue |
| Hipótese | 🟢 Inicial | Afirmação testável |
| Experimento | 🟡 Em desenvolvimento | Script / Teste |
| Decisão | 🟡 Em desenvolvimento | Documento |
| ADR | 🟠 Maduro | `adrs/ADR-*.md` |
| Skill | 🟠 Maduro | `skills/*.md` |
| Contrato | 🔴 Estável | `agents/AI-CONTRACT-*.yaml` |
| Automação | 🔴 Estável | Script / Pipeline |
| CLI | 🔴 Estável | `shugo <cmd>` |

---

## 3. Capacidades do Sistema

O Shitenno usa uma abordagem modular baseada em **capacidades**. O `shugo init` instala a base (core + knowledge + governance + quality), e `shugo upgrade --capability <name>` adiciona capacidades conforme necessário.

### Capacidades Disponíveis

| Capacidade | Descrição | Depende de |
|---|---|---|
| **core** | Fundação básica (sempre instalado) | — |
| **knowledge** | Skills, documentação, regras de engenharia | core |
| **governance** | Workflows, context buffer, gestão de sessões | core |
| **architecture** | Decisões arquitecturais, planos, ADRs | core |
| **ai** | Contratos de agentes IA, cognition, prompts | governance |
| **quality** | Scripts de validação, sync-docs | core |
| **metrics** | Relatórios, histórico, scoring | core |
| **operations** | Runbooks, sessões, análise de riscos | core |
| **compliance** | Premortem, reviews, regras vinculantes | core |

### Como Funciona

1. **`shugo init`** — Instala base (core + knowledge + governance + quality)
2. **`shugo upgrade --capability <name>`** — Adiciona capacidade específica
3. **`shugo upgrade --accept-recommended`** — Instala todas as recomendadas pelo perfil

---

## 4. Skills — 16 Competências de Engenharia

### Distribuição

| Categoria | # Skills | Descrição |
|---|---|---|
| **Core** | 12 | Engenharia fundamental (TDD, SOLID, clean code, etc.) |
| **Intermediárias** | 3 | Especializadas (CI/CD, DDD, operação no Shitenno) |
| **Avançadas** | 1 | Postura sistémica e enforcements |

### Skills Core (12)

| Skill | Descrição |
|---|---|
| `senior-engineer.md` | Postura operacional de engenheiro sénior (15+ anos) |
| `tdd-agent.md` | Agente TDD — ciclo Red-Green-Refactor rigoroso |
| `tdd_workflow.md` | Workflow de testes com Vitest/Jest |
| `clean_code_standards.md` | Padrões de código limpo |
| `solid_principles.md` | Princípios SOLID aplicados |
| `architectural_integrity.md` | Integridade arquitectural e padrões |
| `design_patterns.md` | Padrões de design (Factory, Strategy, etc.) |
| `error_handling_observability.md` | Tratamento de erros e observabilidade |
| `pnpm_management.md` | Gestão de pacotes com pnpm |
| `optimistic_ui.md` | UI optimista para respostas imediatas |
| `codebase_hygiene_git.md` | Higiene de código e workflow Git |
| `quick-board-enforcement.md` | Enforçamento do Quick Board de aviso |

### Skills Intermediárias (3)

| Skill | Descrição |
|---|---|
| `ci_cd_pipeline.md` | CI/CD com GitHub Actions |
| `domain_driven_design_(ddd).md` | Domain-Driven Design patterns |
| `operacao_no_shitenno.md` | Como agir dentro da estrutura de pastas do Shugo |

### Skills Avançadas (1)

| Skill | Descrição |
|---|---|
| `system-first.md` | Postura sistémica: problema antes da solução, visão holística |

### Skills por Capacidade

Certas skills são instaladas apenas por capacidades específicas (ex: `security_xss_prevention.md` via `shugo upgrade` conforme o perfil do projecto).

---

## 5. Os 4 Papéis de Agente IA (Contratos)

Cada agente IA num projecto Shitenno tem um contrato definido em `governance/agents/`:

| Papel | Ficheiro | Função |
|---|---|---|
| **Planner** | `AI-CONTRACT-planner-v1.yaml` | Lê contexto e produz planos atómicos |
| **Executor** | `AI-CONTRACT-executor-v1.yaml` | Executa o plano step-by-step, exactamente como aprovado |
| **Reviewer** | `AI-CONTRACT-reviewer-v1.yaml` | Audita código, valida contra o plano |
| **Orchestrator** | `AI-CONTRACT-orchestrator-v1.yaml` | Coordena os 3 agentes, gere handoffs |

> **Nota:** Em configurações de agente único, os 3 papéis são consolidados num arquiteto sénior full-stack com autonomia total.

---

## 6. Arquitectura de Memória (RAM/ROM)

```
┌─────────────────────────────────────────────────────────┐
│              MEMÓRIA DE CURTO PRAZO (RAM)               │
│       governance/context/context_buffer.yaml            │
│   Estado activo, impedimentos, tarefa em curso          │
│   Actualizado a cada turno do agente                    │
└────────────────────────────┬────────────────────────────┘
                             │
                  (Consolidação de Sessão)
                             ▼
┌─────────────────────────────────────────────────────────┐
│             MEMÓRIA DE LONGO PRAZO (ROM)                │
│         docs/history/ (IMUTÁVEL)                        │
│   Logs densos e definitivos de decisões e progresso     │
│   Gerado no encerramento de cada sessão                 │
└─────────────────────────────────────────────────────────┘
```

**RAM (Mutável):** `governance/context/context_buffer.yaml`
- Actualizado a cada turno do agente
- Contém: tarefa activa, impedimentos, documentos carregados
- Formato YAML estruturado para leitura por máquinas

**ROM (Imutável):** `docs/history/`
- Gerado no encerramento de cada sessão
- Protegido contra regravação
- Formato: `YYYY-MM-DD-sessao-NN.md`

---

## 7. Hierarquia de Contexto (P0→P4)

```
[Nível 0: P0] AGENTS.md, FORBIDDEN_OPERATIONS.md, DESDO.md  ← Regras Globais (SEMPRE)
       │
       ▼
[Nível 1: P1] governance/context/context_buffer.yaml        ← Estado Actual
       │
       ▼
[Nível 2: P2] Planos da camada                              ← Por tarefa
       │
       ▼
[Nível 3: P3] Código e configuração                         ← Escrita Cirúrgica
       │
       ▼
[Nível 4: P4] docs/skills/                                  ← Competências operacionais
       │
       ▼
[Nível 5: P5] docs/history/                                 ← Auditoria (Sob Demanda)
```

**Regra:** O agente nunca decide o que ler. A hierarquia P0→P5 determina a ordem.

---

## 8. Workflow Operacional (4 Passos)

```
PASSO 1: DIAGNÓSTICO E LEITURA PREGUIÇOSA
  │  → Ler WORKFLOW.md
  │  → Ler context_buffer.yaml
  │  → Ler AGENTS.md (P0)
  │  → Identificar tipo: FEATURE | BUG | REFACTOR | DOCUMENTATION | PLANNING
  ▼
PASSO 2: ACTUALIZAÇÃO DA MEMÓRIA RAM
  │  → Actualizar context_buffer.yaml
  │  → Registar tarefa em execução
  │  → Registar documentos carregados
  ▼
PASSO 3: EXECUÇÃO CIRÚRGICA
  │  → Escrever código apenas na pasta permitida
  │  → Se erro → parar, documentar no buffer, corrigir
  ▼
PASSO 4: CONSOLIDAÇÃO E PURGA
     → Marcar [x] no plano
     → Limpar impedimentos do buffer
     → Executar validate-session
     → Executar close-session (quando autorizado)
```

---

## 9. Fluxo por Tipo de Operação

### Nova Feature
1. Ler WORKFLOW.md → Determinar tipo
2. Ler context_buffer.yaml → Estado actual
3. Executar `premortem-check` → O que pode quebrar?
4. Criar plano em `governance/plans/`
5. Actualizar buffer com tarefa em execução
6. Implementar código cirurgicamente
7. Executar testes e lint
8. Executar `pnpm run validate:session`
9. Aguardar autorização para commit
10. Executar `pnpm run close:session`

### Bug Report
1. Ler WORKFLOW.md → Identificar como BUG
2. Ler context_buffer.yaml → Estado actual
3. Reproduzir erro / identificar causa raiz
4. Documentar erro no buffer
5. Corrigir código cirurgicamente
6. Executar testes
7. Actualizar buffer e encerrar

### Refactor
1. Ler WORKFLOW.md → Identificar como REFACTOR
2. Ler ADRs relacionadas
3. Executar `premortem-check` → Verificar impacto
4. Executar refactoração conforme plano
5. Executar testes e lint
6. Validar e encerrar

### Documentation
1. Ler WORKFLOW.md → Identificar como DOCUMENTATION
2. Ler documentos afectados
3. Escrever/actualizar documentação
4. Verificar referências cruzadas
5. Validar e encerrar

### Planning
1. Ler WORKFLOW.md → Identificar como PLANNING
2. Ler contexto completo (P0 + P1)
3. Gerar plano atómico em `governance/plans/`
4. Apresentar ao utilizador para aprovação
5. Aguardar autorização antes de executar

---

## 10. Complexidade e Scoring

O Shitenno calcula complexidade do projecto usando dois eixos:

### Static Metrics (Métricas Estáticas)
- **Estrutura de pastas** — quantos directórios, apps, packages
- **Dependências** — quantos packages no package.json
- **Tamanho** — linhas de código por área

### Behavioral Metrics (Métricas Comportamentais)
- **Churn** — frequência de alterações por área (git log)
- **Taxa de violação** — quantas regras foram violadas
- **Superfície sensível** — quantas áreas sensíveis existem (auth, payment, session)

### Scoring
- **Score 0-3:** Baixa complexidade — projecto simples, poucas dependências
- **Score 4-6:** Média complexidade — projecto em crescimento
- **Score 7-10:** Alta complexidade — projecto complexo, multi-app, muitas dependências

O perfil de maturidade é calculado por capacidade e consolidado num score 0-100.

---

## 11. Directórios do Projecto

### Estrutura após `shugo init`

```
projecto/
├── opencode.json                         ← Configuração
└── shitenno/
    ├── cognition/                        ← Arquitectura mental (capability: ai)
    │   ├── context/
    │   │   └── CONTEXT_HIERARCHY.md      ← Hierarquia P0-P5
    │   ├── memory/
    │   │   └── MEM-operational-state-v1.json
    │   └── prompts/                      ← Prompts por agente
    │       ├── executor/README.md
    │       ├── planner/README.md
    │       └── reviewer/README.md
    ├── core/
    │   └── complexity/
    │       └── types.ts                  ← Contratos tipados de scoring
    ├── docs/
    │   ├── AGENTS.md                     ← Regras do time (P0)
    │   ├── CONCEPTUAL_MODEL.md           ← Modelo conceitual canónico
    │   ├── DESDO.md                      ← Diretrizes de engenharia (P0)
    │   ├── FORBIDDEN_OPERATIONS.md       ← Regras vinculantes (P0)
    │   ├── INDEX.md                      ← Índice de documentos
    │   ├── KNOWLEDGE_LIFECYCLE.md        ← Ciclo de vida do conhecimento
    │   ├── Shitenno_GUIDE.md             ← Este ficheiro
    │   ├── capabilities.md               ← Mapeamento capacidade→regras
    │   ├── opencode-context.md           ← Contexto para o agente
    │   ├── session-template.md           ← Template de sessão
    │   ├── adrs/                         ← Architecture Decision Records
    │   │   ├── ADR-000-exemplo.md
    │   │   └── ADR-TEMPLATE.md
    │   ├── backlog/                      ← Backlog do projecto
    │   │   ├── ACTIVE.md
    │   │   └── DONE.md
    │   ├── feedback/                     ← Feedback de sessões (privado)
    │   │   └── README.md
    │   ├── reports/                      ← Relatórios
    │   │   └── README.md
    │   ├── rules/                        ← Regras modulares
    │   │   ├── agent-modes.md
    │   │   ├── branch-policy.md
    │   │   ├── context-algorithm.md
    │   │   ├── dependency-graph.md
    │   │   ├── feedback-protocol.md
    │   │   └── lazy-loading.md
    │   ├── runbooks/                     ← Runbooks operacionais
    │   │   └── merge.md
    │   ├── sdr/                          ← Solution Decision Records
    │   │   └── SDR-TEMPLATE.md
    │   └── skills/                       ← Competências operacionais
    │       ├── senior-engineer.md
    │       ├── tdd-agent.md
    │       ├── tdd_workflow.md
    │       ├── clean_code_standards.md
    │       ├── solid_principles.md
    │       ├── architectural_integrity.md
    │       ├── design_patterns.md
    │       ├── error_handling_observability.md
    │       ├── pnpm_management.md
    │       ├── optimistic_ui.md
    │       ├── codebase_hygiene_git.md
    │       ├── quick-board-enforcement.md
    │       ├── ci_cd_pipeline.md
    │       ├── domain_driven_design_(ddd).md
    │       ├── operacao_no_shitenno.md
    │       └── system-first.md
    ├── governance/
    │   ├── SYSTEM_MAP.md                 ← Mapa centralizado do sistema
    │   ├── WORKFLOW.md                   ← Fluxo de sessão (entrada única)
    │   ├── skill-manifest.yaml           ← Manifesto de skills
    │   ├── agents/                       ← Contratos de agente
    │   │   ├── AI-CONTRACT-planner-v1.yaml
    │   │   ├── AI-CONTRACT-executor-v1.yaml
    │   │   ├── AI-CONTRACT-reviewer-v1.yaml
    │   │   └── AI-CONTRACT-orchestrator-v1.yaml
    │   ├── context/                      ← RAM (live session state)
    │   │   └── context_buffer.yaml
    │   ├── contracts/                    ← Índice de contratos
    │   │   └── CONTRACTS_INDEX.md
    │   ├── handoffs/                     ← Protocolos de transição
    │   │   └── TEMPLATE.md
    │   ├── knowledge-graph/              ← Grafo de conhecimento
    │   │   ├── artifacts.json
    │   │   ├── artifacts.jsonl
    │   │   ├── relations.json
    │   │   └── relations.jsonl
    │   ├── plans/                        ← Planos de execução
    │   │   └── TEMPLATE.md
    │   ├── policies/                     ← Políticas operacionais
    │   │   ├── BRANCH-POLICY.md
    │   │   ├── COMMIT-POLICY.md
    │   │   ├── POLICY-TEMPLATE.md
    │   │   └── REVIEW-POLICY.md
    │   ├── premortem/                    ← Análise de riscos
    │   │   └── PREMORTEM.md
    │   ├── reviews/                      ← Reviews de sessão
    │   │   └── SESSION_REVIEW.md
    │   └── rules/                        ← Regras do rule engine
    │       ├── RULE-011.json
    │       ├── RULE-012.json
    │       ├── RULE-013.json
    │       ├── RULE-014.json
    │       ├── RULE-015.json
    │       ├── RULE-016.json
    │       ├── RULE-017.json
    │       ├── RULE-018.json
    │       ├── RULE-019.json
    │       ├── RULE-020.json
    │       └── RULE-TEMPLATE.json
    ├── plugins/                          ← Plugins (capability: operations)
    │   ├── README.md
    │   ├── event-logger/plugin.js
    │   ├── health-check/plugin.js
    │   ├── health-check/plugin.ts
    │   └── health-monitor/plugin.js
    ├── daemon/                           ← Processo de fundo (capability: operations)
    │   ├── daemon.pid
    │   ├── daemon.sock
    │   ├── daemon.log
    │   ├── daemon-state.json
    │   ├── daemon.approved
    │   └── circuit-breaker.json
    ├── history/                          ← Estado de engenharia (capability: metrics)
    │   └── snapshots/
    ├── profile/                          ← Perfil do projecto (capability: core)
    │   └── <project>.config.ts
    ├── session-feedback/                 ← Feedback de sessões (capability: governance)
    │   └── records.jsonl
    ├── telemetry/                        ← Telemetria e eventos (capability: operations)
    │   ├── events-YYYY-MM-DD.jsonl
    │   └── dead-letter/
    └── scripts/                          ← Scripts de sessão
        ├── validate-session.ts
        ├── close-session.ts
        ├── premortem-check.ts
        ├── backlog.ts
        ├── sync-docs.ts
        └── generate-changelog.ts
```

### O que muda por capacidade

| Directório | Init | +knowledge | +architecture | +governance | +ai | +quality | +metrics | +operations | +compliance |
|---|---|---|---|---|---|---|---|---|---|
| `docs/skills/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/agents/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/context/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/contracts/` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/handoffs/` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `governance/knowledge-graph/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/policies/` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/premortem/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `governance/reviews/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `governance/rules/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `cognition/` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `docs/adrs/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/backlog/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/history/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/rules/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `docs/runbooks/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `docs/sdr/` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `governance/plans/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `plugins/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `reports/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `scripts/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `daemon/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `history/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `profile/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `session-feedback/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `telemetry/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

---

## 12. ProjectProfile

O `shitenno/profile/<project-name>.config.ts` define o perfil do projecto:

```typescript
export const profile: ProjectProfile = {
  projectName: "my-project",
  areas: ["src/components", "src/services", "packages/core"],
  sensitiveKeywords: ["auth", "payment", "session", "security"],
  churnWindowDays: 90,
  weights: {
    churn: 1.0,
    violationRate: 1.0,
    sensitiveSurface: 1.0,
  },
  historyPath: "shitenno/docs/history",
  feedbackPath: "shitenno/docs/feedback",
  violationKeywords: ["erro", "bug", "corrigi", "falhou", "rollback"],
  highComplexityThreshold: 7,
};
```

- **Áreas** detectadas automaticamente por `shugo init` (via `detectAreas()`)
- **Keywords sensíveis** definidas por defeito (auth, payment, session, security)
- **Weights** ajustáveis para calibrar o scoring

---

## 13. Regras Vinculantes (Resumo)

### Proibições Absolutas

| # | Regra |
|---|---|
| G-01 | Nenhum `git commit` sem autorização explícita do utilizador |
| G-05 | Respeitar modelo do step em planos de execução |
| F-01 | Nenhuma lógica de domínio em componentes UI |
| F-03 | Nenhum import cruzado entre apps |
| F-04 | Nenhum schema de validação fora da camada de contratos |
| S-01 | Nenhum HTML dinâmico sem sanitização |
| S-02 | Nenhuma tabela sem RLS configurado |
| DB-01 | Nenhuma mutação JSONB sem validação |
| ENV-01 | Nenhuma flag de teste em configuração de produção |
| DT-01 | Adiamentos requerem data de revisit |
| DT-02 | Sessão não concluída sem ritual de fecho |
| CONFID-01 | Proibição de mencionar nomes de alvos/parceiros em artefactos versionados |

### Princípios de Código

| # | Regra |
|---|---|
| 1 | Commits em inglês (Conventional Commits) |
| 2 | Testes antes do código (TDD) |
| 3 | Alterações mínimas — não refacta fora do escopo |
| 4 | Verifica após cada step — nunca avança com erro |
| 5 | Feedback é privado — não versionado |

---

## 14. Glossário

| Termo | Definição |
|---|---|
| **Shitenno** | Sistema de governança de conhecimento de engenharia |
| **Knowledge Debt** | Conhecimento que existe mas está desconectado ou não chega a quem precisa |
| **Shugo** | CLI do Shitenno (~38 comandos) |
| **Daemon** | Processo de fundo que observa o projecto |
| **RAM** | Memória de curto prazo (`context_buffer.yaml`) — mutável |
| **ROM** | Memória de longo prazo (`docs/history/`) — imutável |
| **P0-P5** | Níveis de hierarquia de contexto |
| **Premortem** | Análise de riscos prévia à implementação |
| **ADR** | Architecture Decision Record — registo de decisão arquitectural |
| **SDR** | Solution Decision Record — registo de decisão de solução |
| **FORBIDDEN_OPERATIONS** | Regras vinculantes que nenhum agente pode violar |
| **ProjectProfile** | Perfil do projecto (áreas, keywords, weights) |
| **Scoring** | Cálculo de complexidade (static + behavioral metrics) |
| **Handoff** | Transição controlada entre agentes |
| **Context Buffer** | Estado activo da sessão (RAM) |
| **MCP** | Model Context Protocol — ponte entre Shitenno e agentes IA |
| **Capacidade** | Módulo funcional instalável via `shugo upgrade` |

---

## 15. Comandos CLI (38)

### Core Commands

| Comando | Função |
|---|---|
| `shugo init` | Inicializa governança no projecto |
| `shugo status` | Health check + complexity scoring |
| `shugo run` | Pipeline completo de 5 estágios |
| `shugo upgrade` | Adicionar capacidades de governança |
| `shugo validate` | Verificação de integridade de sessão |

### Analysis Commands

| Comando | Função |
|---|---|
| `shugo detect` | Detecção de padrões do histórico |
| `shugo audit` | Auto-avaliação: regras mortas, hotspots |
| `shugo evolve` | Recomendações adaptativas |
| `shugo assess` | Re-avaliação do perfil de maturidade |
| `shugo doctor` | Diagnósticos de saúde do sistema |
| `shugo scheduled-check` | Verificação de alterações não commitadas |

### Governance Commands

| Comando | Função |
|---|---|
| `shugo plan` | Gerar planos de execução |
| `shugo goal` | Definir e tracking de objectivos |
| `shugo decide` | Registo e gestão de decisões |
| `shugo policy` | Gestão de políticas de governança |
| `shugo act` | Execução de acções de agente |

### Context Commands

| Comando | Função |
|---|---|
| `shugo context` | Contexto completo do projecto para IA |
| `shugo briefing` | Briefing pré-sessão |
| `shugo digest` | Sumários de estado |
| `shugo feedback` | Registo de resultado de sessão |
| `shugo history` | Histórico de engineering state |
| `shugo handbook` | Manual de referência do Shugo |
| `shugo backlog` | Gestão de backlog com estados e prioridades |

### Utility Commands

| Comando | Função |
|---|---|
| `shugo sync` | Sincronizar governança |
| `shugo clean` | Limpar cache e ficheiros temporários |
| `shugo report` | Gerar relatórios |
| `shugo bench` | Benchmarks de performance |
| `shugo console` | Consola interactiva de governança |
| `shugo dashboard` | Dashboard visual do projecto |
| `shugo profile` | Perfil de maturidade detalhado |
| `shugo reminders` | Tracking de tarefas pendentes |
| `shugo mcp` | Servidor MCP para integração IA |
| `shugo update` | Actualizar templates do Shitenno |
| `shugo shell-init` | Configuração de shell completions |
| `shugo docs-audit` | Auditoria de sincronização de docs |
| `shugo events` | Trace de execução do rule engine |
| `shugo hooks` | Gestão de Git hooks |

---

## 16. Referências

| Documento | Caminho | Propósito |
|---|---|---|
| WORKFLOW | `governance/WORKFLOW.md` | Fluxo de sessão (entrada única) |
| SYSTEM_MAP | `governance/SYSTEM_MAP.md` | Mapa centralizado do sistema |
| CONTEXT_HIERARCHY | `cognition/context/CONTEXT_HIERARCHY.md` | Hierarquia de leitura P0-P5 |
| AGENTS.md | `docs/AGENTS.md` | Regras do time de engenharia |
| FORBIDDEN_OPERATIONS | `docs/FORBIDDEN_OPERATIONS.md` | Regras vinculantes |
| DESDO | `docs/DESDO.md` | Diretrizes de engenharia |
| CONCEPTUAL_MODEL | `docs/CONCEPTUAL_MODEL.md` | Modelo conceitual canónico |
| KNOWLEDGE_LIFECYCLE | `docs/KNOWLEDGE_LIFECYCLE.md` | Ciclo de vida do conhecimento |
| context_buffer | `governance/context/context_buffer.yaml` | Estado activo (RAM) |
| capabilities | `docs/capabilities.md` | Mapeamento capacidade→regras→arquivos |
| INDEX | `docs/INDEX.md` | Índice de documentos |

---

## 17. Changelog

| Versão | Data | Alteração |
|---|---|---|
| 1.2.0 | 2026-07-18 | Reescrita completa da identidade (sistema de governança de conhecimento), actualização de skills (16), directórios (94 ficheiros), comandos (38), ciclos conceptual e de conhecimento |
| 2.0 | 2026-06-24 | Reescrita completa: 3 níveis, 21 skills, 4 agentes, scoring, profiles |
| 1.0 | — | Criação inicial do guia |
