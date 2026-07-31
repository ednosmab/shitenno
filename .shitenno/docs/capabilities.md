---
category: engineering
lifecycle: Active
---

# CAPABILITIES — Mapeamento Capacidade → Regras → Arquivos

> **Versão:** 1.0
> **Data:** 2026-07-02
> **Propósito:** Documentar o mapeamento entre capacidades, regras activas e arquivos afectados.

---

## Legenda

| Símbolo | Significado |
|---|---|
| ✅ | Capacidade instalada e activa |
| 📋 | Capacidade disponível (pode ser instalada) |
| 🔮 | Capacidade futura (não disponível ainda) |
| ➖ | Não aplicável |

---

## Capacidades

### core (Sempre instalado)

| Campo | Valor |
|---|---|
| **Estado** | ✅ Sempre instalado |
| **Descrição** | Núcleo essencial — configuração base, opencode.json, workspace |
| **Dimensões** | — |
| **Dependências** | Nenhuma |

**Regras activas:**
- Regras de arquitetura e padrões (#1-3)
- Código declarativo e legível
- Loading Profiles (minimal, lite, full)
- Grafo de dependências das regras
- Regras cruciais de workflow e git (#1-10)
- Política de branches
- Agente único (arquiteto sênior)
- Gestão de status do backlog
- Lazy loading
- Algoritmo de gestão de contexto
- Estados do item do backlog
- Checklist de conclusão

**Arquivos:**
- `docs/AGENTS.md` (seções: core)
- `docs/opencode-context.md`
- `docs/Shitenno_GUIDE.md`
- `docs/CONCEPTUAL_MODEL.md`
- `docs/KNOWLEDGE_LIFECYCLE.md`
- `docs/FORBIDDEN_OPERATIONS.md`
- `docs/DESDO.md`
- `docs/backlog/ACTIVE.md`
- `core/complexity/types.ts`
- `governance/SYSTEM_MAP.md`

---

### knowledge

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | Skills de engenharia, AGENTS.md expandido, guias de referência |
| **Dimensões** | documentation: 0.4, quality: 0.1 |
| **Dependências** | core |

**Regras activas (após instalação):**
- Skills obrigatórias por sessão (#7-8)
- TDD estrito — test-first (#5)
- Validação de segurança (#6)
- Postura de engenharia sênior (#7)
- Feedback de desempenho por sessão (#17)
- Plan fragmentado em modo plan (#15)
- Execução literal em modo build (#16)
- Validação de plano em modo review (#14)

**Arquivos:**
- `docs/skills/*.md` (22 skills)
- `docs/AGENTS.md` (seções: knowledge)

**Skills instaladas por capacidade:**
- **core (sempre):** senior-engineer, tdd-agent, tdd_workflow, clean_code_standards, solid_principles, architectural_integrity, design_patterns, error_handling_observability, pnpm_management, optimistic_ui, codebase_hygiene_git
- **architecture:** ddd_patterns
- **governance:** operacao_no_shitenno
- **ai:** animation_protocol, ci_cd_pipeline, responsividade, state_management_protocol, ui_ux_principles
- **compliance/metrics:** nextjs_performance_seo, postgresql_performance, security_xss_prevention

---

### architecture

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | ADRs, SDRs, planos de tarefa, documentação arquitetural |
| **Dimensões** | architecture: 0.4, documentation: 0.2 |
| **Dependências** | core |

**Regras activas (após instalação):**
- Registros de Arquitetura (ADRs) obrigatórios
- Planos de execução em `governance/plans/`
- Session template

**Arquivos:**
- `docs/adrs/ADR-TEMPLATE.md`
- `docs/sdr/SDR-TEMPLATE.md` (futuro)
- `governance/plans/TEMPLATE.md` (futuro)
- `docs/session-template.md`
- `docs/AGENTS.md` (seções: architecture)

---

### governance

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | Contratos de agentes, workflows, context buffer |
| **Dimensões** | governance: 0.4 |
| **Dependências** | core |

**Regras activas (após instalação):**
- WORKFLOW.md obrigatório
- Context buffer obrigatório
- Prioridade de entrada de sessão (#11)
- Invariante de fim de sessão (#12)
- Quick board de aviso (#13)
- Protocolo de registro histórico

**Arquivos:**
- `governance/WORKFLOW.md`
- `governance/context/context_buffer.yaml`
- `docs/AGENTS.md` (seções: governance)

---

### ai

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | Agentes IA, prompts, orquestração |
| **Dimensões** | ai: 0.4 |
| **Dependências** | core |

**Regras activas (após instalação):**
- Contratos de agentes (planner, executor, reviewer, orchestrator)
- Protocolos de handoff
- Políticas operacionais
- Prompts por agente

**Arquivos:**
- `governance/agents/AI-CONTRACT-*.yaml`
- `governance/contracts/CONTRACTS_INDEX.md`
- `src/templates/base/governance/handoffs/TEMPLATE.md`
- `governance/rules/RULE-TEMPLATE.json`
- `src/templates/base/governance/policies/POLICY-TEMPLATE.md`
- `cognition/context/CONTEXT_HIERARCHY.md`
- `cognition/memory/MEM-operational-state-v1.json`
- `cognition/prompts/*/README.md`
- `docs/AGENTS.md` (seções: ai)

---

### quality

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | Validação, health checks, testes |
| **Dimensões** | quality: 0.3 |
| **Dependências** | core |

**Regras activas (após instalação):**
- Validação de sessão obrigatória
- Health checks automáticos

**Arquivos:**
- `scripts/validate-session.ts`
- `docs/AGENTS.md` (seções: quality)

---

### metrics

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | Relatórios, scoring, complexidade |
| **Dimensões** | observability: 0.3 |
| **Dependências** | core |

**Regras activas (após instalação):**
- Relatórios de scoring
- Histórico de métricas

**Arquivos:**
- `reports/README.md`
- `docs/AGENTS.md` (seções: metrics)

---

### operations

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | Scripts, sessões, runbooks |
| **Dimensões** | automation: 0.3 |
| **Dependências** | core |

**Regras activas (após instalação):**
- Encerramento de sessão
- Premortem check
- Runbooks de merge

**Arquivos:**
- `scripts/close-session.ts`
- `scripts/premortem-check.ts`
- `docs/runbooks/merge.md`
- `docs/AGENTS.md` (seções: operations)

---

### compliance

| Campo | Valor |
|---|---|
| **Estado** | 📋 Disponível |
| **Descrição** | FORBIDDEN_OPERATIONS, DESDO, reviews |
| **Dimensões** | governance: 0.2, quality: 0.2 |
| **Dependências** | core |

**Regras activas (após instalação):**
- FORBIDDEN_OPERATIONS obrigatório
- DESDO obrigatório
- Reviews de sessão
- Premortem obrigatório

**Arquivos:**
- `governance/premortem/PREMORTEM.md`
- `governance/reviews/SESSION_REVIEW.md`
- `docs/AGENTS.md` (seções: compliance)

---

## Matriz de Disponibilidade

| Capacidade | core | knowledge | architecture | governance | ai | quality | metrics | operations | compliance |
|---|---|---|---|---|---|---|---|---|---|
| **core** | ✅ | — | — | — | — | — | — | — | — |
| **knowledge** | ✅ | 📋 | — | — | — | — | — | — | — |
| **architecture** | ✅ | — | 📋 | — | — | — | — | — | — |
| **governance** | ✅ | — | — | 📋 | — | — | — | — | — |
| **ai** | ✅ | — | — | — | 📋 | — | — | — | — |
| **quality** | ✅ | — | — | — | — | 📋 | — | — | — |
| **metrics** | ✅ | — | — | — | — | — | 📋 | — | — |
| **operations** | ✅ | — | — | — | — | — | — | 📋 | — |
| **compliance** | ✅ | — | — | — | — | — | — | — | 📋 |

---

## Comandos Relacionados

| Comando | Função |
|---|---|
| `shugo init` | Instala capacidades seleccionadas |
| `shugo upgrade --capability <name>` | Adiciona uma capacidade |
| `shugo assess` | Mostra capacidades recomendadas |
| `shugo doctor` | Verifica estado das capacidades |
| `shugo status` | Mostra estado geral do sistema |
