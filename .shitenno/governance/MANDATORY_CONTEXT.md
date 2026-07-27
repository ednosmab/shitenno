# MANDATORY_CONTEXT — Regras Obrigatórias de Toda Sessão

> **Este ficheiro é carregado automaticamente em TODA sessão via opencode.json.**
> Não edite manualmente. Execute `shugo status` para atualizar.

---

## ⛔ PROIBIÇÕES ABSOLUTAS

| # | Regra | Violação |
|---|---|---|
| **G-01** | Nenhum `git commit` ou `git push` sem autorização explícita do utilizador | Revert imediato + documentar |
| **G-02** | Escrita restrita ao directório do projecto (workspace root) | Revert + audit de segurança |
| **F-01** | Nenhuma lógica de domínio em componentes UI — apenas renderizar dados | Refactor obrigatório |
| **F-03** | Nenhum import cruzado entre apps — apps devem ser independentes | Correcção imediata |
| **F-06** | Nenhum ficheiro >300 linhas em `src/` (excl. `__tests__/` e `src/templates/`) | Refactor obrigatório |
| **S-01** | Nenhum HTML dinâmico sem sanitização | Bloqueio de deploy |
| **ENV-01** | Nenhuma flag de teste em configs de deploy/produção | Correcção imediata |

---

## 📐 PADRÕES DE CÓDIGO

- **Legibilidade > Concisão** — código declarativo, simples, autoexplicativo
- **SOLID** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **TDD estrito** — Red → Green → Refactor. Teste antes da implementação.
- **Limites:** função ≤50 linhas, profundidade ≤4, parâmetros ≤4, complexidade ≤15

---

## 🔒 SEGURANÇA

1. Sanitizar todo input dinâmico
2. Nunca `dangerouslySetInnerHTML` sem sanitização
3. Validar todos os dados na entrada (Zod, Yup, etc.)
4. RLS em todas as tabelas (se aplicável)
5. Sanitizar output (prevenir XSS)

---

## 📝 DOCUMENTAÇÃO

- **JSDoc** obrigatório em todas as funções exportadas
- **ADRs** para decisões arquitecturais (`docs/adrs/`)
- **Commit messages** em inglês, Conventional Commits (`feat:`, `fix:`, `chore:`)

---

## 🔄 FLUXO DE SESSÃO

1. **Início:** Ler este ficheiro + `AGENTS.md` + `context_buffer.yaml`
2. **Durante:** Seguir TDD, respeitar proibições, registar decisões3. **Fim:** `shugo feedback --outcome success|failure|partial`

---

## 🚨 REFERÊNCIAS COMPLETAS

- Proibições detalhadas: `docs/FORBIDDEN_OPERATIONS.md`
- Diretrizes de engenharia: `docs/DESDO.md`
- Skills: `docs/skills/`
- ADRs: `docs/adrs/`
