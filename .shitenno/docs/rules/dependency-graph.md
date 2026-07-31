---
category: engineering
lifecycle: Active
---

# Dependency Graph — Regras de Dependências

> **Gatilho:** loading_profile=full, dependência circular detectada, nova dependência adicionada

## Grafo de Dependências das Regras

As regras não são todas do mesmo nível. Existem três camadas de dependência:

```
       ┌───────────────────────────┐
       │  Camada 1: Workflow (1-11) │  ← sempre carregada
       │  (git, sessão, TDD)        │
       └────────────┬──────────────┘
                    │ activa o modo activo
                    ▼
       ┌───────────────────────────┐
       │  Camada 2: Mode (12-16)    │  ← carregada se loading_profile=full
       │  review → plan → build     │
       └────────────┬──────────────┘
                    │ fecha o ciclo
                    ▼
       ┌───────────────────────────┐
       │  Camada 3: Reflection (17) │  ← carregada só em fim-de-sessão
       │  feedback de desempenho   │
       └────────────┬──────────────┘
                    │
                    ▼
       ┌───────────────────────────┐
       │  Camada 4: Meta (18-22)    │  ← sempre carregada
       │  evidência, métricas, etc │
       └───────────────────────────┘
```

## Cadeia Operacional

1. **Review** (#12) valida que um plano anterior foi executado conforme spec.
2. **Plan** (#15) gera o plano atómico que o **Build** (#16) vai executar.
3. **Build** (#16) executa o plano literal e atalha o ciclo em direção ao próximo Review.

## Regras com Dependência Implícita

- #16 (build) pressupõe que #15 (plan) já foi cumprido — não executar build sem plan aprovado.
- #15 (plan) pressupõe que #12 (review) já fechou o ciclo anterior — não planear sem antes auditar o que ficou pendente.
- #17 (feedback) é o único disparado por sinal externo (keywords de fim-de-sessão), não por estado do código.
