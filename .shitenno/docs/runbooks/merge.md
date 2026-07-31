---
category: engineering
lifecycle: Active
---

# Runbook: Merge de Feature → Develop

## Pré-condições

- [ ] Working tree limpo (`git status` sem alterações pendentes)
- [ ] Testes verdes em `feat/X` (`pnpm run test`)
- [ ] Lint passa (`pnpm run lint`)
- [ ] `context_buffer.yaml` actualizado

## Passo 1: CI da Branch

```bash
git checkout feat/<escopo>
pnpm run test
pnpm run lint
pnpm run build
```

## Passo 2: Sincronizar com Develop

```bash
git fetch origin
git checkout feat/<escopo>
git merge --no-ff develop
# Resolver conflitos se existirem
```

## Passo 3: Merge para Develop

```bash
git checkout develop
git merge --no-ff feat/<escopo> -m "merge: <descrição concisa>"
```

## Passo 4: Pós-Merge

```bash
# Rodar suite completa em develop
pnpm run test
pnpm run lint
pnpm run build
```

## Passo 5: Limpeza

```bash
# Actualizar context_buffer.yaml
# Deletar branch local (apenas se sem remote)
git branch -d feat/<escopo>
```

## Rollback

Se CI pós-merge falhar:

```bash
git revert -m 1 <merge-sha>
# Documentar incidente no context_buffer.yaml
```

## Notas

- Sempre usar `--no-ff` para preservar história da feature
- Nunca fazer force push em develop
- Conflitos devem ser resolvidos antes do merge para develop
