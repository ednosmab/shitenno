---
category: product
lifecycle: Active
---

# FORBIDDEN_OPERATIONS — Regras Vinculantes

> **Versão:** 1.1
> **Data:** 2026-07-17
> **Autoridade:** Tech Lead Humano
> **Aplicável a:** Todos os agentes IA

---

## Princípio Fundamental

> **Estas regras são ABSOLUTAS e INEGOCIÁVEIS. Nenhum agente pode violá-las, mesmo que o utilizador solicite. Violações devem ser reportadas e corrigidas imediatamente.**

---

## Proibições Absolutas

### G — Gestão e Controlo

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **G-01** | Nenhum `git commit` sem autorização explícita | É proibido executar `git commit` ou `git push` sem autorização prévia do utilizador | Revert imediato + documentar incidente | Parcial | git hook `pre-commit` checando env var |
| **G-02** | Nenhuma alteração fora do workspace root | Escrita restrita ao directório do projecto | Revert + audit de segurança | Sim | `path-safety.ts` |

### F — Fundação e Estrutura

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **F-01** | Nenhuma lógica de domínio em componentes UI | Componentes UI devem apenas renderizar dados | Refactor obrigatório | Não | Comportamental |
| **F-03** | Nenhum import cruzado entre apps | Apps devem ser independentes | Correcção imediata | Sim | `eslint-plugin-boundaries` ou custom |
| **F-04** | Nenhum schema de validação fora da camada de contratos | Schemas ficam em `packages/types/` (futuro) | Revert | Parcial | Lint de path de import |
| **F-06** | Nenhum ficheiro >300 linhas em `src/` | Excluindo `__tests__/` e `src/templates/` — ver ADR-007 | Refactor obrigatório | Sim | `scripts/check-file-size.sh` |

### S — Segurança

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **S-01** | Nenhum HTML dinâmico sem sanitização | Todo conteúdo dinâmico deve ser sanitizado | Bloqueio de deploy | Parcial | `eslint-plugin-security` detecta `dangerouslySetInnerHTML` sem sanitizer |
| **S-02** | Nenhuma tabela sem RLS configurado | Todas as tabelas devem ter Row Level Security | Bloqueio de deploy | Sim | Script de CI que varre migrations |

### DB — Base de Dados

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **DB-01** | Nenhuma mutação JSONB sem validação | Dados JSONB devem ser validados antes de escrita | Revert | Não | Comportamental |

### ENV — Ambiente

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **ENV-01** | Nenhuma flag de teste em configs de deploy | Flags de teste não devem propagar para produção | Correcção imediata | Sim | CI check de variáveis de ambiente |

### CONFID — Confidencialidade

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **CONFID-01** | Nenhuma informação comercial sensível em código | Proibido mencionar nomes de alvos, parceiros ou entidades | Remoção + audit | Não | Comportamental |

### DT — Dívida Técnica

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **DT-01** | Nenhuma pausa sem data `[REVISIT: YYYY-MM-DD]` | Itens pausados devem ter data de reavaliação | Reabrir item | Sim | Lint de texto em markdown |
| **DT-02** | Nenhuma branch órfãs com 0 commits únicos | Branches devem ser recriadas quando necessário | Recriar branch | Sim | Script git periódico |

### FRZ — Freeze de Engines (PLAN-2026-07-17)

| # | Regra | Descrição | Consequência | Verificável | Mecanismo |
|---|---|---|---|---|---|
| **FRZ-01** | Nenhum `*-engine.ts` / `*-detector.ts` / `*-analyser.ts` novo até Fase 2 da consolidação | Congelar criação de novas engines. Qualquer necessidade nova deve tentar encaixar em engine existente ou justificar por escrito por que não cabe | Revert + documentar no plano de consolidação | Parcial | Revisão de PR (regra social) |

> **Escopo:** Aplica-se a todos os arquivos `src/` que sigam o padrão `*-engine.ts`, `*-detector.ts` ou `*-analyser.ts`.
> **Duração:** Até conclusão da Fase 2 de `PLAN-2026-07-17-consolidacao-produtizacao-multi-projeto`.

---

## Referências

- `docs/AGENTS.md` — Regras do time (P0)
- `docs/DESDO.md` — Diretrizes de engenharia
- `governance/WORKFLOW.md` — Fluxos de sessão
