---
category: engineering
lifecycle: Active
---

## Ativo

> **Total:** 45 itens (0 P0, 15 P1, 29 P2, 0 P3)

### SA4 SA4 Arquitetura 15%

| Campo | Valor |
|---|---|
| **Status** | Backlog [REVISIT: 2026-07-13 — piorou: 99 ficheiros flat, era 46] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Dimensao Architecture do score de maturidade esta em 15%. 99 arquivos flat em src/ (era 46), sem camadas, sem bounded contexts. Subpastas existentes (audit/, commands/, console/, handbook/) sao feature-based, nao Clean Architecture. |

### SA7 SA7 Baixa densidade de relacoes no knowledge graph

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Relacao baixa entre artifacts (24 relacoes para 26 artifacts). Sugestao: adicionar mais conexoes. |

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | Backlog [REVISIT: 2026-07-13 — piorou: zero separação de camadas] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | 99 arquivos flat em src/, sem separacao de camadas. Domain logic misturado com infrastructure. Commands importam implementacoes concretas. Zero pattern DI (except context-collector.ts). |

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | Backlog [REVISIT: 2026-07-13 — piorou: 10 ficheiros >500 linhas] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | God modules: rule-engine.ts (1307 linhas), scorer.ts (947), engineering-state.ts (908), feedback-engine.ts (756). 10 ficheiros >500 linhas. Sem dependency injection (except context-collector.ts). Interface Segregation violada (ShitennoState com 60+ campos). |

### LIVING-005 LIVING-005 Pipeline de validação por fases

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Gate comum (testes+lint limpos, e2e sem regressão) + critérios específicos por fase. Benchmark novo Fase 1, cenário e2e Fase 2, script de carga Fase 3. Dogfooding no próprio repo. |

### LIVING-007 LIVING-007 Sistema de Pipelines de Validação

| Campo | Valor |
|---|---|
| **Status** | In Progress — 2026-07-11 (template + pipelines criados, plan prepare implementado, plan.created event + RULE-020 adicionados) |
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

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `context-collector.ts` importa `pattern-detector.ts` e `session-feedback.ts`, aumentando o acoplamento. |

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `BriefingDepth` e definido em `token-optimizer.ts` mas re-exportado. briefing.ts usa `string` no display. |

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `differentialBriefing()` e mais compacto que `generateDiff()`. O `--diff` usa `generateDiff()` verboso. |

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Records lidos de JSONL nao tem validacao de schema. |

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

### 2.15 2.15 Cache intermediario no collectContext

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
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Domain-Driven Design nao aplicado. Sem bounded contexts. |

### SA16 SA16 TDD nao aplicado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Testes escritos depois do codigo, nao antes. |

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
- [ ] `shugo briefing` mostra proactive alerts pendentes
- [ ] Challenge de severity `high` dispara notificação desktop em <5s
- [ ] Notificações funcionam em Linux e macOS (Windows via fallback log)
- [ ] `shugo init` em projeto terceiro gera `.gitignore` completo
- [ ] `shugo daemon status` mostra circuit breaker, proactive engine, último audit
- [ ] Pipeline proativo tem teste e2e cobrindo file→event→challenge→notification
- [ ] Documentação `docs/DAEMON.md` existe e é precisa


| **Status** | em validação |

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-24 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Camada Semântica — Classificação, Raciocínio e Dual Path |
| **Correcao** | Verificar checklist no plano `governance/plans/PLAN-2026-07-23-semantic-layer.md` |

#### Passos do Plano
- [ ] Classifica dependências em package.json (pg → persistence, helmet → security)
- [ ] Classifica arquivos criados (migrations/ → persistence, src/auth/ → authentication)
- [ ] Classifica config changes (DATABASE_URL → persistence, JWT_SECRET → security)
- [ ] Confiança calculada corretamente (0-1)
- [ ] Evidências rastreadas (quais sinais geraram a classificação)
- [ ] Todos os testes passam
- [ ] Change Journal grava classificações em JSONL
- [ ] Journal filtra por domínio e janela temporal
- [ ] Pattern Matcher detecta architectural_shift (3+ sinais em 5 sessões)
- [ ] Pattern Matcher detecta scope_drift (2+ domínios novos)
- [ ] Padrões publicam evento `semantic.pattern_detected`
- [ ] Daemon integra journal + matcher
- [ ] Todos os testes passam
- [ ] Growth Profile persiste por projecto
- [ ] Dual Path mostra Path A (confortável) e Path B (desafiador)
- [ ] Escolha é registada no Growth Profile
- [ ] Sistema adapta nível de desafio baseado no histórico
- [ ] Comandos evolve/audit/status/detect mostram dual path
- [ ] Briefing inclui padrões semânticos detectados
- [ ] Todos os testes passam
- [ ] README.md actualizado com seção Semantic Layer
- [ ] docs/semantic/ criado com 8 arquivos
- [ ] Referências CLI actualizadas
- [ ] Eventos documentados
- [ ] Templates actualizados (AGENTS.md, WORKFLOW.md)
- [ ] Conceptual model actualizado
- [ ] Nenhuma referência quebrada
- [ ] Linguagem acessível e clara
- [ ] Classifica dependências em package.json (pg → persistence, helmet → security)
- [ ] Classifica arquivos criados (migrations/ → persistence, src/auth/ → authentication)
- [ ] Classifica config changes (DATABASE_URL → persistence, JWT_SECRET → security)
- [ ] Confiança calculada corretamente (0-1)
- [ ] Evidências rastreadas (quais sinais geraram a classificação)
- [ ] Todos os testes passam
- [ ] Change Journal grava classificações em JSONL
- [ ] Journal filtra por domínio e janela temporal
- [ ] Pattern Matcher detecta architectural_shift (3+ sinais em 5 sessões)
- [ ] Pattern Matcher detecta scope_drift (2+ domínios novos)
- [ ] Padrões publicam evento `semantic.pattern_detected`
- [ ] Daemon integra journal + matcher
- [ ] Todos os testes passam
- [ ] Growth Profile persiste por projecto
- [ ] Dual Path mostra Path A (confortável) e Path B (desafiador)
- [ ] Escolha é registada no Growth Profile
- [ ] Sistema adapta nível de desafio baseado no histórico
- [ ] Comandos evolve/audit/status/detect mostram dual path
- [ ] Briefing inclui padrões semânticos detectados
- [ ] Todos os testes passam
- [ ] README.md actualizado com seção Semantic Layer
- [ ] docs/semantic/ criado com 8 arquivos
- [ ] Referências CLI actualizadas
- [ ] Eventos documentados
- [ ] Templates actualizados (AGENTS.md, WORKFLOW.md)
- [ ] Conceptual model actualizado
- [ ] Nenhuma referência quebrada
- [ ] Linguagem acessível e clara


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

| **Status** | em investigação |

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-25 |
| **Fonte** | manual |
| **Descricao** | Transformar o MCP de dashboard de leitura para assistente adaptativo: suggestedActions no briefing, nova tool getContext, contextVersion para detectar mudanças, getBacklog adaptativo, e padrões de uso para refinar sugestões. 4 fases, ~12h estimadas. |

| **Status** | em implementação |

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | engine |
| **Data** | 2026-07-28 |
| **Fonte** | shitenno-plano-mestre-sequencial Phase B |
| **Descricao** | buffer-io.ts uses regex string replacement (replaceSectionField) to write context_buffer.yaml, which caused corruption ([] stray, duplicate impediments key). Replace with proper YAML.stringify() to prevent future corruption. 31 files depend on this file. |


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


| **Status** | em validação |

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-31 |
| **Fonte** | shugo plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de Evolução do Audit de Segurança — v4 (consolidado, com código, testado ao vivo) |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-EVOLUCAO-AUDIT-SEGURANCA-v4.md` |


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
