# PIPELINE TEMPLATE — Phase 1 — Foundation

> Template de validação da Fase 1 (Foundation). Contadores indicam a divisão
> esperada entre verificações humanas e do agente. Copiar para
> `.shitenno/docs/pipelines/phase1.md` e ajustar ao projecto.

---

## Contadores Humano/Agente

| Tipo | Contador | Descrição |
|---|---|---|
| 🤖 Agente | 4 | Verificações automáticas (testes, lint, typecheck, benchmark) |
| 🧑 Humano | 2 | Revisão manual do relatório e decisão de avanço |
| **Total** | **6** | Rácio agente:humano = 2:1 |

## Gates de Agente (automáticos)

- [ ] `pnpm run test:unit` — testes unitários a passar
- [ ] `pnpm run lint` — lint limpo
- [ ] `pnpm run typecheck` — type-check limpo
- [ ] `pnpm run bench` — benchmark sem regressão

## Gates de Humano (manuais)

- [ ] Relatório de gates revisado (summary + resultados por gate)
- [ ] Decisão registada: avançar para a Fase 2 ou corrigir

## Critérios de Saída

- 4/4 gates de agente PASSED
- 2/2 gates de humano concluídos
- Reporte persistido em `.shitenno/reports/pipeline-history.json`
