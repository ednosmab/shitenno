# CONTEXT_HIERARCHY — Hierarquia P0-P4

> **Versão:** 1.0
> **Data:** [DATE]
> **Propósito:** Definir a ordem de leitura obrigatória para optimizar tokens

---

## Princípio Fundamental

> **O agente NUNCA decide o que ler primeiro. Esta hierarquia determina a ordem com base no tipo de informação necessária.**

---

## Níveis de Contexto

### P0 — Regras Globais (SEMPRE)

| Arquivo | Propósito | Quando Ler |
|---|---|---|
| `shitenno/docs/AGENTS.md` | Regras do time de engenharia | Toda sessão |
| `shitenno/docs/FORBIDDEN_OPERATIONS.md` | Regras vinculantes | Toda sessão |
| `shitenno/docs/DESDO.md` | Diretrizes de engenharia | Toda sessão |

**Regra:** P0 é carregado **sempre**, independentemente do tipo de tarefa.

---

### P1 — Estado Actual (SEMPRE)

| Arquivo | Propósito | Quando Ler |
|---|---|---|
| `shitenno/governance/context/context_buffer.yaml` | Estado da sessão activa | Toda sessão |

**Regra:** P1 é carregado **sempre** para entender o estado actual do sistema.

---

### P2 — Plano da Camada (POR TAREFA)

| Arquivo | Propósito | Quando Ler |
|---|---|---|
| `shitenno/docs/layers/[camada]/execution_plan.md` | Plano técnico da camada | Por tarefa |
| MCP `getSkills` (com task metadata) | Skills obrigatórias e contextuais resolvidas pelo manifest | Por tarefa |
| `shitenno/docs/skills/[skill].md` | Skill operacional (lookup directo) | Por tarefa |

**Regra:** P2 é carregado **apenas quando** se trabalha numa camada específica. As skills são resolvidas via MCP `getSkills` passando `task`/`language`/`framework`/`layer` — mandatory skills são retornadas em texto integral, contextual skills como ponteiros.

> **Nota:** Mandatory skills também chegam pré-anexadas ao output de `getBriefing` quando o parâmetro `task` é fornecido, criando dois caminhos independentes para as mesmas skills obrigatórias.

---

### P3 — Código e Arquivos (EXECUÇÃO)

| Arquivo | Propósito | Quando Ler |
|---|---|---|
| `src/**` | Código fonte | Na execução |

**Regra:** P3 é carregado **apenas durante** a execução do código.

---

### P4 — Auditoria (SOB DEMANDA)

| Arquivo | Propósito | Quando Ler |
|---|---|---|
| `shitenno/docs/history/*.md` | Registos históricos | Sob demanda |
| `shitenno/docs/feedback/*.md` | Feedback de sessões | Sob demanda |

**Regra:** P4 é carregado **apenas quando** solicitado explicitamente.

---

## Fluxo de Leitura

```
┌─────────────────────────────────────────────────────────┐
│                    P0 (SEMPRE)                          │
│  AGENTS.md + FORBIDDEN_OPERATIONS + DESDO               │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    P1 (SEMPRE)                          │
│  context_buffer.yaml                                    │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    P2 (POR TAREFA)                      │
│  execution_plan.md + skill.md                           │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    P3 (EXECUÇÃO)                        │
│  Código fonte                                           │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    P4 (SOB DEMANDA)                     │
│  history/ + feedback/                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Otimização de Tokens

### Loading Profiles

| Perfil | Regras Carregadas | Quando Usar | Tokens Aprox. |
|---|---|---|---|
| `minimal` | P0 completo | Tarefas triviais | ~3-4k |
| `lite` | P0 + P1 | Feature pequena, bug fix | ~5-6k |
| `full` | P0 + P1 + P2 completo | Refactor, migration | ~8-10k |

### Override

O campo `loading_profile` em `opencode.json` força o perfil independentemente do default.

---

## Regras de Omissão

1. **Nunca pular P0** — Mesmo para tarefas triviais
2. **Nunca pular P1** — Sempre saber o estado actual
3. **P2 é opcional** — Apenas para tarefas que afectam camada específica
4. **P3 é sob demanda** — Apenas durante execução
5. **P4 é raro** — Apenas para auditoria ou retrospectiva

---

## Changelog

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | [DATE] | Criação da hierarquia de contexto |
