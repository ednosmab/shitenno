---
category: reference
lifecycle: Historical
---

# Plano Unificado: Auditoria + Dualidade Adaptativa

## Visão

Executar **Auditoria Completa** primeiro (qualidade de código), depois **Dualidade Adaptativa** por cima (nova feature). Total: ~18h de trabalho, 7 commits.

## Ordem de Execução

```
┌─────────────────────────────────────────────────────────┐
│  FASE A: AUDITORIA (6 passos)                          │
│  ─────────────────────────────────────────────────────  │
│  1. Segurança Crítica (P0)           → fix: security   │
│  2. Type Safety & Error Handling (P1) → fix: types     │
│  3. Deduplication & Shared Code (P1) → refactor: dedup │
│  4. Build Config & TypeScript (P2)   → chore: build    │
│  5. Test Coverage (P2)               → test: coverage  │
│  6. Documentation & Cleanup (P3)     → docs: cleanup   │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FASE B: DUALIDADE (feature nova)                      │
│  ─────────────────────────────────────────────────────  │
│  7. Sistema Adaptativo de Dualidade  → feat: dual-path │
└─────────────────────────────────────────────────────────┘
```

## Ficheiros Comuns (sem conflito)

Ambos os planos modificam 6 ficheiros, mas em aspectos diferentes:
- `src/feedback-loops.ts` — Auditoria: schema validation | Dualidade: pathChoice
- `src/auto-evolution.ts` — Auditoria: type safety | Dualidade: dual paths
- `src/commands/evolve.ts` — Auditoria: exit codes | Dualidade: dual paths
- `src/commands/audit.ts` — Auditoria: type safety | Dualidade: dual paths
- `src/commands/status.ts` — Auditoria: error handling | Dualidade: dual paths
- `src/commands/detect.ts` — Auditoria: error handling | Dualidade: dual paths

## Verificação Pós-Cada Passo

```bash
npm run typecheck    # 0 erros
npm run build        # Compila OK
npm test             # Todos passam
```

## Critérios de Sucesso Final

- [ ] Segurança: run_local_script, sanitização, ReDoS protection
- [ ] Types: PipelineContext generics, schema validation
- [ ] Dedup: dimension labels, banners, health score
- [ ] Build: NodeNext, skipLibCheck, tsup.config.ts
- [ ] Testes: 226+ passam, novos módulos testados
- [ ] Docs: BACKLOG, CHANGELOG actualizados
- [ ] Dualidade: growth-profile, challenge-generator, dual-path-presenter
- [ ] Dualidade: visível em evolve, audit, status, detect
- [ ] Dualidade: adapta a cada ~10 escolhas
- [ ] Dualidade: desafio inclui gap OU mudança de paradigma
