---
category: engineering
lifecycle: Active
---

# 📋 REGISTRY.md — Rule → Capability Mapping

> Auto-generated registry for dynamic rule loading.
> Each rule in AGENTS.md maps to a required capability.
> Rules are only loaded if ALL their required capabilities are active.

**Version:** 1.0
**Last updated:** 2026-07-12

---

## Capability Levels

| Level | Capabilities |
|-------|-------------|
| **simple** | `core` |
| **medium** | `core`, `knowledge`, `governance`, `quality` |
| **complex** | `core`, `knowledge`, `governance`, `architecture`, `ai`, `quality`, `metrics`, `operations`, `compliance` |

---

## Rule Registry

| Rule # | ID | Requires | Description |
|--------|-----|----------|-------------|
| #1 | COMMIT_PERMISSION | `core` | Nunca commit sem permissão |
| #2 | COMMITS_ENGLISH | `core` | Commits curtos em inglês |
| #3 | BOOTSTRAP_SETUP | `governance` | Setup proactivo |
| #4 | LEAN_FLOW | `governance` | Refinamento contínuo |
| #5 | TDD_STRICT | `knowledge` | Test-first development |
| #6 | SECURITY_VALIDATION | `knowledge` | Security by default |
| #7 | SENIOR_ENGINEER | `knowledge` | Postura sênior |
| #8 | TDD_SKILL | `knowledge` | Activar skill TDD |
| #9 | POST_COMMIT_CHECK | `operations` | Validação pós-commit |
| #10 | DEPLOY_CHECKLIST | `operations` | Checklist pré-deploy |
| #11 | SESSION_PRIORITY | `governance` | P0 primeiro na sessão |
| #12 | SESSION_INVARIANT | `governance` | Ritual fim de sessão |
| #13 | QUICK_BOARD | `metrics` | Quick board display |
| #14 | EVIDENCE_OVER_DOCS | `core` | Evidência > documentação |
| #15 | MEASURE_BEFORE_OPTIMIZE | `core` | Métricas antes de optimizar |
| #16 | BACKLOG_STATES | `governance` | Estados formais do backlog |
| #17 | COMPLETION_CHECKLIST | `governance` | Checklist de conclusão |
| #18 | PERSONALIZABLE | `core` | Regras específicas do projecto |
| #19 | GAP_DETECTION | `core` | Deteção proactiva de gaps |
| #20 | INFRA_VALIDATION | `core` | Validação pré-tarefa |
| #21 | AUTO_RECOMMEND | `core` | Recomendar capacidades |

---

## Summary by Capability

| Capability | Rules | Count |
|-----------|-------|-------|
| `core` | #1, #2, #14, #15, #18, #19, #20, #21 | 8 |
| `governance` | #3, #4, #11, #12, #16, #17 | 6 |
| `knowledge` | #5, #6, #7, #8 | 4 |
| `operations` | #9, #10 | 2 |
| `metrics` | #13 | 1 |
