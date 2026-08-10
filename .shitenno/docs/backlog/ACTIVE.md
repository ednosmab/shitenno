---
category: engineering
lifecycle: Active
---

## Ativo

> **Total:** 49 itens (0 P0, 23 P1, 26 P2, 0 P3)

### SA4 SA4 Arquitetura 15%

| Campo | Valor |
|---|---|
| **Status** | em validação [2026-08-06 — reorganização concluída: 0 ficheiros flat, 119 movidos para camadas; scorer da dimensão corrigido] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Dimensao Architecture do score de maturidade esta em 15%. RESOLVIDO em 2 frentes: (1) 119 flat files reorganizados em src/shared (7), src/domain (24), src/application (28), src/infrastructure (52), src/interface (8); ADR-005 aprovado. (2) scoreArchitecture reescrito para medir estrutura real: docs 30pts, flatSourceFiles 20, layeredDirs 25, node-api imports fora de infra/interface 15, portsConsumed 10, monorepo/pkg 10. Resultado no repo: Arquitetura 90/100 honesto (docs+estrutura ok; 208 ficheiros ainda importam node: fora das camadas adapter — dedução principal). Suíte 192 ficheiros / 2653 testes verde. |

### SA7 SA7 Baixa densidade de relacoes no knowledge graph

| Campo | Valor |
|---|---|
| **Status** | concluído [2026-08-10 — commit 6e8aaae] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Relacao baixa entre artifacts (24 relacoes para 26 artifacts). Sugestao: adicionar mais conexoes. |
| **Conclusao** | New relation rules (runbook→script, plan→runbook, workflow→plan, doc→runbook); 205→227 relations, 0 orphans, health 100/100. Tests: +4 (2708 total). |

### LIVING-005 LIVING-005 Pipeline de validação por fases

| Campo | Valor |
|---|---|
| **Status** | em validação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Gate comum (testes+lint limpos, e2e sem regressão) + critérios específicos por fase. Benchmark novo Fase 1, cenário e2e Fase 2, script de carga Fase 3. Dogfooding no próprio repo. |

### LIVING-007 LIVING-007 Sistema de Pipelines de Validação

| Campo | Valor |
|---|---|
| **Status** | em validação [2026-08-08 — pipeline exec/status/notify + notificação desktop por fase + templates com contadores humano/agente; commit 04c02c0] |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Descricao** | Comandos independentes (plan prepare, pipeline exec/notify/status) encadeáveis via shell. Evento plan.created + RULE-020 para trigger automático. Templates de pipeline por fase com contadores humano/agente. Notificação desktop por fase. |



### G1 G1 Landing page

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Site one-page com proposta de valor, demonstracao visual, CTA para waitlist. Deve comunicar: (1) O problema (context loss entre sessoes), (2) A solucao (briefing dinamico), (3) O resultado (60-80% menos tokens). |

### G2 G2 Waitlist / early access

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Formulario de captura de emails para early access. Validar demanda antes de investir em monetizacao. |

### G3 G3 Definicao de personas

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Quem e o usuario? (1) Tech Lead que quer governance, (2) Dev Solo que quer produtividade, (3) AI Engineer que quer context para agentes. Cada persona tem dor diferente. |

### G5 G5 Pricing model concreto

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Definir tiers: Free (CLI basico), Starter ($29/mo), Team ($99/mo), Enterprise (custom). Cada tier com features claras. |

### M1 M1 Sistema de license key

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Chave de ativação por projeto. Formato: `NXS-XXXX-XXXX-XXXX`. Validacao offline com grace period. |

### M2 M2 Tier enforcement

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Limitar features por tier. Free: init, status, detect. Starter: todos. Team: + dashboard, bench. Enterprise: + SSO, compliance. |

### M3 M3 Usage tracking

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Rastrear comandos executos para billing. Metricas: comandos/mes, briefings gerados, feedback records. |

### A2 A2 OpenCode plugin

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Hook automatico antes de cada tarefa no OpenCode. Injeta briefing no contexto do agente. |

### A7 A7 Skill template para shitenno-cli

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | shitenno-cli precisa prover um template para criar novas skills. Template deve definir: frontmatter obrigatorio, estrutura de secoes, e validacao. |

### LIVING-006 LIVING-006 Mecanismo sync plano→backlog

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | O Shugo system não tem mecanismo para transformar automaticamente items de implementação de um plano (`governance/plans/*.md`) em checklists no backlog que se actualizam de acordo com a implementação por item. Actualmente, a sincronização é manual. |

### 2.2 2.2 Feedback ↔ capability-engine

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | O capability-engine recomenda instalacoes mas nao aprende com falhas. |

### 2.9 2.9 Extrair modulo shared de display

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | ~90 chamadas `console.log` com chalk repetidas em 18 arquivos de comando. |

### 2.10 2.10 Atualizar AGENTS.md template

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | O template menciona poucos comandos mas nao bench, dashboard, detect, doctor. |

### 2.11 2.11 Linkar ROI.md no README

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `docs/ROI.md` foi criado mas nao e referenciado do README.md. |

### 2.14 2.14 Documentar limitacoes conhecidas

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Nao existe documentacao de limitacoes conhecidas. |

### 2.15 2.15 Teste manual de onboarding (5 minutos)

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Validar que pessoa sem contexto consegue correr `shugo init` e entender o output sem perguntar nada. |

### 2.20 2.20 Cache intermediario no collectContext

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `collectContext()` executa todas as etapas toda vez que e chamado. |

### 2.16 2.16 Lazy loading de modulos pesados

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Todas as importacoes sao estaticas no topo do arquivo. |

### 2.19 2.19 Dashboard: responsividade do layout

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | O dashboard so e visualizado corretamente com a tela maximizada. |

### G4 G4 Analise competitiva

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Mapear Credo AI, Modulos, Govern365, Packmind. |

### G6 G6 Case studies

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | 3 casos de uso reais com metricas antes/depois. |

### M4 M4 Trial mechanism

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | 14 dias de tier superior automaticamente apos `shugo init`. |

### M5 M5 Payment integration

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Stripe ou Paddle para cobranca recorrente. |

### M6 M6 License server

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | API central para validar licenses, verificar tier, registrar uso. |

### A3 A3 Cursor integration

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Extensao para Cursor IDE que mostra briefing no sidebar. |

### A4 A4 Git hooks

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Pre-commit: auto-briefing. Pre-push: validation. Post-commit: feedback automatico. |

### D1 D1 Interactive tutorial

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `shugo tutorial` — guided tour interativo com exemplos reais. |

### D2 D2 Example projects

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | 3 templates: web-app, API, library. Cada um com governance pre-configurada. |

### DA1 DA1 Usage analytics

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Quais comandos sao mais usados, horarios de pico, taxa de sucesso. |

### DA2 DA2 Error tracking

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Relatorio automatico de erros: tipo, frequencia, contexto. |

### S1 S1 Penetration testing

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Teste de seguranca no CLI: injection, path traversal, command injection. |

### S3 S3 Secret scanning

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Detectar keys/tokens no output do CLI. |

### SA15 SA15 DDD nao aplicado

| Campo | Valor |
|---|---|
| **Status** | concluído |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Domain-Driven Design nao aplicado. Sem bounded contexts. |

### SA17 SA17 Commander state persistence

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Commander singleton retém _optionValues entre chamadas .parse(). |



### BACKLOG-PLAN_2026_07_22_REORGANIZAR_SUITE_TESTES — Plan — Reorganizar Suite de Testes

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-24 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plan — Reorganizar Suite de Testes |
| **Correcao** | Verificar checklist no plano `governance/plans/PLAN-2026-07-22-reorganizar-suite-testes.md` |


### BACKLOG-PLAN_2026_07_23_PROACTIVE_VISIBILITY_AND_IMPROVEMENTS — PLAN — Proactive Visibility, Notification Precision & System Improvements

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-24 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | PLAN — Proactive Visibility, Notification Precision & System Improvements |
| **Correcao** | Verificar checklist no plano `governance/plans/PLAN-2026-07-23-proactive-visibility-and-improvements.md` |

#### Passos do Plano
- [ ] `shugo briefing` mostra proactive alerts pendentes
- [ ] Challenge de severity `high` dispara notificação desktop em <5s
- [ ] Notificações funcionam em Linux e macOS (Windows via fallback log)
- [ ] `shugo init` em projeto terceiro gera `.gitignore` completo
- [ ] `shugo daemon status` mostra circuit breaker, proactive engine, último audit
- [ ] Pipeline proativo tem teste e2e cobrindo file→event→challenge→notification
- [ ] Documentação `docs/DAEMON.md` existe e é precisa


### BACKLOG-PLAN_2026_07_24_QUALITY_ROADMAP — PLAN-2026-07-24-quality-roadmap — Roadmap de Qualidade Pós-Auditoria

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-24 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | PLAN-2026-07-24-quality-roadmap — Roadmap de Qualidade Pós-Auditoria |
| **Correcao** | Verificar checklist no plano `governance/plans/PLAN-2026-07-24-quality-roadmap.md` |

#### Passos do Plano
- [ ] Passo 1.1 — Atomic writes para session-tracker
- [ ] Passo 2.1 — File watcher debounce cleanup
- [ ] Passo 3.1 — Empty catch blocks em paths críticos


### BACKLOG-ADENDO_VERIFICACAO_BUGS_VS_DESIGN_2026_07_29 — Adendo de Verificação — Bugs vs. Design (2026-07-29)

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Adendo de Verificação — Bugs vs. Design (2026-07-29) |
| **Correcao** | Verificar checklist no plano `governance/plans/ADENDO-VERIFICACAO-BUGS-VS-DESIGN-2026-07-29.md` |


### BACKLOG-PLANO_CONSOLIDADO_AUDIT_FINAL_2026_07_29 — Plano Consolidado Final — `shugo audit` (Engine + Achados Reais)

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano Consolidado Final — `shugo audit` (Engine + Achados Reais) |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-CONSOLIDADO-AUDIT-FINAL-2026-07-29.md` |


### BACKLOG-PLANO_CORRECAO_ACHADOS_ABERTOS_2026_07_30 — Plano de Correção — Achados em Aberto (2026-07-30)

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de Correção — Achados em Aberto (2026-07-30) |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-CORRECAO-ACHADOS-ABERTOS-2026-07-30.md` |


### BACKLOG-PLANO_FINAL_CONSOLIDADO_2026_07_29 — Plano Final Consolidado (2026-07-29) — respostas às duas perguntas

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano Final Consolidado (2026-07-29) — respostas às duas perguntas |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-FINAL-CONSOLIDADO-2026-07-29.md` |


### BACKLOG-PLANO_MCP_DAEMON_2026_07_30 — Plano — Correção MCP + Daemon (achados da validação ao vivo)

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano — Correção MCP + Daemon (achados da validação ao vivo) |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-MCP-DAEMON-2026-07-30.md` |


### BACKLOG-RELATORIO_AUDITORIA_S_T_U_V_2026_07_29 — Auditoria Shitenno — Blocos S/T/U/V (2026-07-29)

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Auditoria Shitenno — Blocos S/T/U/V (2026-07-29) |
| **Correcao** | Verificar checklist no plano `governance/plans/RELATORIO-AUDITORIA-S-T-U-V-2026-07-29.md` |


### BACKLOG-PLANO_MESTRE_UNICO_V2_2026_08_01 — Plano Mestre Único v2 (2026-08-01) — com código verificado contra o repositório real

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-08-02 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano Mestre Único v2 (2026-08-01) — com código verificado contra o repositório real |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-MESTRE-UNICO-v2-2026-08-01.md` |

### RULE-001 RULE-001 PR obrigatorio com 2 revisores para src/__tests__

| Campo | Valor |
|---|---|
| **Status** | em investigação |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | Tech Lead |
| **Data** | 2026-08-05 |
| **Fonte** | hook pre-commit (detector de regras) |
| **Modulos** | src/__tests__/ |
| **Descricao** | Candidata a regra: exigir Pull Request com 2 revisores para qualquer alteracao em `src/__tests__/`. Detectada pelo hook; aguarda aprovacao do Tech Lead antes de ser aplicada. |


### SA15-006 Quebrar couplings intelligence→governance restantes (audit/prioritization/semantic)

| Campo | Valor |
|---|---|
| **Status** | concluído |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-08-06 |
| **Fonte** | audit |
| **Descricao** | Follow-up do SA15: o ciclo de execução runtime rule-engine↔decision-core foi quebrado, mas o contexto-level cycle governance↔intelligence permanece via couplings de leitura: (1) audit/supply/* → infrastructure/validation (validar se escapeRegex/validators são puros e podem ir para shared/), (2) prioritization/recommend/* → application/engineering-state + capability-engine, (3) semantic/growth-profile → infrastructure/growth-profile, (4) audit/enforcement/session → governance/buffer-checkpoint. Remover estes couplings eliminaria a aresta intelligence→governance da matriz de dependências (src/domain/rules/context-dependencies.ts) e o cycle do relatório de fronteiras. Manter ADR-012 e bounded-contexts.md atualizados. |

### SA18 Ficheiros src/ >300 linhas (F-06) — refactoring de god modules restantes

| Campo | Valor |
|---|---|
| **Status** | concluído |
| **Severidade** | Critico |
| **Prioridade** | P0 |
| **Owner** | unassigned |
| **Data** | 2026-08-07 |
| **Fonte** | pre-commit hook (F-06) + risk map critical |
| **Descricao** | Regra F-06 (Forbidden Operations) violada: src/infrastructure/analyser.ts (326L), src/application/briefing.ts (305L), src/domain/rules/doc-sync-significance.ts (302L). Pre-commit hook sinaliza e bloqueia merge para main. Refactorar seguindo o padrão dos PLAN-FILE-REFACTOR anteriores (split em módulos coerentes <300L), com TDD. Manter ADR-007 e docs atualizados. |

