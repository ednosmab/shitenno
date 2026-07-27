# MANDATORY_CONTEXT — Regras Obrigatórias de Toda Sessão

> Carregado automaticamente via opencode.json. Não edite manualmente.

---

## ⛔ PROIBIÇÕES

| # | Regra | Violação |
|---|---|---|
| G-01 | Sem `git commit`/`git push` sem autorização explícita | Revert + documentar |
| G-02 | Escrita restrita ao workspace root | Revert + audit |
| F-01 | Sem lógica de domínio em UI — apenas renderizar | Refactor |
| F-03 | Sem import cruzado entre apps | Correcção imediata |
| F-06 | Sem ficheiro >300L em `src/` (excl. `__tests__/`, `templates/`) | Refactor |
| S-01 | Sem HTML dinâmico sem sanitização | Bloquear deploy |
| ENV-01 | Sem flags de teste em configs de produção | Correcção imediata |

## 📐 PADRÕES

> Detalhes: `docs/engineering-standards.md`

- **Legibilidade > Concisão** — código declarativo, autoexplicativo
- **SOLID** — §2 em `engineering-standards.md`
- **TDD** — §3 em `engineering-standards.md` (Red → Green → Refactor)
- **Limites** — §4 em `engineering-standards.md`

## 🔒 SEGURANÇA

> Detalhes: `docs/engineering-standards.md` §5

Sanitizar input → validar entrada (Zod/Yup) → RLS → sanitizar output

## 📝 DOCUMENTAÇÃO

- **JSDoc** obrigatório em funções exportadas
- **ADRs** para decisões arquitecturais (`docs/adrs/`)
- **Commits** em inglês, Conventional Commits

## 🔄 FLUXO

1. **Início:** Ler este + `AGENTS.md` + `context_buffer.yaml`
2. **Durante:** Seguir TDD, respeitar proibições
3. **Fim:** `shugo feedback --outcome success|failure|partial`

## 🚨 REFERÊNCIAS

- `docs/FORBIDDEN_OPERATIONS.md` — Proibições detalhadas
- `docs/DESDO.md` — Diretrizes de engenharia
- `docs/engineering-standards.md` — Padrões de código
- `docs/skills/` — Skills operacionais
