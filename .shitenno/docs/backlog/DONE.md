---
category: engineering
lifecycle: Active
---

## Done

| Item | Severidade | Resolucao |
|---|---|---|
| Renomear "shitenno-governance" → "shitenno" | Critico | package.json, init.ts, audit.ts |
| Executar Plano Estrategico (10 pilares) | Alto | conceptual model, knowledge lifecycle, capabilities, etc. |
| Comando `evolve` com dual-path | Alto | src/commands/evolve.ts |
| Comando `run` (pipeline) | Alto | src/commands/run.ts |
| Auto-evolution com feedback | Alto | src/auto-evolution.ts |
| Dual-path presenter | Alto | src/dual-path-presenter.ts |
| Challenge generator | Alto | src/challenge-generator.ts |
| Growth profile | Alto | src/growth-profile.ts |
| Event bus com 10 tipos novos | Alto | src/event-bus.ts |
| Seguranca no rule-engine | Critico | Allowlist em execSync, sanitizacao |
| Atomic writes no cache | Medio | writeCache() usa tmp + renameSync |
| Coverage configurado com thresholds | Alto | vitest.config.ts com @vitest/coverage-v8 |
| Context Pipeline completo | Alto | collectContext(), briefing-cache, session-feedback |
| Comando `feedback` | Alto | shugo feedback --outcome success/failure/partial |
| Comando `bench` | Medio | shugo bench — token benchmark automatizado |
| Comando `dashboard` | Medio | shugo dashboard — token economy metrics |
| Token optimizer | Medio | suggestDepth, compressedSummary, differentialBriefing |
| P0 0.1: Remover auto-feedback briefing | Alto | Removido recordOutcome() automatico |
| P0 0.2: Padrao redundante eliminado | Alto | enrichBriefingWithPatterns() aceita patternReport opcional |
| P0 0.3: Dead code briefing.ts | Medio | Removido displayBriefing() |
| P0 0.4: Dead code dashboard.ts | Baixo | Removido trendArrow() |
| P0 0.5: Simplificar getLatestFeedback | Baixo | Refatorado para records.at(-1) ?? null |
| 1.12 Coverage gap: comandos CLI | Alto | 36 novos testes (580 total) |
| Auto-backlog feature | Alto | shugo audit --auto-backlog |
| AUDIT-EXPANSION AUDIT-EXPANSION | Alto | Expandir audit coverage 79% → ~93% |
| SA1 SA1 | Critico | governance/WORKFLOW.md criado |
| SA6 SA6 | Alto | Artefactos orfaos conectados via SYSTEM_MAP.md |
| BACKLOG-0.7 BACKLOG-0.7 | Critico | Actualizar documentacao desactualizada (6 ficheiros) |
| SA2 SA2 | Critico | Resolvido import de node:fs em digest.ts |
| AUDIT-CLEANUP-01 a 05 | Baixo | Varias limpezas de codigo |
| DESOPLAMENTO A.1-A.4 | Critico | Desacoplamento de opencode.json |
| DESOPLAMENTO A.5 | Alto | MCP multi-formato |
| DESOPLAMENTO B.1-B.7 | Alto | Varias correccoes de estabilidade |
| MCP-SERVER MCP-SERVER | Alto | Servidor MCP com 3 tools |
| SA3 SA3 | Critico | Governance 0% resolvido |
| SA5 SA5 | Alto | 4 ADRs criados |
| SA8 SA8 | Alto | context_buffer.yaml movido para core |
| SA9 SA9 | Alto | 4 agent contracts |
| 2.5 2.5 | Medio | context-collector desacoplado |
| 2.2a 2.2a | Medio | Feedback CLI flags + testes |
| 2.10 2.10 | Medio | AGENTS.md template actualizado |
| 2.18 2.18 | Medio | Dashboard cliques do mouse funcionais |
| 3.5 3.5 | Baixo | Plugin system com hooks |
| 3.29 3.29 | Medio | Session-tracker append-only |
| 2.1 2.1 | Medio | shugo detect --approve/--reject |
| 2.3 2.3 | Baixo | shugo bench --compare |
| 2.4 2.4 | Baixo | shugo feedback --list |
| 2.12 2.12 | Baixo | JSDoc nas funcoes novas (parcial) |
| 2.13 2.13 | Medio | Consolidar planos |
| 2.17 2.17 | Baixo | Benchmark suite automatizada CI |
| S2 S2 | Alto | Dependency auditing no CI |
| A1 MCP server | Alto | Adicionadas 4 ferramentas (getEngineeringState, getBacklog, getPlans, submitFeedback) e integrado com o lifecycle |
| Address critical knowledge debt (3+ gaps detected) | 🟡 Médio | Backlog |
| Address critical knowledge debt (3+ gaps detected) | 🟡 Médio | Backlog |
| Address critical knowledge debt (3+ gaps detected) | 🟡 Médio | Backlog |
| SA3 Governanca 0% | Critico | Dimensao Governance do score de maturidade esta em 0%. Nenhuma pratica de governanca formalizada no codigo. |
| LIVING-001 Fase 1 — Cache cross-process | Alto | Modificar `getEngineeringState()` para ler `engineering-state.json` do disco com verificação de frescor antes de recalcular. Manter `forceRefresh` como kill-switch. Adicionar benchmark novo (consolidação fria vs cache cross-process) nos 3 tamanhos de fixture. |
| BUG-001 Corrigir `shugo detect --auto` | Medio | `.husky/post-commit` executa `shugo detect --auto 2>/dev/null &` mas `detect.ts` não define opção `--auto`. Commander.js rejeita opção desconhecida. Hook falha silenciosamente a cada commit (stderr redirigido para /dev/null). |
| SA5 Documentacao 10% | Alto | Dimensao Documentation do score de maturidade esta em 10%. Docs internos fracos, sem ADRs, sem session templates. |
| SA8 context_buffer.yaml nao encontrado | Alto | Arquivo context_buffer.yaml nao encontrado. Necessario para buffer de contexto entre sessoes. |
| SA9 Nenhum agent contract configurado | Alto | Nenhum agent contract encontrado. Necessario para definir papeis e responsabilidades de agents IA. |
| LIVING-002 Fase 2 — Git hooks reactivos | Alto | Criar `checkAndArchiveDonePlans()` que percorre `governance/plans/*.md`, identifica planos com `Status: Done` ainda não arquivados, chama `archiveIfDone()`. Ligar ao modo `--auto` do `detect`. Criar instalador Husky (append a post-commit, cria post-merge). |
| LIVING-003 Fase 3 — Daemon opt-in | Alto | Daemon opt-in com socket IPC (chmod 0600), handshake de versão, circuit breaker de crash loop, `SHITENNO_NO_DAEMON=1` + `CI=true`, auto-start só após validação manual. Reaproveita `checkAndArchiveDonePlans()` da Fase 2 em modo contínuo via chokidar. |
| LIVING-004 Problemas de memória — Bounded collections | Alto | Limitar collections em memória: sliding window 10K eventos (`EventSourcedState`), cap 500 (`DeadLetterQueue`), últimas 50 transições (`CapabilityLifecycleTracker`), cap 10K + LRU (`EventReplayer`), auto-drain (`IncrementalConsolidator`), TTL 1h (`ChangeHistoryTracker`), LRU + TTL (`data-collector`). |
| S2 Dependency auditing | Alto | `npm audit` automatico no CI. Bloquear builds com vulnerabilidades criticas. |
| 2.1 Aprovacao de regras candidatas | Medio | `detectPatterns()` gera `candidateRules` com status "proposed" mas nao existe mecanismo para aprovar/rejeitar. |
| 2.3 shugo bench --compare historico | Baixo | Benchmark mostra resultados atuais mas nao compara com execucoes anteriores. |
| 2.4 shugo feedback --list | Baixo | Nao existe forma de ver os registros de feedback sem usar `--summary`. |
| 2.12 JSDoc nas funcoes novas | Baixo | Funcoes como `enrichBriefingWithPatterns`, `getFeedbackForSession`, etc. sem JSDoc. |
| 2.13 Consolidar planos de plans/ | Medio | 11 arquivos de plano com massiva sobreposicao. |
| 2.17 Benchmark suite automatizada CI | Baixo | O benchmark existe mas nao roda no CI. |
| Done — Tabela Resumo |  | Concluído |
| Plano de Correção Auditoria Completa — Done (2026-07-10) |  | Concluído |
| BACKLOG-2026_07_02_SHITENNO_DASHBOARD_RESTRUCTURE — Shitenno Dashboard — Plano de Refactoracao por Camadas de Conhecimento |  | Concluído |
| BACKLOG-2026_07_11_SHITENNO_LIVING_PLANO_V2_3FASES — Shitenno Living — Plano de Implementação (v2 — Roteiro em 3 Camadas) |  | Concluído |
| BACKLOG-2026_07_12_PLANO_FIX_RETROACTIVE_SCAN_RACE — Plano — Corrigir Race Condition no Retroactive Scan (`plan-backlog-sync.ts`) |  | Concluído |
| BACKLOG-2026_07_12_BACKLOG_BATCH_RESOLVER — Plano — Resolver Backlog em Lote (Itens sem Dependência Humana) |  | Concluído |
| BACKLOG-2026_07_12_PLANO_CORRECAO_WATCH_LOOP_E_FASE2 — Plano de Correção — Loop do `shugo watch` + Finalizar Fase 2 (LIVING-002) |  | Concluído |
| BACKLOG-2026_07_13_PLANO_BUG002_ENTROPIA — Plano Consolidado — Shugo Living: BUG-002 (fim-a-fim), Redesenho da Entropia, Item Futuro |  | Concluído |
| BACKLOG-2026_07_12_MIGRAR_CONSOLE_LOG_PARA_LOGGER — Plano — Migrar console.log para Logger Centralizado (3.1) |  | Concluído |
| BACKLOG-PLAN_DOC_SEMANTIC_SYNC — PLANO — Doc Semantic Sync (drift semântico → reminder → AI) |  | Concluído |
| BACKLOG-2026_07_13_REFACTOR_ESTRUTURAL_SA4_SA10_SA11 — Plano de Refactor Estrutural — SA4 / SA10 / SA11 |  | Concluído |
| BACKLOG-PLANO_MONETIZACAO_SHITENNO — Plano de Monetização — shitenno (Free + Token Mensal) |  | Concluído |
| BACKLOG-PLAN_MONETTIZATION_IMPLEMENTATION — Plano de Implementação — Monetização Shugo CLI |  | Concluído |
| BACKLOG-2026_07_15_MONOLITH_REFACTOR_PREVENTION — Plano: Monolith Refactor + Architectural Prevention |  | Concluído |
| BACKLOG-PLANO_MELHORIA_MECANISMO_CONTEXTO — Plano: Melhorar o Mecanismo de Medição de Contexto (P0-P4) |  | Concluído |
| BACKLOG-2026_07_15_DAEMON_STARTUP_SCAN — Daemon Startup Scan — Funções Proativas |  | Concluído |
| BACKLOG-HANDOFF_AGENTE — Handoff para o agente — shitenno |  | Concluído |
| BACKLOG-PLANO_DAEMON_KERNEL — Plano: transformar o daemon no kernel do shitenno |  | Concluído |
| BACKLOG-MIGRACAO_YAML_FRONTMATTER — Plano: migrar o formato de status dos planos para frontmatter YAML |  | Concluído |
| BACKLOG-AUDIT_IMPROVEMENT_PLAN_2026_07_16 — Plano de Melhorias pós-Auditoria Enterprise |  | Concluído |
| BACKLOG-2026_07_16_AUDIT_IMPROVEMENT_PLAN — Plano de Melhorias — Auditoria Enterprise (2026-07-16) |  | Concluído |
| BACKLOG-2026_07_16_AUDIT_CONFIDENCE_SUPPRESSION1 — PLAN-AUDIT-CONF — Confidence Score + Suppression Baseline no `shugo audit` |  | Concluído |
| BACKLOG-2026_07_16_AUDIT_MARKET_EDGE2 — PLAN-AUDIT-EDGE — Fechar gaps de mercado sem perder o diferencial de Governance Intelligence |  | Concluído |
| BACKLOG-PLAN_2026_07_16_DAEMON_FULL_INTEGRATION — Plano de Ação — Integração Total CLI ↔ Daemon |  | Concluído |
| BACKLOG-PLAN_2026_07_16_DAEMON_LOG_ROTATION — Plano de Ação — Rotação e Controle de Tamanho do `daemon.log` |  | Concluído |
| BACKLOG-PLAN_2026_07_16_SYSTEM_RESILIENCE_REVISADO — Plano de Ação (Revisado) — Resiliência do Sistema Shitenno |  | Concluído |
| BACKLOG-PLAN_2026_07_16_KNOWLEDGE_BRIDGE_ADR_SKILLS — Plano de Ação — Ponte de Conhecimento (ADRs + Skills) para Agentes |  | Concluído |
| BACKLOG-PLAN_2026_07_16_FOUR_ENGINE_EXECUTION_CORE — Plano de Ação — Núcleo de Execução Unificado (4 Engines) |  | Concluído |
| BACKLOG-PLAN_2026_07_16_CLI_DAEMON_AUTHORITY_ARBITRATION — Plano de Ação — Arbitragem de Autoridade entre CLI e Daemon |  | Concluído |
| BACKLOG-PLAN_2026_07_16_SECURITY_FINDINGS_REMEDIATION — Plano de Ação — Remediação de Achados de Segurança |  | Concluído |
| BACKLOG-PLAN_2026_07_16_REMEDIACAO_COMPLEMENTAR — Plano Complementar — Achados da Revisão Manual (fora do plano original) |  | Concluído |
| BACKLOG-PLAN_2026_07_17_CONSOLIDACAO_PRODUTIZACAO_MULTI_PROJETO — PLAN-2026-07-17 — Consolidação Arquitetural para Produtização Multi-Projeto |  | Concluído |
| BACKLOG-PLAN_2026_07_17_GOVERNANCA_REGRAS_MANIFESTO_ENFORCEMENT — PLAN-2026-07-17 — Governança de Regras: Rule Manifest + Injeção Posicional + Enforcement Mecânico |  | Concluído |
| BACKLOG-PLAN_2026_07_17_CONSOLIDACAO_PRODUTIZACAO_MULTI_PROJETO_COMPLEMENTAR_HIGIENE_GIT — PLAN-2026-07-17 — Consolidação Arquitetural para Produtização Multi-Projeto (Complementar: Higiene de Git para Instâncias Solo Assíncronas) |  | Concluído |
| BACKLOG-TEST_FILE_WATCHER_001 — Untitled Plan |  | Concluído |
| BACKLOG-PLAN_2026_07_17_A_CLI_LAZY_BOOTSTRAP — PLAN-2026-07-17-A — Lazy Loading do Bootstrap do CLI |  | Concluído |
| BACKLOG-PLAN_2026_07_17_B_BACKLOG_MODULAR — PLAN-2026-07-17-B — Modularização do BACKLOG.md por Status/Prioridade |  | Concluído |
| BACKLOG-PLAN_2026_07_19_BLOCO_L_REFORCO_GATE — PLAN-2026-07-19 — Bloco L: Reforço do Gate — Fechando os Últimos Caminhos de Bypass |  | Concluído |
| BACKLOG-PLAN_2026_07_19_MASTER_3_ESTRUTURA_E_COBERTURA — PLAN-2026-07-19 — MASTER 3/3: Estrutura e Cobertura de Teste |  | Concluído |
| BACKLOG-PLAN_2026_07_19_MASTER_1_INTEGRIDADE_GATE — PLAN-2026-07-19 — MASTER 1/3: Status Geral + Integridade do Gate |  | Concluído |
| BACKLOG-PLAN_2026_07_19_MASTER_2_CORRECAO_DADOS_E_CHECKS — PLAN-2026-07-19 — MASTER 2/3: Correção de Dados e Checks Genéricos |  | Concluído |
| BACKLOG-PLAN_2026_07_20_BLOCO_N_GATE_QUEBRADO_E_ACHADOS — BLOCO N — Gate de verificação quebrado + achados desta auditoria |  | Concluído |
| BACKLOG-PLAN_2026_07_20_REFACTOR_ESLINT_WARNINGS — PLAN-2026-07-20 — Refatoração de ESLint Warnings (305 → 0) |  | Concluído |
| BACKLOG-PLAN_2026_07_20_BLOCO_O_OTIMIZACAO_SUITE_TESTES — BLOCO O — Otimização da suíte de testes (e do CLI em si) |  | Concluído |
| NEW-001 NEW-001 Runtime validation shitenno/profile/ | Medio | Verificacao ja existe em guardNotInitialized() - funcionalidade implementada |
| NEW-002 NEW-002 Investigar feedback pessoal do agente | Medio | Regra #17 em feedback-protocol.md so e executada por keywords de fim de sessao |
| NEW-003 NEW-003 Corrigir sistema de feedback | Medio | Removida geracao automatica de registros deferred em assess.ts, detect.ts e doctor.ts |
| 2.2 2.2 | Medio | Feedback do utilizador implementado: --user-rating, --user-comment, --user-tags em feedback.ts |
| 2.18 2.18 | Medio | Dashboard cliques do mouse funcionais: componente tab-bar.tsx usa useOnClick de @ink-tools/ink-mouse |
| SA12 SA12 | Baixo | Knowledge graph inicializado: initializeKnowledgeGraph() em knowledge-graph.ts com 6 submodulos |
| SA13 SA13 | Baixo | 4 ADRs criados em docs/adrs/: ADR-001 a ADR-004 |
