# PIPELINE TEMPLATE — Phase 3 — Performance

> Template de validação da Fase 3 (Performance). Contadores indicam a divisão
> esperada entre verificações humanas e do agente. Copiar para
> `.shitenno/docs/pipelines/phase3.md` e ajustar ao projecto.

---

## Contadores Humano/Agente

| Tipo | Contador | Descrição |
|---|---|---|
| 🤖 Agente | 3 | Verificações automáticas (testes, lint, typecheck) |
| 🧑 Humano | 3 | Análise do script de carga, revisão de benchmark e decisão de avanço |
| **Total** | **6** | Rácio agente:humano = 1:1 |

## Gates de Agente (automáticos)

- [ ] `pnpm run test:unit` — testes unitários a passar
- [ ] `pnpm run lint` — lint limpo
- [ ] `pnpm run typecheck` — type-check limpo

## Gates de Humano (manuais)

- [ ] Script de carga (`test:load`) executado e limiar de latência respeitado
- [ ] Benchmarks revistos contra a linha de base
- [ ] Decisão registada: pipeline concluído ou correcção agendada

## Critérios de Saída

- 3/3 gates de agente PASSED
- 3/3 gates de humano concluídos
- Reporte persistido em `.shitenno/reports/pipeline-history.json`
