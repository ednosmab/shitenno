---
category: product
lifecycle: Active
---

# PUBLIC_API — Superfície Pública Estável do Shitenno

> **Versão:** 1.0
> **Data:** 2026-07-18
> **Plano:** PLAN-2026-07-17-consolidacao-produtizacao-multi-projeto (Fase 3)

---

## Princípio

> **Se não está nesta lista, é interno e pode mudar sem aviso.**
> Consumidores externos (outros projectos, agentes IA de terceiros) devem depender APENAS do que está documentado aqui.

---

## 1. CLI — Comandos Estáveis

Estes comandos garantem compatibilidade semântica entre versões menores (patch). Breaking changes requerem bump de major version.

### Setup

| Comando | Descrição | Estabilidade |
|---------|-----------|-------------|
| `shugo init` | Inicializar ecossistema de governança num projecto | Estável |
| `shugo mcp` | Iniciar servidor MCP para agentes IA | Estável |
| `shugo upgrade` | Adicionar capabilities novas | Estável |

### Status & Análise

| Comando | Descrição | Estabilidade |
|---------|-----------|-------------|
| `shugo status` | Health check do projecto | Estável |
| `shugo audit` | Auditoria completa de saúde | Estável |
| `shugo doctor` | Diagnóstico + recomendações | Estável |

### Planos

| Comando | Descrição | Estabilidade |
|---------|-----------|-------------|
| `shugo plan md list` | Listar planos activos | Estável |
| `shugo plan md show <id>` | Ver detalhes de um plano | Estável |
| `shugo plan md create <title>` | Criar plano novo | Estável |
| `shugo plan md status <id> <status>` | Actualizar estado do plano | Estável |
| `shugo plan md done <id>` | Marcar plano como concluído | Estável |
| `shugo plan md prepare <id>` | Preparar plano (formato, checklist, backlog sync) | Estável |

### Governança

| Comando | Descrição | Estabilidade |
|---------|-----------|-------------|
| `shugo goal create <title>` | Criar meta de governança | Estável |
| `shugo goal list` | Listar metas | Estável |
| `shugo goal show <id>` | Ver detalhes de uma meta | Estável |
| `shugo goal update <id> --progress <n>` | Actualizar progresso | Estável |

### AI Integration

| Comando | Descrição | Estabilidade |
|---------|-----------|-------------|
| `shugo briefing` | Briefing pré-sessão para agentes IA | Estável |
| `shugo feedback` | Reportar resultado de sessão | Estável |

### Comandos Internos (podem mudar)

`shugo run`, `shugo evolve`, `shugo detect`, `shugo act`, `shugo decide`, `shugo policy`, `shugo assess`, `shugo console`, `shugo report`, `shugo digest`, `shugo bench`, `shugo daemon`, `shugo sync`, `shugo update`, `shugo validate`, `shugo handbook`, `shugo reminders`, `shugo events`, `shugo history`, `shugo context`, `shugo docs-audit`, `shugo shell-init`, `shugo profile`, `shugo dashboard`, `shugo clean`

---

## 2. Tools MCP — Estáveis

O servidor MCP (`shitenno-mcp`) expõe as seguintes tools para agentes IA:

| Tool | Parâmetros | Descrição | Estabilidade |
|------|-----------|-----------|-------------|
| `getBriefing` | `format?` ("json"\|"markdown"\|"summary"), `depth?` ("minimal"\|"standard"\|"full") | Briefing pré-sessão com estado do projecto, risco, recomendações | Estável |
| `getRules` | `type?` ("all"\|"context"\|"dynamic"\|"engine"), `format?` ("json"\|"markdown") | Regras de governança aplicáveis | Estável |
| `getEngineeringState` | — | Estado consolidado do projecto (assets, maturidade, entropia) | Estável |
| `getBacklog` | `state?` (filtro por estado) | Itens activos do BACKLOG.md | Estável |
| `getPlans` | `planName?` (nome do ficheiro) | Listar planos ou ler plano específico | Estável |
| `submitFeedback` | `outcome` ("success"\|"failure"\|"partial"), `notes` (string) | Submeter feedback de sessão | Estável |

### Tools Internas (podem mudar)

`getRiskMap`, `getADRs`, `getSkills`

---

## 3. Schemas — Contratos Versionados

### rule-manifest.yaml

**Localização:** `governance/rule-manifest.yaml`
**Loader:** `src/rule-manifest.ts`

Define quais regras de governança se aplicam a cada tarefa. Schema:

```typescript
interface RuleManifestEntry {
  id: string;                    // ex: "AGENTS", "FORBIDDEN_OPERATIONS"
  path: string;                  // caminho relativo ao ficheiro .md
  mandatory: boolean;            // true = sempre carregada
  priority: number;              // 0 = sempre, 1 = P0, 2 = P1, etc.
  when?: {                       // condições condicionais
    task?: string;               // tipo de tarefa (FEATURE, BUG, REFACTOR)
    language?: string;           // linguagem do projecto
    framework?: string;          // framework utilizado
  };
}
```

### Domain Entities

**Localização:** `src/domain/entities/engineering-state.ts`

Tipos centrais do domínio (estáveis entre versões menores):

| Tipo | Descrição |
|------|-----------|
| `EngineeringState` | Estado consolidado do projecto (aggregate root) |
| `EngineeringAsset` | Asset individual detectado no projecto |
| `AssetType` | 18 variantes: `plan`, `doc`, `adr`, `rule`, `skill`, etc. |
| `ShitennoLifecycleState` | Ciclo de vida: `uninitialized → discovered → governed → evolved` |
| `MaturityProfile` | Perfil de maturidade (9 capabilities, 7 dimensões) |
| `Capability` | 9 valores: `core`, `knowledge`, `architecture`, `governance`, `ai`, `quality`, `metrics`, `operations`, `compliance` |

### Rule Schema

**Localização:** `src/domain/rules/rule.ts`

Schema para regras de governança (ficheiros JSON em `governance/rules/`):

```typescript
interface Rule {
  id: string;
  description: string;
  trigger: TriggerType;       // 24 variantes (event-driven)
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  dependencies: string[];
  enabled: boolean;
  tags: string[];
}
```

### AI Agent Contracts

**Localização:** `governance/agents/AI-CONTRACT-*.yaml`

4 contratos de agentes IA (planner, executor, reviewer, orchestrator). Cada contract define: role, inputs, outputs, allowed actions, tools, handoff chain, failure policy.

---

## 4. Formatos de Ficheiro

### governance/plans/*.md

Planos são markdown com frontmatter YAML:

```yaml
---
status: andamento | parado | done
date: YYYY-MM-DD
priority: P0 | P1 | P2
owner: string
estimated_time: string
updated_at: ISO timestamp
---
```

### governance/rules/*.JSON

Regras seguem o schema `Rule` (ver §3).

### .shitenno/engineering-state.json

Estado consolidado serializado. Schema: `EngineeringState`.

### .shitenno/maturity-profile.json

Perfil de maturidade serializado. Schema: `MaturityProfile`.

---

## 5. O que NÃO é público

Estes módulos são **internos** e podem mudar sem aviso:

- Todas as engines consolidadas (`src/prioritization/*`, `src/engineering-state/*`)
- `src/analyser.ts`, `src/scorer.ts`, `src/pipeline.ts`
- `src/audit/*` (todos os detectores)
- `src/daemon/*`, `src/event-bus.ts`
- `src/decision-core/*`
- `src/capability-engine/*`, `src/knowledge-debt/*`, `src/knowledge-graph/*`
- `src/health-auditor.ts`, `src/auto-evolution.ts`
- Todos os comandos CLI não listados em §1
- Todas as tools MCP não listadas em §2
- Interfaces TypeScript não listadas em §3

---

## 6. Versionamento

| Nível | Mudança | Version bump |
|-------|---------|-------------|
| **Breaking** | Comando público removido ou alterado de forma incompatível | Major (X.0.0) |
| **Feature** | Novo comando público ou tool MCP adicionada | Minor (0.X.0) |
| **Fix** | Correcção de bug sem alterar interface pública | Patch (0.0.X) |
| **Internal** | Refactor de engines, reestruturação de directórios | Patch (0.0.X) — sem changeelog público |

---

## 7. Mudanças Nesta Lista

Qualquer alteração a esta lista deve:
1. Ser discutida num ADR antes de implementar
2. Actualizar o `CHANGELOG.md` com a secção "Public API Change"
3. Bump de version conforme §6
