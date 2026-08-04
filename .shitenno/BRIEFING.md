# Pre-Session Briefing
*Generated: 2026-08-04T03:55:08.527Z*

---

## QUICK BOARD — Estado do Projecto

> **Apresentar este quadro ao utilizador antes da primeira resposta operacional.**
> Veja regra #13 em `docs/AGENTS.md` (QUICK BOARD DE AVISO).

| Campo | Estado |
|---|---|
| **Tarefa em curso** | Nenhuma |
| **Próximo P0** | Definir novo P0 no BACKLOG.md |
| **Dívidas P1** | Nenhuma |
| **Impedimentos** | Nenhum |
| **Estado última sessão** | Desconhecido |

---

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
- [high] This project has 159 force push(es) in the last 180 days. Avoid "git push --force" — use --force-with-lease instead.
- [medium] This project has 8 hotfix(es) in the last 180 days. Consider adding more pre-merge validation.


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
