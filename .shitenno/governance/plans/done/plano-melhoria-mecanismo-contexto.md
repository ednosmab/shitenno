# Plano: Melhorar o Mecanismo de Medição de Contexto (P0-P4)

**Status:** In Progress
*.**Updated_at:** 2026-07-21T15:11:11.043Z
**Date:** 2026-07-15

## Resumo da Implementação

### Itens Concluídos

- [x] **Item 1:** Log de "context miss" — adicionados event types `context.p4_loaded`, `context.tier_mismatch`, `plan.inconsistency_detected` ao `ShitenEventType` em `event-bus.ts`
- [x] **Item 1:** Publish call em `context-collector.ts` para P4 doc loading
- [x] **Item 2:** Criado `src/context-index-builder.ts` para P4 compressed index com escape YAML
- [x] **Item 3:** Criado `src/audit/context-tier-detectors.ts` para detecção de promoção de tier com helper compartilhado
- [x] **Item 4:** Criado `src/templates/governance/reviews/SESSION_REVIEW.md` com secção de Cobertura de Contexto
- [x] **Item 5:** Criado `src/governance/buffer-checkpoint.ts` para mecanismo de checkpoint
- [x] Adicionado `tier_promotion_candidate` ao `HealthIssueType` em `src/audit/types.ts`
- [x] Actualizado `EVENT_VERSIONS` em `src/advanced-infrastructure.ts`

### Pendências de Integração

1. **`checkpointBuffer()` não chamado** — A função existe mas não está integrada no `governance-enforcement-detectors.ts` antes da poda existente
2. **Detectors não registados** — `detectMisclassifiedTier` e `detectTierMismatches` não estão registados no pipeline de auditoria
3. **Missing barrel exports** — Novos ficheiros não exportados de `index.ts` dos pais
4. **`context.p4_loaded` limitado** — Só publicado em `enrichBriefingWithPatterns`, não em `loadQuickBoard`
5. **`P4IndexResult` não consumido** — Interface criada mas campos não utilizados por callers

## Notas de Implementação

- Implementado com `ShitenEventType`/`shitenDir` (não `Nexus` prefix como no plano original)
- Helper `getRecentEvents` extraído para evitar loops redundantes em context-tier-detectors
- YAML escape adicionado ao context-index-builder para segurança
- Lint: 283 warnings, 0 errors
- Typecheck: 0 errors
