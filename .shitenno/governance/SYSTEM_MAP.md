# SYSTEM_MAP — Mapa Centralizado

> **Versão:** 2.1
> **Data:** 2026-07-02
> **Propósito:** Mapa de todos os directórios e arquivos do sistema

---

## Legenda de Capacidades

| Símbolo | Significado |
|---|---|
| ✅ | Capacidade instalada e activa |
| 📋 | Capacidade disponível (pode ser instalada via `shugo upgrade`) |
| 🔮 | Capacidade futura (não disponível ainda) |
| ➖ | Não aplicável |

**Verificar capacidades instaladas:** `shugo status` ou `shugo doctor`
**Instalar capacidade:** `shugo upgrade --capability <name>`

---

## Estrutura Geral

> A árvore completa de directórios foi movida para [`SYSTEM_MAP_TREE.md`](SYSTEM_MAP_TREE.md) 
> (auto-gerada por `sync:docs`, ~3400 linhas). Este ficheiro contém apenas a estrutura legível 
> para humanos.

```
│   .shitenno/                    ← Governance, regras, planos, contexto
│   src/                          ← Código fonte TypeScript
│   docs/                         ← Documentação do projecto
│   scripts/                      ← Scripts de build e validação
│   plugins/                      ← Plugins de extensão
│   .husky/                       ← Git hooks
```

---

## Regras de Leitura

### Ordem Obrigatória

```
1. governance/WORKFLOW.md                    ← SEMPRE PRIMEIRO
2. governance/context/context_buffer.yaml   ← SEMPRE
3. docs/AGENTS.md                           ← SEMPRE (P0)
4. docs/FORBIDDEN_OPERATIONS.md             ← SEMPRE (P0)
5. docs/DESDO.md                            ← SEMPRE (P0)
6. Skill específica da camada               ← POR TAREFA
7. Plano da camada                          ← POR TAREFA
```

### Hierarquia P0-P4

| Nível | Conteúdo | Quando |
|---|---|---|
| **P0** | AGENTS.md, FORBIDDEN_OPERATIONS, DESDO | Sempre |
| **P1** | context_buffer.yaml | Sempre |
| **P2** | Planos da camada | Por tarefa |
| **P3** | Código e arquivos | Na execução |
| **P4** | docs/history/ | Sob demanda |

---

## Mapa de Scripts

| Script | Caminho | Função |
|---|---|---|
| validate-session | `scripts/validate-session.ts` | Validar integridade da sessão |
| close-session | `scripts/close-session.ts` | Encerrar sessão |
| premortem-check | `scripts/premortem-check.ts` | Análise de riscos |
| sync-docs | `scripts/sync-docs.ts` | Sincronizar documentação com estado real |

---

## Mapa de Contratos

| Contrato | Caminho | Função |
|---|---|---|
| planner | `governance/agents/AI-CONTRACT-planner-v1.yaml` | Planejamento |
| executor | `governance/agents/AI-CONTRACT-executor-v1.yaml` | Execução |
| reviewer | `governance/agents/AI-CONTRACT-reviewer-v1.yaml` | Review/auditoria |
| orchestrator | `governance/agents/AI-CONTRACT-orchestrator-v1.yaml` | Orquestração |
| CONTRACTS_INDEX | `governance/contracts/CONTRACTS_INDEX.md` | Índice |

---

## Ficheiros Raiz

| Ficheiro | Propósito |
|---|---|
| `fingerprint.json` | Impressão digital do projecto (hash, stack, maturidade) |
| `maturity-profile.json` | Perfil de maturidade por dimensão |

---

## Referências por Categoria

### Documentação Conceptual

| Ficheiro | Descrição |
|---|---|
| `docs/CONCEPTUAL_MODEL.md` | Modelo conceitual canónico do Shugo |
| `docs/KNOWLEDGE_LIFECYCLE.md` | Ciclo de vida do conhecimento (9 estágios) |
| `docs/opencode-context.md` | Contexto operacional para o agente |

### Telemetria e Feedback

| Ficheiro | Descrição |
|---|---|
| `feedback/summary.json` | Resumo de interações de recomendações |
| `feedback/records/*.json` | Registos individuais de feedback |
| `telemetry/maturity-2026-06-30.json` | Snapshot de maturidade |

### Relatórios

| Ficheiro | Descrição |
|---|---|
| `reports/complexity-*.json` | Relatórios de scoring de complexidade |
| `reports/health-*.json` | Relatórios de saúde do projecto |

---

## Referências Principais

- `governance/WORKFLOW.md` — Fluxos de sessão
- `docs/AGENTS.md` — Regras do time
- `docs/Shitenno_GUIDE.md` — Guia completo do sistema
- `docs/CONCEPTUAL_MODEL.md` — Modelo conceitual
- `docs/KNOWLEDGE_LIFECYCLE.md` — Ciclo de vida do conhecimento
