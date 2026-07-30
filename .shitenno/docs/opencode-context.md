# opencode — Contexto Operacional do Projecto

> Este arquivo preserva metadados semânticos que **não fazem parte do schema do opencode** (`https://opencode.ai/config.json`), mas que descrevem o contrato operacional do projecto. Está incluído em `opencode.json → instructions[]` para ser carregado em toda sessão.

---

## 1. Loading Profile

**Perfil padrão:** `lite`

O conceito de `loading_profile` é uma convenção interna deste framework (não é campo nativo do opencode). Controla quanto contexto documental é carregado por sessão.

- **`lite`** (default): carrega documentos base (AGENTS.md, context_buffer).
- **`full`**: carrega também skills e regras adicionais sob demanda.

---

## 2. User Profile

Perfil do utilizador titular deste workspace. Usado por agents para calibrar tom, vocabulário e profundidade técnica das respostas.

| Campo | Valor |
|---|---|
| `shape` | `T-shaped` |
| `architecture_level` | `senior` |
| `code_level` | `pleno` |
| `preferred_tone.architecture` | `peer` |
| `preferred_tone.code` | `peer` |
| `preferred_tone.feedback` | `calibrado por camada` |

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

> **REgra #13 em AGENTS.md:** Ao iniciar QUALQUER sessão de chat (primeira mensagem do utilizador), o agente DEVE apresentar o **Quick Board** de `governance/context/context_buffer.yaml` antes da primeira resposta operacional.

### ⛔ BLOQUEADOR DE SESSÃO

Esta regra é um **BLOQUEADOR**. Nenhuma resposta operacional pode ser enviada sem o Quick Board.

**Protocolo obrigatório:**
1. Receber mensagem do utilizador
2. Ler `governance/context/context_buffer.yaml`
3. Exibir Quick Board no formato abaixo
4. SÓ ENTÃO processar a mensagem

**VIOLAÇÃO = SESSÃO INVÁLIDA**

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

- **SEMPRE** na primeira resposta a qualquer mensagem do utilizador
- **NÃO substitui** a leitura completa dos documentos P0
- **É apenas** um aviso de contexto para orientar a sessão
- **Inclui** saudações triviais como "oi", "olá", "bom dia"

### Fonte de dados

O Quick Board é alimentado por:
- `governance/context/context_buffer.yaml` — estado actual da sessão
- `docs/backlog/ACTIVE.md` — prioridades e dívidas
- `reports/` — saúde e complexidade do projecto

### Skill de Enforcement

A skill `quick-board-enforcement.md` (em `docs/skills/`) IMPLEMENTA esta regra.
O agente DEVE carregar esta skill no início de cada sessão.
