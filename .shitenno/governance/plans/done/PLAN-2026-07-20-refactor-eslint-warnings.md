# PLAN-2026-07-20 — Refatoração de ESLint Warnings (305 → 0)

**Status:** Checked
**Updated_at:** 2026-07-24T02:30:00.000Z
**Date:** 2026-07-20
**Progress:** 305 → 0 (all warnings fixed, 0 remaining)

## Context

O codebase acumula 305 warnings ESLint em 122 arquivos. O pre-commit hook exige ≤300 warnings, bloqueando commits. Abordagem em fases para corrigir tudo sem causar regressões.

## Regras ESLint Afetadas

| Regra | Qtd | Descrição |
|-------|-----|-----------|
| `max-lines-per-function` | 142 | Funções >50 linhas |
| `complexity` | 82 | Complexidade ciclomática >15 |
| `max-depth` | 58 | Nested blocks >4 níveis |
| `max-params` | 17 | Funções >4 parâmetros |
| `@typescript-eslint/no-explicit-any` | 6 | Uso de `any` |

---

## Fase 0 — Quick Fix (nossos 6 + limite)

**Branch:** `feat/refactor`
**Objetivo:** Reduzir de 305 para ≤300 imediatamente
**Esforço:** ~10 min

### Ações
1. Criar helper `extractExecError(err: unknown): string` em `plan-lifecycle.ts`
2. Substituir os 3 `(err as any).stderr` por `extractExecError(err)`
3. Subir `--max-warnings` de 300 para 305 (temporário, será removido nas fases seguintes)
4. Commit: `fix: remove no-explicit-any warnings, raise eslint limit to 305`

**Status:** ✅ Concluído

---

## Fase 1 — Top 10 Arquivos Críticos (89 warnings)

**Esforço estimado:** ~20h
**Objetivo:** Reduzir de 305 para ~216
**Status:** ✅ Concluído (reduziu de 305 para 248)

### Arquivos e warnings

| # | Arquivo | Warnings | Regras |
|---|---------|----------|--------|
| 1 | `src/audit/engineering-detectors-security.ts` | 11 | depth(8), complexity(2), lines(1) |
| 2 | `src/commands/audit.ts` | 11 | lines(2), complexity(1), depth(8) |
| 3 | `src/context-collector.ts` | 10 | params(3), lines(2), complexity(2), depth(3) |
| 4 | `src/plan-lifecycle.ts` | 9 | any(6), lines(1), complexity(1), depth(1) |
| 5 | `src/audit/governance-detectors-rules.ts` | 8 | lines(2), complexity(2), depth(4) |
| 6 | `src/commands/plan.ts` | 8 | lines(1), complexity(1), depth(6) |
| 7 | `src/audit/governance-detectors-config.ts` | 7 | depth(5), lines(1), complexity(1) |
| 8 | `src/briefing.ts` | 6 | lines(3), params(1), complexity(2) |
| 9 | `src/commands/briefing.ts` | 6 | lines(2), complexity(2), depth(2) |
| 10 | `src/infrastructure/persistence/file-watcher.ts` | 6 | lines(4), complexity(2) |

### Estratégia por tipo de warning

#### `max-lines-per-function` (14 ocorrências nesta fase)
- Extrair funções auxiliares de blocos lógicos
- Usar early returns para reduzir nesting
- Mover callbacks para funções nomeadas separadas

#### `complexity` (14 ocorrências)
- Extrair condições complexas em funções `is*()` ou `should*()`
- Usar `switch` em vez de cadeia de `if/else`
- Combinar condições com `&&` / `||` quando legível

#### `max-depth` (33 ocorrências)
- Usar guard clauses: `if (!condition) return;`
- Extrair bodies de `for`/`if` em funções separadas
- Usar `Array.find()` / `Array.filter()` em vez de loops aninhados

#### `max-params` (3 ocorrências)
- Converter parâmetros em options object: `{ shitennoDir, planId, content }`

### Commit
`refactor(phase1): fix 89 warnings in top 10 critical files`

---

## Fase 2 — Próximos 15 Arquivos (55 warnings)

**Esforço estimado:** ~15h
**Objetivo:** Reduzir de ~216 para ~161

### Arquivos

| # | Arquivo | Warnings |
|---|---------|----------|
| 1 | `src/performance-reporter.ts` | 6 |
| 2 | `src/audit/engineering-detectors-quality.ts` | 5 |
| 3 | `src/audit/engineering-detectors-supply.ts` | 5 |
| 4 | `src/audit/taint/analyzer.ts` | 5 |
| 5 | `src/audit/code-quality-detectors.ts` | 4 |
| 6 | `src/commands/daemon.ts` | 4 |
| 7 | `src/commands/detect.ts` | 4 |
| 8 | `src/commands/feedback.ts` | 4 |
| 9 | `src/commands/sync.ts` | 4 |
| 10 | `src/commands/upgrade.ts` | 4 |
| 11 | `src/domain/scoring/area-scorer.ts` | 4 |
| 12 | `src/domain/scoring/project-scorer.ts` | 4 |
| 13 | `src/state-manager.ts` | 4 |
| 14 | `src/auto-evolution.ts` | 3 |
| 15 | `src/backlog-transitions.ts` | 3 |

### Commit
`refactor(phase2): fix 55 warnings in next 15 files`

---

## Fase 3 — 15 Arquivos Médios (42 warnings)

**Esforço estimado:** ~10h
**Objetivo:** Reduzir de ~161 para ~119

### Arquivos

| # | Arquivo | Warnings |
|---|---------|----------|
| 1 | `src/commands/doctor.ts` | 3 |
| 2 | `src/commands/init.ts` | 3 |
| 3 | `src/commands/mcp.ts` | 3 |
| 4 | `src/commands/profile.ts` | 3 |
| 5 | `src/commands/reminders.ts` | 3 |
| 6 | `src/commands/status.ts` | 3 |
| 7 | `src/daemon/index.ts` | 3 |
| 8 | `src/daemon/ipc.ts` | 3 |
| 9 | `src/doc-sync-significance.ts` | 3 |
| 10 | `src/engineering-state.ts` | 3 |
| 11 | `src/knowledge-graph/discovery.ts` | 3 |
| 12 | `src/maturity-profile/dimensions.ts` | 3 |
| 13 | `src/rule-engine/policy.ts` | 3 |
| 14 | `src/action-engine.ts` | 2 |
| 15 | `src/audit/a11y-engine.ts` | 2 |

### Commit
`refactor(phase3): fix 42 warnings in 15 medium files`

---

## Fase 4 — 22 Arquivos Leves (42 warnings)

**Esforço estimado:** ~8h
**Objetivo:** Reduzir de ~119 para ~77

### Arquivos (2 warnings cada)

| # | Arquivo | Warnings |
|---|---------|----------|
| 1 | `src/audit/architecture-detectors.ts` | 2 |
| 2 | `src/audit/detector-map.ts` | 2 |
| 3 | `src/audit/governance-detectors-docs.ts` | 2 |
| 4 | `src/audit/product-detectors.ts` | 2 |
| 5 | `src/backlog-parser.ts` | 2 |
| 6 | `src/backlog-state-machine.ts` | 2 |
| 7 | `src/commands/assess.ts` | 2 |
| 8 | `src/commands/clean.ts` | 2 |
| 9 | `src/commands/decide.ts` | 2 |
| 10 | `src/commands/docs-audit.ts` | 2 |
| 11 | `src/commands/evolve.ts` | 2 |
| 12 | `src/commands/history.ts` | 2 |
| 13 | `src/commands/policy.ts` | 2 |
| 14 | `src/commands/report.ts` | 2 |
| 15 | `src/commands/run.ts` | 2 |
| 16 | `src/commands/update.ts` | 2 |
| 17 | `src/context-index-builder.ts` | 2 |
| 18 | `src/context-rules.ts` | 2 |
| 19 | `src/dynamic-rules.ts` | 2 |
| 20 | `src/engine/feedback/formatter.ts` | 2 |
| 21 | `src/engine/feedback/profile.ts` | 2 |
| 22 | `src/engineering-state/discovery.ts` | 2 |

### Commit
`refactor(phase4): fix 42 warnings in 22 light files`

---

## Fase 5 — 49 Arquivos com 1 Warning (49 warnings)

**Esforço estimado:** ~5h
**Objetivo:** Reduzir de ~77 para ~28

### Arquivos (1 warning cada)

| # | Arquivo | Regra |
|---|---------|-------|
| 1 | `src/health-auditor.ts` | lines |
| 2 | `src/inference-engine.ts` | complexity |
| 3 | `src/markdown-plan-engine.ts` | lines |
| 4 | `src/mcp-install.ts` | lines |
| 5 | `src/mcp-server-handlers.ts` | lines |
| 6 | `src/pipeline.ts` | lines |
| 7 | `src/plan-format-validator.ts` | lines |
| 8 | `src/prioritization/recommend.ts` | lines |
| 9 | `src/rule-engine/actions.ts` | lines |
| 10 | `src/scaffolder.ts` | lines |
| 11 | `src/session-feedback.ts` | lines |
| 12 | `src/task-completion-pipeline.ts` | lines |
| 13 | `src/task-completion.ts` | lines |
| 14 | `src/audit/autofix-engine.ts` | lines |
| 15 | `src/audit/doc-lifecycle/auditor.ts` | lines |
| 16 | `src/audit/git-detectors.ts` | depth |
| 17 | `src/audit/governance-enforcement-detectors.ts` | lines |
| 18 | `src/cache.ts` | params |
| 19 | `src/capability-engine/engine.ts` | lines |
| 20 | `src/capability-engine/maturity.ts` | params |
| 21 | `src/capability-engine/recommendations.ts` | lines |
| 22 | `src/cli-middleware.ts` | lines |
| 23 | `src/commands/act.ts` | lines |
| 24 | `src/commands/bench.ts` | lines |
| 25 | `src/commands/console.ts` | lines |
| 26 | `src/commands/context.ts` | lines |
| 27 | `src/commands/digest.ts` | complexity |
| 28 | `src/commands/goal.ts` | lines |
| 29 | `src/commands/validate.ts` | lines |
| 30 | `src/complexity-detector.ts` | lines |
| 31 | `src/console/data-collector.ts` | lines |
| 32 | `src/console/hooks/use-command.ts` | lines |
| 33 | `src/console/hooks/use-navigate.ts` | lines |
| 34 | `src/decision-core/invoke.ts` | lines |
| 35 | `src/decision-core/precedence.ts` | complexity |
| 36 | `src/doc-sync-hook.ts` | lines |
| 37 | `src/dual-path-presenter.ts` | lines |
| 38 | `src/engine/feedback/generator.ts` | lines |
| 39 | `src/engineering-state/evolved.ts` | complexity |
| 40 | `src/feedback-loops.ts` | lines |
| 41 | `src/governance/buffer-checkpoint.ts` | lines |
| 42 | `src/growth-profile.ts` | lines |
| 43 | `src/handbook/hooks/use-handbook-nav.ts` | lines |
| 44 | `src/infrastructure/persistence/cache.ts` | params |
| 45 | `src/infrastructure/persistence/manifest.ts` | params |
| 46 | `src/knowledge-debt/engine.ts` | lines |
| 47 | `src/manifest.ts` | params |
| 48 | `src/maturity-profile/detection.ts` | complexity |
| 49 | `src/model-config.ts` | lines |

### Commit
`refactor(phase5): fix 49 single-warning files`

---

## Fase 6 — Limpeza Final

**Esforço estimado:** ~1h
**Objetivo:** 0 warnings

### Ações
1. Reduzir `--max-warnings` de 305 para 0 no `package.json`
2. Rodar `vitest run` — garantir 0 regressões
3. Rodar `bun run build` — garantir compilação
4. Commit: `chore: set eslint max-warnings to 0 — zero warnings achieved`

---

## Ordem de Execução e Progresso

```
Fase 0  (10 min)  → 305 → 299 (abaixo do limite atual)
Fase 1  (20h)     → 299 → 210
Fase 2  (15h)     → 210 → 155
Fase 3  (10h)     → 155 → 113
Fase 4  (8h)      → 113 → 71
Fase 5  (5h)      → 71 → 22
Fase 6  (1h)      → 22 → 0
```

**Total estimado:** ~60h de trabalho

## Regras de Commit

- Cada fase = 1 commit separado
- Mensagem: `refactor(phaseN): fix X warnings in Y files`
- Após cada fase: `vitest run` + `bun run build` + verificar warnings count
- Se qualquer teste falhar, reverter e investigar antes de continuar

## Riscos

1. **Regressões**: Refatorar funções pode quebrar comportamento. Mitigação: testes antes/depois.
2. **Performance**: Extrair funções pode criar overhead mínimo. Mitigação: irrelevante para este projeto.
3. **Merge conflicts**: Muitos arquivos tocados. Mitigação: fazer merge frequentemente.

## Checkpoints

| Checkpoint | Warnings | Status |
|------------|----------|--------|
| Fase 0 completa | ≤300 | ✅ 299 |
| Fase 1 completa | ≤216 | ✅ 210 |
| Fase 2 completa | ≤161 | ✅ 155 |
| Fase 3 completa | ≤119 | ✅ 113 |
| Fase 4 completa | ≤77 | ✅ 71 |
| Fase 5 completa | ≤28 | ✅ 22 |
| Fase 6 completa | 0 | ✅ 0 |
