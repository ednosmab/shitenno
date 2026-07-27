# PLAN-file-refactor-64-overloaded — Refactorização de 64 Ficheiros >300 Linhas

**Status:** Done
**Date:** 2026-07-25
**Updated_at:** 2026-07-28T03:25:18.161Z
**Priority:** P1
**Owner:** AI Agent + Tech Lead
**Estimated Time:** 61 sprints

---

## Contexto

64 ficheiros TypeScript em `src/` ultrapassam o limite de 300 linhas definido pela regra F-06 (`FORBIDDEN_OPERATIONS.md`). O pre-commit hook sinaliza estes ficheiros como warnings. O projecto já tem padrões de splitting provados em `audit/`, `status/`, `plan/` e `upgrade/` — este plano replica esses padrões para os restantes.

**Estado actual:** 64 ficheiros >300 linhas, total ~27.500 linhas
**Estado pretendido:** Todos os ficheiros ≤300 linhas, responsabilidades separadas, testabilidade melhorada

## Objetivo

Fragmentar, refatorar e corrigir lógica em todos os 64 ficheiros acima de 300 linhas, seguindo o padrão de splitting já validado no projecto.

**Critérios de aceitação:**
1. Zero ficheiros >300 linhas em `src/` (excl. `__tests__/` e `templates/`)
2. Cada novo ficheiro exporta apenas responsabilidades coesas
3. `pnpm run lint` sem erros novos
4. `pnpm run typecheck` sem erros novos
5. `pnpm run sync:docs` sem erros novos
6. Todos os imports existentes mantêm compatibilidade (re-exports quando necessário)

## Passos de Implementação

### FASE 1 — Fundações (17 ficheiros)

> Extrair tipos, constants e registry central. Base para todas as fases seguintes.

### Passo 1.1: Audit Types Split ✅
**Ficheiro:** `src/audit/types.ts` (334→barrel)
**Acção:** Dividir por domínio em `types/common.ts`, `types/governance.ts`, `types/engineering.ts`, `types/security.ts`. Manter barrel `types.ts` com re-exports.
**Verificação:** `pnpm run typecheck` ✅

### Passo 1.2: Audit Constants Split ✅
**Ficheiro:** `src/audit/constants.ts` (456→barrel)
**Acção:** Extrair `DETECTORS_BY_LEVEL` para `constants/detector-levels.ts`. Manter thresholds e patterns em `constants.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.3: Detector Map Split ✅
**Ficheiro:** `src/audit/detector-map.ts` (497→barrel)
**Acção:** Extrair 6 builder functions para `detector-map/governance.ts`, `engineering.ts`, `git.ts`, `arch.ts`, `ops.ts`, `supply-chain.ts`. Manter `buildDetectorMap` como orquestrador.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.4: Commands Briefing Split ✅
**Ficheiro:** `src/commands/briefing.ts` (532→barrel)
**Acção:** Extrair `briefing/display.ts`, `briefing/challenges.ts`, `briefing/collectors.ts`. Manter orquestração e command registration.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.5: Commands Init Split ✅
**Ficheiro:** `src/commands/init.ts` (514→barrel)
**Acção:** Extrair `init/display.ts`, `init/mcp.ts`, `init/orchestration.ts`, `init/prompts.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.6: Commands Validate Split ✅
**Ficheiro:** `src/commands/validate.ts` (509→barrel)
**Acção:** Extrair `validate/checks.ts`, `validate/display.ts`, `validate/fixers.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.7: Markdown Plan Engine Split ✅
**Ficheiro:** `src/markdown-plan-engine.ts` (619→barrel)
**Acção:** Extrair `markdown-plan-engine/file-operations.ts`, `markdown-plan-engine/status-inference.ts`. Manter `MarkdownPlanEngine` como orquestrador.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.8: Briefing Core Split ✅
**Ficheiro:** `src/briefing.ts` (598→305)
**Acção:** Extrair `briefing-formatter.ts` (218L), `briefing-diff.ts` (91L).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.9: Context Collector Split ✅
**Ficheiro:** `src/context-collector.ts` (527→barrel)
**Acção:** Extrair `context-collector/types.ts`, `context-collector/quick-board.ts`, `context-collector/enrichments.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.10: Context Buffer Writer Split ✅
**Ficheiro:** `src/context-buffer-writer.ts` (498→barrel)
**Acção:** Extrair `context-buffer-writer/buffer-io.ts`, `context-buffer-writer/updates.ts`, `context-buffer-writer/reminders.ts`, `context-buffer-writer/impediments.ts`, `context-buffer-writer/skill-resolution.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.11: Prioritization Recommend Split ✅
**Ficheiro:** `src/prioritization/recommend.ts` (504→barrel)
**Acção:** Extrair `recommend/types.ts`, `recommend/generators.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.12: Prioritization Evaluators Split ✅
**Ficheiro:** `src/prioritization/evaluators.ts` (452→barrel)
**Acção:** Extrair `evaluators/types.ts`, `evaluators/evaluators.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.13: File Watcher Split ✅
**Ficheiro:** `src/infrastructure/persistence/file-watcher.ts` (513→barrel)
**Acção:** Extrair `file-watcher/types.ts`, `file-watcher/handlers.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.14: Rule Engine Policy Split ✅
**Ficheiro:** `src/rule-engine/policy.ts` (431→barrel)
**Acção:** Extrair `policy/types.ts`, `policy/conditions.ts`, `policy/repository.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.15: Backlog Writer Split ✅
**Ficheiro:** `src/backlog-writer.ts` (471→barrel)
**Acção:** Extrair `backlog-writer/core.ts`, `backlog-writer/legacy.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.16: Event Payloads Split ✅
**Ficheiro:** `src/event-payloads.ts` (450→barrel 92L)
**Acção:** Extrair `event-payloads/types.ts` (397L). Manter `createEventPayload` helper.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 1.17: Action Engine Split ✅
**Ficheiro:** `src/action-engine.ts` (446→barrel 12L)
**Acção:** Extrair `action-engine/types.ts` (92L), `action-engine/executors.ts` (121L), `action-engine/engine.ts` (215L).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

---

### FASE 2 — Audit Detectors (9 ficheiros)

> Cada detector é uma função pura `() => HealthIssue[]`. Split por sub-domínio.

### Passo 2.1: Security Detectors Split
**Ficheiro:** `src/audit/engineering-detectors-security.ts` (626 linhas)
**Acção:** Dividir: `security/secrets.ts`, `security/injection.ts`, `security/crypto.ts`, `security/path-traversal.ts`, `security/cors.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.2: Docs Detectors Split
**Ficheiro:** `src/audit/governance-detectors-docs.ts` (544 linhas)
**Acção:** Dividir: `docs/structure.ts`, `docs/refs.ts`, `docs/config.ts`, `docs/maturity.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.3: Config Detectors Split
**Ficheiro:** `src/audit/governance-detectors-config.ts` (509 linhas)
**Acção:** Dividir: `config/adr.ts`, `config/naming.ts`, `config/consistency.ts`, `config/skills.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.4: Code Quality Detectors Split
**Ficheiro:** `src/audit/code-quality-detectors.ts` (494 linhas)
**Acção:** Dividir: `quality/jsdoc.ts`, `quality/correctness.ts`, `quality/complexity.ts`, `quality/duplication.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.5: Compliance Detectors Split
**Ficheiro:** `src/audit/compliance-detectors.ts` (459 linhas)
**Acção:** Dividir: `compliance/owasp.ts`, `compliance/soc2.ts`, `compliance/lgpd.ts`, `compliance/operational.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.6: Quality Detectors Split
**Ficheiro:** `src/audit/engineering-detectors-quality.ts` (451 linhas)
**Acção:** Dividir: `quality/tests.ts`, `quality/metrics.ts`, `quality/static.ts`, `quality/dead-code.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.7: Rules Detectors Split
**Ficheiro:** `src/audit/governance-detectors-rules.ts` (431 linhas)
**Acção:** Dividir: `rules/scripts.ts`, `rules/integrity.ts`, `rules/consistency.ts`, `rules/hygiene.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.8: Enforcement Detectors Split
**Ficheiro:** `src/audit/governance-enforcement-detectors.ts` (394 linhas)
**Acção:** Dividir: `enforcement/session.ts`, `enforcement/state-machine.ts`, `enforcement/plan.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 2.9: Supply Detectors Split
**Ficheiro:** `src/audit/engineering-detectors-supply.ts` (366 linhas)
**Acção:** Dividir: `supply/versions.ts`, `supply/dependencies.ts`, `supply/secrets.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

---

### FASE 3 — Commands Restantes (10 ficheiros)

### Passo 3.1: Detect Command Split
**Ficheiro:** `src/commands/detect.ts` (422 linhas)
**Acção:** Extrair `detect/display.ts` (~180), `detect/semantic.ts` (~80), `detect/rules.ts` (~60).
**Verificação:** `pnpm run lint && pnpm run typecheck`

### Passo 3.2: Goal Command Split
**Ficheiro:** `src/commands/goal.ts` (391 linhas)
**Acção:** Extrair `goal/display.ts` (~100).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.3: Daemon Command Split
**Ficheiro:** `src/commands/daemon.ts` (381 linhas)
**Acção:** Extrair `daemon/display.ts` (~100), `daemon/logs.ts` (~100).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.4: Sync Command Split
**Ficheiro:** `src/commands/sync.ts` (377 linhas)
**Acção:** Extrair `sync/merge.ts` (~150), `sync/display.ts` (~80).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.5: Update Command Split
**Ficheiro:** `src/commands/update.ts` (374 linhas)
**Acção:** Extrair `update/display.ts` (~120).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.6: Doctor Command Split
**Ficheiro:** `src/commands/doctor.ts` (358 linhas)
**Acção:** Extrair `doctor/analysis.ts` (~160), `doctor/display.ts` (~80).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.7: Assess Command Split
**Ficheiro:** `src/commands/assess.ts` (354 linhas)
**Acção:** Extrair `assess/display.ts` (~120), `assess/profile.ts` (~130).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.8: Reminders Command Split
**Ficheiro:** `src/commands/reminders.ts` (341 linhas)
**Acção:** Extrair `reminders/storage.ts` (~80).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.9: Feedback Command Split
**Ficheiro:** `src/commands/feedback.ts` (331 linhas)
**Acção:** Extrair `feedback/display.ts` (~60), `feedback/modes.ts` (~120).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 3.10: Evolve Command Split
**Ficheiro:** `src/commands/evolve.ts` (322 linhas)
**Acção:** Extrair `evolve/semantic-display.ts` (~80).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

---

### FASE 4 — Semantic & Domain (5 ficheiros)

### Passo 4.1: Semantic Rules Split ✅
**Ficheiro:** `src/semantic/rules.ts` (393 linhas)
**Acção:** Extrair `CLASSIFICATION_RULES` array (~358 linhas) para `rules/classification-rules.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 4.2: Semantic Reasoner Split ✅
**Ficheiro:** `src/semantic/reasoner.ts` (362 linhas)
**Acção:** Extrair `insight-rules.ts` (6 regras), `evidence-collector.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 4.3: Area Scorer Split ✅
**Ficheiro:** `src/domain/scoring/area-scorer.ts` (458 linhas)
**Acção:** Extrair `area-scanner.ts`, `git-churn.ts`, `behavioral-metrics.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 4.4: Taint Analyzer Split ✅
**Ficheiro:** `src/audit/taint/analyzer.ts` (483 linhas)
**Acção:** Extrair `ast-visitor.ts` (~180), `issue-builder.ts` (~55).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 4.5: Architecture + Tech Debt Detectors ✅
**Ficheiros:** `src/audit/architecture-detectors.ts` (312), `src/audit/tech-debt-detectors.ts` (310)
**Acção:** Dividir cada em 2 sub-domínios.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

---

### FASE 5 — Core Engines Restantes (14 ficheiros)

### Passo 5.1: Performance Reporter Split
**Ficheiro:** `src/performance-reporter.ts` (563 linhas)
**Acção:** Dividir: `reporter/telemetry-readers.ts`, `reporter/assembly.ts`, `reporter/insights.ts`, `reporter/summary.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.2: MCP Handlers Split
**Ficheiro:** `src/mcp-server-handlers.ts` (473 linhas)
**Acção:** Dividir: `mcp-handlers/briefing.ts`, `mcp-handlers/knowledge.ts`, `mcp-handlers/plans.ts`, `mcp-handlers/feedback.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.3: Backlog Writer Split
**Ficheiro:** `src/backlog-writer.ts` (471 linhas)
**Acção:** Extrair `backlog-format.ts` (~180 linhas de formatação).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.4: Event Payloads Split
**Ficheiro:** `src/event-payloads.ts` (450 linhas)
**Acção:** Dividir por domínio: `payloads/session.ts`, `payloads/plan.ts`, `payloads/feedback.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.5: Action Engine Split
**Ficheiro:** `src/action-engine.ts` (446 linhas)
**Acção:** Extrair `executors/log.ts`, `executors/notify.ts`, `repository.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.6: Feedback Loops Split
**Ficheiro:** `src/feedback-loops.ts` (426 linhas)
**Acção:** Extrair `feedback-dimensions.ts` (~100), `feedback-patterns.ts` (~80).
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.7: Scaffolder Split
**Ficheiro:** `src/scaffolder.ts` (425 linhas)
**Acção:** Extrair `scaffold/templates.ts`, `scaffold/skills.ts`, `scaffold/gitignore.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.8: Auto Evolution Split
**Ficheiro:** `src/auto-evolution.ts` (420 linhas)
**Acção:** Extrair `evolution/capability.ts`, `evolution/knowledge.ts`, `evolution/governance.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.9: State Manager Split
**Ficheiro:** `src/state-manager.ts` (411 linhas)
**Acção:** Dividir: `knowledge-reader.ts`, `project-state-reader.ts`, `session-memory-reader.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.10: Advanced Infrastructure Split
**Ficheiro:** `src/advanced-infrastructure.ts` (392 linhas)
**Acção:** Dividir: `infrastructure/dead-letter.ts`, `infrastructure/event-replayer.ts`, `infrastructure/versioning.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.11: Engineering State Evolved Split
**Ficheiro:** `src/engineering-state/evolved.ts` (391 linhas)
**Acção:** Dividir: `evolved/lifecycle.ts`, `evolved/event-sourced.ts`, `evolved/consolidator.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.12: Doc Engine Split
**Ficheiro:** `src/doc-engine.ts` (348 linhas)
**Acção:** Extrair geradores por tipo de doc em sub-módulos.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.13: Engineering State Review
**Ficheiro:** `src/engineering-state.ts` (344 linhas)
**Acção:** Verificar se discovery/io existentes cobrem — caso contrário, extrair remaining helpers.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 5.14: Feedback Generator Split
**Ficheiro:** `src/engine/feedback/generator.ts` (353 linhas)
**Acção:** Extrair `feedback/items.ts`, `feedback/guidance.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

---

### FASE 6 — Ficheiros Pequenos (12 ficheiros)

### Passo 6.1: Plan Backlog Sync Split ✅
**Ficheiro:** `src/plan-backlog-sync.ts` (340→191)
**Acção:** Extrair `plan-backlog-sync/checklist.ts`, `plan-backlog-sync/retroactive.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.2: Pattern Detector Split ✅
**Ficheiro:** `src/pattern-detector.ts` (338→82)
**Acção:** Extrair `pattern-detector/history.ts`, `pattern-detector/detectors.ts`, `pattern-detector/rules.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.3: Pipeline Split ✅
**Ficheiro:** `src/pipeline.ts` (330→216)
**Acção:** Extrair `pipeline/stages.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.4: Challenge Responder Split ✅
**Ficheiro:** `src/challenge-responder.ts` (325→172)
**Acção:** Extrair `challenge-responder/storage.ts`, `challenge-responder/actions.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.5: Daemon Client Split ✅
**Ficheiro:** `src/daemon-client.ts` (312→37)
**Acção:** Extrair `daemon-client/paths.ts`, `daemon-client/process.ts`, `daemon-client/ipc.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.6: Inference Engine Split ✅
**Ficheiro:** `src/inference-engine.ts` (317→124)
**Acção:** Extrair `inference-engine/analysis.ts`, `inference-engine/recommendations.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.7: Handbook Nav Split ✅
**Ficheiro:** `src/handbook/hooks/use-handbook-nav.ts` (320→280)
**Acção:** Extrair `TOPIC_REGISTRY` para `handbook/data/topic-registry.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

### Passo 6.8: Audit Display Split ✅
**Ficheiro:** `src/commands/audit/display.ts` (315→191)
**Acção:** Extrair `commands/audit/display-summary.ts`.
**Verificação:** `pnpm run lint && pnpm run typecheck` ✅

---

### FICHEIROS A MANTER (3)

| Ficheiro | Linhas | Razão |
|---|---|---|
| `src/help-data.ts` | 440 | Dado estático puro, zero dependências, sem lógica |
| `src/doc-sync-significance.ts` | 302 | Módulo puro, zero imports, já no limite |
| `src/semantic/pattern-rules.ts` | 321 | 6 regras coesas, marginal benefício de split |

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Manter barrel `types.ts` com re-exports | Deletar e mudar todos os imports | Compatibilidade retroactiva — evita quebra em 17+ ficheiros |
| 2 | Split por sub-domínio funcional | Split por número de linhas fixo | Cada sub-domínio é coesão natural — split artificial cria dependências cruzadas |
| 3 | Extrair `display.ts` primeiro nos commands | Extrair lógica primeiro | O padrão `audit/display.ts` já está validado no projecto |
| 4 | Manter 3 ficheiros como estão | Forçar split em todos | `help-data.ts` é dado estático puro — splitting destrói coesão sem ganho |
| 5 | Executar por fases com verificação entre cada | Refactor em massa | Permite commit incremental e rollback fácil |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Imports quebrados entre módulos | Alto | Re-export barrel files + typecheck após cada passo |
| 2 | Circular imports ao extrair sub-módulos | Alto | Auditar dependências antes do split — usar tipo `import type` |
| 3 | Regressão em testes | Médio | Executar `pnpm run test` após cada fase completa |
| 4 | Perda de contexto em sessões longas | Médio | Commit incremental por fase — cada fase é um commit separado |
| 5 | Conflitos com outros desenvolvedores | Baixo | Branch dedicada `refactor/overloaded-files` — merges fase a fase |
