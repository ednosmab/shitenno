# Pre-Session Briefing
*Generated: 2026-07-31T14:24:44.902Z*

---

## QUICK BOARD — Estado do Projecto

> **Apresentar este quadro ao utilizador antes da primeira resposta operacional.**
> Veja regra #13 em `docs/AGENTS.md` (QUICK BOARD DE AVISO).

| Campo | Estado |
|---|---|
| **Tarefa em curso** | LIVING-007 LIVING-007 Sistema de Pipelines de Validação (In Progress) |
| **Próximo P0** | SA7 — God modules refactoring (rule-engine 1307L, scorer 947L, engineering-state 908L, feedback-engine 756L). No P0 items exist; SA7 is highest-impact P1. |
| **Dívidas P1** | Nenhuma |
| **Impedimentos** | Retroactive sync failed for TEST-FILE-WATCHER-001: 2 errors |
| **Estado última sessão** | Em curso |

---

## Active Reminders

- 🔴 **HIGH** — Path .shitenno: MCP local-filesystem filtra dot-prefs. Usar MCP shitenno para governance/plans. [mcp]
- 🟡 **MEDIUM** — Revisar handbook — AI preencheu dados semânticos. Editar partes filosóficas. [docs]

## Project Identity
- **Domain:** monorepo
- **Scale:** large
- **Stack:** typescript, node, react
- **Maturity:** 73/100

## Risk Status
- **Overall:** critical
- **Critical:** src, apps

## Test Coverage
- **Has Tests:** Yes
- **Areas Without Tests:** 5

## Context Rules (Top)
- Area "src" contains sensitive keywords (auth, payment, security). Apply extra security review.
- Area "apps" has 8 file(s) without tests. Prioritize test coverage here.
- Area "apps" contains sensitive keywords (auth, payment, security). Apply extra security review.
- This is a monorepo. When modifying shared packages, ensure backward compatibility.
- Large codebase: Always run tests before committing. Consider impact on other modules.

## Dynamic Rules (From History)
- [high] This project has 153 force push(es) in the last 180 days. Avoid "git push --force" — use --force-with-lease instead.
- [medium] This project has 7 hotfix(es) in the last 180 days. Consider adding more pre-merge validation.


## Daemon Status
- **Running:** No

## Recommended Next Steps
1. Address critical risk areas: src, apps
1. Improve test coverage in 5 area(s)

## Token Economy
- **Estimated tokens saved:** ~11.600
- **Context rules:** 7
- **Dynamic rules:** 2
- **Cache hit:** No

## Semantic Analysis
### Patterns (1)
- **30 alterações vs 0 melhorias de qualidade**
  - Domain: governance | Type: tech_debt_accumulation | Confidence: 85%
  - → Dedicar tempo a testes e documentação
  - → Rever dívida técnica acumulada
### Insights (1)
- **Dívida técnica a acumular — padrões de degradação detectados** (medium)
  - Domains: testing, documentation
  - → Dedicar sprint de qualidade
  - → Rever e actualizar documentação
