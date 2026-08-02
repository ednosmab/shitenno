# Plano de Melhorias — Auditoria Enterprise (2026-07-16)

**Status:** In Progress
**Updated_at:** 2026-07-21T15:11:11.066Z
**Date:** 2026-07-16
**Health Score:** 59/100 (enterprise level, 170 detectors, 257 files scanned)
**Duration:** 58.6s

---

## Resumo da Auditoria

| Severidade | Quantidade | % do Total |
|---|---|---|
| Crítico (3) | 35 | 4.1% |
| Aviso (2) | 169 | 19.6% |
| Info (1) | 659 | 76.4% |
| **Total** | **863** | **100%** |

### Top Issues por Tipo

| Tipo | Qtd | Severidade | Descrição |
|---|---|---|---|
| `unused_export` | 399 | Info | Exports não utilizados no codebase |
| `unsafe_deserialize` | 67 | Info | JSON.parse sem validação de schema |
| `empty_catch` | 55 | Warn | Blocos catch vazios (swallowed errors) |
| `high_complexity` | 49 | Crit/Warn | Funções com complexidade ciclomática alta |
| `srp_violation` | 38 | Warn | Violações do Single Responsibility Principle |
| `god_function` | 36 | Warn | Funções com mais de 50 linhas |
| `deep_nesting` | 30 | Warn | Aninhamento profundo (>4 níveis) |
| `broken_ref` | 23 | Warn | Referências quebradas em documentação |
| `dead_rule` | 18 | Warn | Regras definidas mas nunca executadas |
| `long_params` | 15 | Warn | Funções com >4 parâmetros |
| `orphan_module` | 10 | Warn | Módulos não importados por ninguém |
| `oversized_file` | 10 | Warn | Ficheiros >300 linhas |
| `dead_code` | 10 | Info | Código morto detectado |
| `n_plus_one_query` | 10 | Warn | Padrões N+1 |
| `empty_dir` | 9 | Info | Directórios vazios |
| `system_map_mismatch` | 8 | Warn | Directórios não documentados no SYSTEM_MAP |
| `path_traversal` | 6 | Crit | Riscos de path traversal |
| `regex_dos` | 5 | Warn | Regex com risco de ReDoS |
| `stale_buffer` | 2 | Warn | Context buffer desactualizado |

---

## Plano de Acção

### Fase 1 — Correcções Críticas (P0)

| # | Item | Tipo | Esforço | Ficheiros |
|---|---|---|---|---|
| 1.1 | Corrigir path_traversal (6 instâncias) | Segurança | Médio | `src/commands/*.ts` |
| 1.2 | Corrigir circular_dep (2 instâncias) | Arquitetura | Médio | Detectar e quebrar ciclos |
| 1.3 | Corrigir xss_risk (2 instâncias) | Segurança | Baixo | Sanitizar output |
| 1.4 | Corrigir sql_injection (1 instância) | Segurança | Baixo | Parametrizar queries |
| 1.5 | Corrigir tainted_input (1 instância) | Segurança | Baixo | Validar inputs |
| 1.6 | Corrigir typosquatting_risk (1 instância) | Segurança | Baixo | Verificar dependências |
| 1.7 | Corrigir high_complexity críticos (21 instâncias) | Qualidade | Alto | `src/commands/*.ts`, `src/audit/analyzer.ts`, `src/daemon.ts` |

**Total:** 13 issues críticos (severity 3)
**Critérios de conclusão:** 0 issues com severity 3

---

### Fase 2 — Redução de Complexidade (P1)

| # | Item | Tipo | Esforço | Ficheiros |
|---|---|---|---|---|
| 2.1 | Decompor high_complexity warnings (28 instâncias) | Qualidade | Alto | Diversos módulos |
| 2.2 | Eliminar god_functions (36 instâncias) | Qualidade | Alto | Diversos módulos core |
| 2.3 | Reduzir deep_nesting (30 instâncias) | Qualidade | Médio | Diversos |
| 2.4 | Reduzir long_params (15 instâncias) | Qualidade | Médio | Diversos |
| 2.5 | Decompor srp_violations (38 instâncias) | Qualidade | Alto | Diversos módulos |

**Critérios de conclusão:** 0 god_function, <10 deep_nesting, <5 high_complexity warnings

---

### Fase 3 — Limpeza de Código (P2)

| # | Item | Tipo | Esforço | Ficheiros |
|---|---|---|---|---|
| 3.1 | Eliminar empty_catch blocks (55 instâncias) | Robustez | Médio | Diversos |
| 3.2 | Remover dead_code (10 instâncias) | Limpeza | Baixo | Diversos |
| 3.3 | Remover unused exports (399 instâncias) | Limpeza | Alto | Todo o codebase |
| 3.4 | Remover orphan_modules (10 instâncias) | Limpeza | Baixo | `src/cli-middleware.ts`, `src/daemon.ts`, etc. |
| 3.5 | Resolver n_plus_one_query (10 instâncias) | Performance | Médio | Diversos |
| 3.6 | Corrigir regex_dos (5 instâncias) | Segurança | Baixo | Diversos |

**Critérios de conclusão:** 0 empty_catch, 0 dead_code, 0 orphan_module

---

### Fase 4 — Documentação e Governança (P3)

| # | Item | Tipo | Esforço | Ficheiros |
|---|---|---|---|---|
| 4.1 | Corrigir broken_refs (23 instâncias) | Docs | Médio | `docs/AGENTS.md`, `docs/capabilities.md`, etc. |
| 4.2 | Remover dead_rules (18 instâncias) | Governança | Baixo | `docs/AGENTS.md` |
| 4.3 | Resolver system_map_mismatch (8 instâncias) | Docs | Baixo | `SYSTEM_MAP.md` |
| 4.4 | Limpar context_buffer.yaml (140→50 linhas) | Governança | Baixo | `governance/context/context_buffer.yaml` |
| 4.5 | Corrigir script_wiring (4 scripts em falta) | Infra | Baixo | `package.json` |
| 4.6 | Criar .gitignore em shitenno-go/ | Infra | Baixo | `shitenno-go/.gitignore` |
| 4.7 | Corrigir report_naming conventions | Governança | Baixo | `shitenno-go/reports/` |

**Critérios de conclusão:** 0 broken_ref, 0 dead_rule, buffer <50 linhas

---

### Fase 5 — Segurança e Validação (P4)

| # | Item | Tipo | Esforço | Ficheiros |
|---|---|---|---|---|
| 5.1 | Adicionar schema validation para JSON.parse (67 instâncias) | Segurança | Alto | Todo o codebase |
| 5.2 | Adicionar validação de inputs em execSync calls | Segurança | Médio | `src/commands/reminders.ts` |
| 5.3 | Auditar dependências para vulnerabilidades | Segurança | Baixo | `package.json`, `pnpm-lock.yaml` |

**Critérios de conclusão:** 0 unsafe_deserialize, 0 tainted_input

---

### Fase 6 — Cobertura de Testes (P5)

| # | Item | Tipo | Esforço | Ficheiros |
|---|---|---|---|---|
| 6.1 | Adicionar testes para 147 módulos sem cobertura | Qualidade | Muito Alto | Diversos |
| 6.2 | Adicionar testes para módulos críticos (daemon, plan-engine, etc.) | Qualidade | Alto | Módulos core |

**Critérios de conclusão:** Cobertura >80% nos módulos críticos

---

## Priorização Recomendada

```
Fase 1 (Críticas)  ──────────────────────────────►  Semana 1
Fase 2 (Complexidade) ─────────────────────────────►  Semanas 2-3
Fase 3 (Limpeza) ─────────────────────────────────►  Semanas 3-4
Fase 4 (Docs) ────────────────────────────────────►  Semana 4
Fase 5 (Segurança) ───────────────────────────────►  Semanas 4-5
Fase 6 (Testes) ──────────────────────────────────►  Contínuo
```

---

## Métricas de Sucesso

### Marco Intermédio (após Fase 1-2)
| Métrica | Actual | Target |
|---|---|---|
| Health Score | 59/100 | >70/100 |
| Critical issues | 35 | 0 |
| Warnings | 169 | <100 |

### Marco Final (após Fase 3-6)
| Métrica | Actual | Target |
|---|---|---|
| Health Score | 59/100 | >80/100 |
| Critical issues | 35 | 0 |
| Warnings | 169 | <30 |
| Empty catch blocks | 55 | 0 |
| God functions | 36 | 0 |
| High complexity | 49 | <5 |
| Broken references | 23 | 0 |
| Unused exports | 399 | <100 |

---

## Checklist de Validação

- [ ] `shiten audit --level enterprise` → score >80
- [ ] 0 critical issues
- [ ] <30 warnings
- [ ] `pnpm run lint` → 0 erros
- [ ] `pnpm run typecheck` → 0 erros
- [ ] `pnpm test` → todos passam
