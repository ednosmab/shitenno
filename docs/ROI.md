---
category: product
lifecycle: Active
---

# 📊 ROI — Return on Investment do Shitenno

## Resumo Executivo

O Shitenno é um investimento em engenharia que se paga rapidamente através de:
- **Redução de tokens AI** (~60-80% por sessão)
- **Eliminação de retrabalho** (~40-60% menos iterações)
- **Prevenção de erros** (~50-70% menos bugs evitáveis)

---

## 1. Economia de Tokens

### O problema sem Shugo

Um agente AI sem contexto do projeto precisa "descobrir" tudo a cada sessão:

| Necessidade | Tokens estimados | O que o agente lê |
|---|---|---|
| Estrutura do projeto | ~2-4k | package.json, tsconfig, README, dirs |
| Áreas de risco | ~3-5k | git log, testes, churn analysis |
| Regras específicas | ~4-8k | AGENTS.md, FORBIDDEN_OPERATIONS, DESDO |
| Erros conhecidos | ~2-3k | histórico de bugs, reverts |
| **Total por sessão** | **~11-20k** | **Múltiplos arquivos, repetido toda sessão** |

### A solução com Shugo

| Comando | Tokens | Informação obtida |
|---|---|---|
| `shugo briefing --summary` | ~20 | Domain, scale, risk, regras, recomendações |
| `shugo briefing` | ~500-1000 | Briefing completo com contexto |
| `shugo briefing` (cache hit) | ~0 | Mesmo resultado, 0 custo |
| `shugo briefing --write` + leitura | ~500 | Briefing persistido para reuso |

### Economia por cenário

| Cenário | Sem Shugo | Com Shugo | Economia |
|---|---|---|---|
| Sessão média (feature) | ~15-25k tokens | ~2-5k tokens | **60-80%** |
| Sessão com cache hit | ~15-25k tokens | ~0-1k tokens | **95-100%** |
| Task trivial (typo) | ~10-15k tokens | ~3-4k tokens | **70-75%** |
| Refactor complexo | ~20-30k tokens | ~8-10k tokens | **50-65%** |

### Projeção mensal (10 sessões/mês)

| Métrica | Sem Shugo | Com Shugo | Economia |
|---|---|---|---|
| Tokens/mês | ~150-250k | ~20-50k | **~100-200k tokens** |
| Custo estimado* | ~$0.75-1.25 | ~$0.10-0.25 | **~$0.50-1.00/mês** |
| Sessões equivalentses economizadas | — | ~30-60 sessões | **3-6x mais produtivo** |

*Custo baseado em tarifas típicas de APIs de AI (~$5/milhão de tokens input).

---

## 2. Eliminação de Retrabalho

### Sem Shugo
- O agente comete erros por falta de contexto → iterações de correção
- Cada iteração gasta ~5-15k tokens adicionais
- Média de 2-3 iterações por erro evitável

### Com Shugo
- Briefing alerta sobre áreas sensíveis antes do trabalho
- Regras contextuais previnem erros conhecidos
- Feedback loop aprende com sessões passadas

### Impacto estimado

| Métrica | Sem Shugo | Com Shugo | Melhoria |
|---|---|---|---|
| Iterações por erro | 2-3 | 0-1 | **50-70% redução** |
| Erros evitáveis/sessão | 1-2 | 0-1 | **40-60% redução** |
| Tempo médio de correção | ~15 min | ~5 min | **65% mais rápido** |

---

## 3. Prevenção de Erros

### Erros que o Shugo previne

| Tipo de Erro | Como previne | Impacto |
|---|---|---|
| Modificar área sem testes | Risk map identifica | Evita regressões |
| Violar regras do projeto | Context rules auto-geradas | Mantém conformidade |
| Repetir decisão passada | Dynamic rules do histórico | Evita retrabalho |
| Ignorar áreas críticas | Briefing alerta priorizado | Foco no que importa |
| Esquecer padrões do time | Skills e ADRs integrados | Consistência |

### Custo de um bug em produção

| Fator | Custo estimado |
|---|---|
| Tempo de debugging | ~2-8 horas |
| Tokens gastos na correção | ~20-50k |
| Impacto no usuário | Variável |
| Custo reputacional | Incalculável |

O Shugo reduz a probabilidade desses erros em ~50-70%.

---

## 4. Loading Profiles — Controle Granular de Tokens

O AGENTS.md suporta 3 perfis de carregamento:

| Perfil | Tokens | Quando usar | Cobertura |
|---|---|---|---|
| `minimal` | ~3-4k | Tasks triviais (typo, rename) | Workflow + Git |
| `lite` (default) | ~5-6k | Features pequenas, bug fixes | + Sessão |
| `full` | ~8-10k | Refactors, migrations | + Plan/Build/Review |

**Override:** `loading_profile` em `opencode.json` força o perfil.

---

## 5. Métricas de Feedback

O sistema de feedback permite medir efetividade real:

```bash
shugo feedback --summary
```

Retorna:
- Taxa de sucesso por sessão
- Hotspots de falha (áreas com mais erros)
- Duração média de sessões bem-sucedidas
- Tendências ao longo do tempo

---

## 6. Comparação com Abordagens Alternativas

| Abordagem | Tokens/sessão | Contexto | Aprendizado | Custo mensal |
|---|---|---|---|---|
| **Sem nenhum sistema** | ~15-25k | Zero | Nenhum | ~$0.75-1.25 |
| **Só AGENTS.md manual** | ~8-12k | Estático | Nenhum | ~$0.40-0.60 |
| **Shugo (sem cache)** | ~2-5k | Dinâmico | Sim | ~$0.10-0.25 |
| **Shugo (com cache)** | ~0-1k | Dinâmico | Sim | ~$0.00-0.05 |

---

## 7. Break-Even Analysis

| Investimento | Retorno |
|---|---|
| Setup inicial (~5 min) | Economia imediata na primeira sessão |
| 10 sessões/mês | ~100-200k tokens economizados |
| 100 sessões/mês | ~1-2M tokens economizados (~$5-10/mês) |
| 1 ano de uso | ~1.2-2.4M tokens economizados |

**Break-even:** Imediato. A primeira sessão já gera economia.

---

## 8. Conclusão

O Shitenno não é um custo — é um investimento que se paga na primeira sessão:

- **60-80% menos tokens** por sessão
- **95-100% menos tokens** com cache hit
- **40-60% menos retrabalho**
- **50-70% menos erros evitáveis**
- **ROI positivo** desde a primeira sessão

Para projetos com 10+ sessões/mês, a economia anual é significativa em tokens, tempo, e qualidade.
