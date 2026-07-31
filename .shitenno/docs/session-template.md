---
category: engineering
lifecycle: Active
---

# Session Template — Encerramento de Sessão

> **Versão:** 1.0
> **Data:** 2026-07-01
> **Propósito:** Template para o ritual de fim de sessão (regra #12 do AGENTS.md)

---

## Checklist de Encerramento

Antes de declarar uma sessão como completa, ejecutar `pnpm run close:session` e verificar:

### 1. Working Tree Limpo
- [ ] Sem alterações por commitar (`git status --porcelain` vazio)
- [ ] Todos os ficheiros modificados estão stageados

### 2. Testes Verdes
- [ ] `pnpm run test` passa sem erros
- [ ] `tsc --noEmit` compila sem erros
- [ ] `pnpm run lint` sem warnings críticos

### 3. Buffer Actualizado
- [ ] `governance/context/context_buffer.yaml` com status `completed`
- [ ] Impedimentos resolvidos ou registados
- [ ] Technical debt registado (se existente)

### 4. Backlog Actualizado
- [ ] Item processado marcado como `[x]` em `docs/backlog/ACTIVE.md`
- [ ] Novos itens descobertos adicionados ao backlog
- [ ] Estados actualizados (concluído/pausado/adiado)

### 5. Build Verificado
- [ ] `pnpm run build:verify` passa (se aplicável)

### 6. Commit Autorizado
- [ ] Autorização explícita do utilizador obtida (regra G-01)
- [ ] Mensagem de commit em inglês (Conventional Commits)
- [ ] Nenhum segredo ou chave versionado

---

## Formato do Histórico (ROM)

Ao encerrar a sessão, gerar ficheiro em `docs/history/` com formato:

```markdown
# Sessão YYYY-MM-DD — <Título>

## Duração
- Início: HH:MM
- Fim: HH:MM

## Objectivos
- [ ] objectivo 1
- [ ] objectivo 2

## Trabalho Realizado
- Descrição do que foi feito

## Decisões Técnicas
- Decisão 1: justificação

## Estado do Repositório
- Branch: <branch>
- Último commit: <hash> <message>
- Testes: ✅/❌

## Pendências para Próxima Sessão
- item 1
- item 2
```

---

## Regras de Imutabilidade

- Ficheiros em `docs/history/` são **imutáveis** após criação
- Nenhum agente pode alterarhistóricos de sessões passadas
- Apenas o utilizador humano pode autorizar alterações a históricos

---

## Referências

- `docs/AGENTS.md` — Regra #12 (INVARIANTE DE FIM DE SESSÃO)
- `governance/WORKFLOW.md` — Fluxo de sessão
- `scripts/close-session.ts` — Script de encerramento
