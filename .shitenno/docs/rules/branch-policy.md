---
category: engineering
lifecycle: Active
---

# Branch Policy — Política de Branches e Pipeline de Merge

> **Gatilho:** Operações git (push, merge, criação de branch), pipeline de CI/CD

## Branches Canónicas

- **`main`** — código de produção. Synced com `origin/main`. Recebe apenas merges de `develop` via release.
- **`develop`** — integração contínua. **Toda** branch de feature deve mergear aqui. Deve estar sempre verde (testes 100%, build funcional).
- **`feat/<escopo>`** — branches de feature/refactor. Criadas a partir de `develop`, mergeadas de volta a `develop` via `--no-ff` quando o escopo está completo.
- **`fix/<escopo>`** — branches de correção pontual. Mesmo fluxo das `feat/*`.

## Branches de Refactor de Longa Duração

Branches de refactor estrutural podem viver semanas/meses e absorver múltiplos itens do BACKLOG.

**Política:**
1. **Nome da branch deve referenciar o roadmap** (ex: `feat/<nome-do-refactor>` → `docs/roadmaps/<roadmap>.md`).
2. **A branch de refactor deve ser recriada quando necessário** — não preservar branches órfãs com 0 commits únicos vs `develop` (risco zero de perda, ver regra DT-02).
3. **Se o refactor for pausado, registrar data `[REVISIT: YYYY-MM-DD]`** no BACKLOG e atualizar o status da branch no `governance/context/context_buffer.yaml` (regra DT-01).
4. **Antes de recriar, listar no buffer** os commits do branch antigo e confirmar via `git log <branch> --not develop` se algum é único.

## Pipeline de Merge de Feature → Develop (Caminho C)

Quando uma branch de feature (`feat/X`) está pronta para integrar `develop`, seguir o runbook de merge do projecto em `docs/runbooks/`.

**Resumo dos passos:**
1. **Pré-condições:** working tree limpo, testes verdes, `governance/context/context_buffer.yaml` actualizado.
2. **CI da branch:** `pnpm run test` + `pnpm run lint` + `pnpm run build` (se aplicável).
3. **Sincronizar `feat/X` com `develop`:** `git fetch && git checkout feat/X && git merge --no-ff develop` (resolve conflitos antecipadamente).
4. **Merge para `develop`:** `git checkout develop && git merge --no-ff feat/X -m "merge: <descrição concisa>"`.
5. **Pós-merge:** rodar suite completa de CI em `develop`, atualizar `context_buffer.md`, deletar branch local com `git branch -d feat/X` (apenas se sem remote).
6. **Rollback:** se CI pós-merge falhar, `git revert -m 1 <merge-sha>` em `develop`, documentar incidente.

> 📖 **Referência completa:** `docs/runbooks/` — runbook de merge do projecto.
