# DESDO — Diretrizes de Engenharia

> **Versão:** 1.1
> **Data:** 2026-07-28
> **Aplicável a:** Todos os agentes IA e developers

> Regras detalhadas (SOLID, TDD, limites, segurança): `docs/engineering-standards.md`

---

## Princípio Fundamental

> **Código deve ser declarativo, simples e fácil de ler. Evitar optimizações prematuras ou sintaxes excessivamente complexas. Prefirir legibilidade à concisão.**

---

## 1. Referências

- `docs/engineering-standards.md` — Padrões de código (SOLID, TDD, limites, segurança)
- `docs/AGENTS.md` — Regras do time
- `docs/FORBIDDEN_OPERATIONS.md` — Regras vinculantes
- `docs/skills/senior-engineer.md` — Postura operacional

## 2. Mitigações Operacionais

- Antes de criar nova tabela: verificar se RLS está configurado
- Antes de commit: rodar `pnpm run lint` e `pnpm run test`
- Decisões arquiteturais: documentar em `docs/adrs/`

## 3. Governança

- ADRs para decisões de alto impacto (`docs/adrs/`)
- SDRs para decisões de solução (`docs/sdr/` — futuro)
- Loading profiles para optimização de tokens (ver `docs/AGENTS.md` §Loading Profiles)
