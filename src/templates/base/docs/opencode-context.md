# opencode — Contexto Operacional do Projecto

> Este arquivo preserva metadados semânticos que **não fazem parte do schema do opencode** (`https://opencode.ai/config.json`), mas que descrevem o contrato operacional do projecto. Está incluído em `opencode.json → instructions[]` para ser carregado em toda sessão.

---

## 1. Loading Profile

**Perfil padrão:** `lite`

O conceito de `loading_profile` é uma convenção interna deste framework (não é campo nativo do opencode). Controla quanto contexto documental é carregado por sessão.

- **`lite`** (default): carrega documentos base (AGENTS.md, context_buffer) + mandatory context (MANDATORY_CONTEXT.md — regras e skills sempre activas, geradas a partir do manifest).
- **`full`**: carrega também skills e regras contextuais sob demanda via MCP `getSkills` com metadados de tarefa.

---

## 2. User Profile

Perfil do utilizador titular deste workspace. Usado por agents para calibrar tom, vocabulário e profundidade técnica das respostas.

| Campo | Valor |
|---|---|
| `shape` | `[PERSONALIZAR: ex: T-shaped]` |
| `architecture_level` | `[PERSONALIZAR: ex: senior]` |
| `code_level` | `[PERSONALIZAR: ex: junior-pleno]` |
| `preferred_tone.architecture` | `[PERSONALIZAR: ex: peer (par a par)]` |
| `preferred_tone.code` | `[PERSONALIZAR: ex: mentor (explicativo)]` |
| `preferred_tone.feedback` | `[PERSONALIZAR: ex: calibrado por camada]` |

---

## 3. Agent Role Mapping (contrato semântico)

Cada agent configurado em `opencode.json → agent.*` tem um **role** interno que descreve o seu contrato semântico, **independentemente** do nome do agent ou do model atribuído.

| Agent | Role | Function |
|---|---|---|
| `plan` | `planner` | Gera planos atómicos, fragmentados para o executor. |
| `build` | `executor` | Executa o plano aprovado, passo a passo, sem refactors autónomos. |
| `review` | `auditor` | Audita execução vs. plano aprovado. Read-only (sem editar produção). |

**Princípio:**

> Trocar o `model` num agent **não quebra** sua função. Trocar o `role` **sim** — porque é o contrato semântico do agente. Por isso, mantenha o campo `role` em cada bloco de agent (o opencode tolera campos extras dentro de `agent.*` mesmo não estando no schema).

---

## 4. Quick Board — Regra Obrigatória de Início de Sessão

> **Regra #13 em AGENTS.md:** Ao iniciar QUALQUER sessão de chat (primeira mensagem do utilizador), o agente DEVE apresentar o **Quick Board** de `governance/context/context_buffer.yaml` antes da primeira resposta operacional.

### Formato do Quick Board

```
┌─────────────────────────────────────────┐
│ QUICK BOARD — <data>                    │
│ Tarefa: <tarefa em curso ou "Nenhuma">  │
│ Próximo: <próximo P0 ou "Definir">      │
│ Dívidas P1: <lista ou "Nenhuma">        │
│ Estado: <estado da última sessão>       │
└─────────────────────────────────────────┘
```

### Quando mostrar

- **Sempre** na primeira resposta a qualquer mensagem do utilizador
- **Não substitui** a leitura completa dos documentos P0
- **É apenas** um aviso de contexto para orientar a sessão

### Fonte de dados

O Quick Board é alimentado por:
- `governance/context/context_buffer.yaml` — estado actual da sessão
- `docs/backlog/ACTIVE.md` — prioridades e dívidas
- `reports/` — saúde e complexidade do projecto
