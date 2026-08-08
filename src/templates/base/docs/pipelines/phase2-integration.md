# PIPELINE TEMPLATE — Phase 2 — Integration

> Template de validação da Fase 2 (Integration). Contadores indicam a divisão
> esperada entre verificações humanas e do agente. Copiar para
> `.shitenno/docs/pipelines/phase2.md` e ajustar ao projecto.

---

## Contadores Humano/Agente

| Tipo | Contador | Descrição |
|---|---|---|
| 🤖 Agente | 3 | Verificações automáticas (testes, lint, typecheck) |
| 🧑 Humano | 3 | Revisão do cenário e2e, smoke manual e decisão de avanço |
| **Total** | **6** | Rácio agente:humano = 1:1 |

## Gates de Agente (automáticos)

- [ ] `pnpm run test:unit` — testes unitários a passar
- [ ] `pnpm run lint` — lint limpo
- [ ] `pnpm run typecheck` — type-check limpo

## Gates de Humano (manuais)

- [ ] Cenário e2e executado e observado sem regressão
- [ ] Smoke test manual no fluxo principal
- [ ] Decisão registada: avançar para a Fase 3 ou corrigir

## Critérios de Saída

- 3/3 gates de agente PASSED
- 3/3 gates de humano concluídos
- Reporte persistido em `.shitenno/reports/pipeline-history.json`
