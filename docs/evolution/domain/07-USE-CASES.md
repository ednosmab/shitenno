---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Use Cases — Shitenno

> 48 casos de uso documentados, organizados por ator.
> Cada caso segue o template: Objetivo → Pré-condições → Fluxo → Eventos → Pós-condições → Testes.

---

## Visão Geral dos Atores

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHUGO SYSTEM                             │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Tech Lead   │◄──►│   Sistema    │◄──►│  AI Agent    │      │
│  │  (Humano)    │    │  (Auto-gov)  │    │  (Plan/Build)│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│    CLI Commands       State Machine      AGENTS.md            │
│    Decisions          Events              Contracts            │
│    Feedback           Telemetry           Skills               │
└─────────────────────────────────────────────────────────────────┘
```

| Ator | Papel | Casos de Uso |
|------|-------|--------------|
| **Tech Lead** | Humano que toma decisões, aprova regras, guia governança | UC-01 a UC-13 |
| **AI Agent** | Agente que consome artefatos Shugo para coordenar desenvolvimento | UC-14 a UC-23 |
| **Sistema** | Auto-governo, detecção, evolução, telemetria | UC-24 a UC-48 |

---

## Ator 1: Tech Lead (Humano)

> O desenvolvedor humano que executa comandos CLI, toma decisões, aprova regras e guia a governança do projeto.

---

### UC-01: Inicializar Shitenno

- **Comando:** `shugo init`
- **Objetivo:** Configurar o framework de governança governance pela primeira vez no projeto
- **Pré-condições:** Projeto existe, `opencode.json` não existe ainda
- **Fluxo principal:**
  1. Tech Lead executa `shugo init`
  2. Sistema analisa o projeto (stack, package manager, testes, CI)
  3. Sistema apresenta questionário de maturidade (8 blocos, 22 perguntas)
  4. Tech Lead responde perguntas sobre experiência, projeto, arquitetura, qualidade, IA, governança
  5. Sistema calcula perfil de maturidade (7 dimensões, 0-100)
  6. Sistema recomenda capacidades baseado no perfil
  7. Sistema scaffolding a estrutura: opencode.json, shitenno/, AGENTS.md, skills, scripts
  8. Tech Lead visualiza resultados e próximos passos
- **Fluxos alternativos:**
  - `--answers-file <json>`: Respostas vêm de arquivo JSON (modo não-interativo)
  - `--force`: Força criação dentro do diretório shitenno-cli
  - Já inicializado: Sistema avisa e sugere `upgrade` ou `assess`
- **Eventos emitidos:** Nenhum (invalida cache)
- **Pós-condições:** `opencode.json` existe, `shitenno/` criado, perfil de maturidade salvo
- **Testes obrigatórios:** `scaffolder.test.ts`, `cli-integration.test.ts > init`

---

### UC-02: Upgrade por Capacidade

- **Comando:** `shugo upgrade`
- **Objetivo:** Adicionar capacidades de governança específicas ao projeto
- **Pré-condições:** Shugo já inicializado (pelo menos `opencode.json` existe)
- **Fluxo principal:**
  1. Tech Lead executa `shugo upgrade`
  2. Sistema mostra capacidades instaladas e recomendadas
  3. Tech Lead seleciona capacidades: `--capability <nome>` ou `--accept-recommended`
  4. Sistema copia templates da capacidade selecionada
  5. Sistema invalida cache
- **Fluxos alternativos:**
  - `--list`: Lista todas as capacidades disponíveis
  - `--accept-recommended`: Aceita todas as recomendadas pelo perfil
- **Eventos emitidos:** `capability.installed` (por capacidade)
- **Pós-condições:** Novos arquivos/diretórios em `shitenno/`, cache invalidado
- **Testes obrigatórios:** `cli-integration.test.ts > upgrade`

---

### UC-03: Sincronizar Governança

- **Comando:** `shugo sync`
- **Objetivo:** Sincronizar arquivos de governança de uma fonte para o projeto
- **Pré-condições:** Diretório fonte shitenno existe
- **Fluxo principal:**
  1. Tech Lead executa `shugo sync --shitenno-path <caminho>`
  2. Sistema compara arquivos fonte vs. destino
  3. Sistema preserva customizações do projeto (AGENTS.md, opencode.json)
  4. Sistema atualiza arquivos obsoletos
- **Fluxos alternativos:**
  - `--dry-run`: Mostra o que seria alterado sem aplicar
  - `--force`: Sobrescreve todas as customizações
- **Eventos emitidos:** Nenhum
- **Pós-condições:** Arquivos sincronizados, customizações preservadas
- **Testes obrigatórios:** Nenhum existente (oportunidade de teste)

---

### UC-04: Limpar Cache

- **Comando:** `shugo clean`
- **Objetivo:** Remover cache obsoleto e forçar análise fresca
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo clean`
  2. Sistema remove `.shitenno-cache.json` e `*.tsbuildinfo`
  3. Sistema invalida cache de análise
- **Eventos emitidos:** `analysis.complete` (com itemsRemoved)
- **Pós-condições:** Cache limpo, próxima análise será completa
- **Testes obrigatórios:** Nenhum existente

---

### UC-05: Verificar Status do Projeto

- **Comando:** `shugo status`
- **Objetivo:** Verificar saúde da governança, maturidade e complexidade do projeto
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo status`
  2. Sistema executa 7 verificações de saúde (opencode.json, AGENTS.md, skills/, governance/, context_buffer, scripts/, contratos)
  3. Sistema carrega perfil de maturidade
  4. Sistema calcula complexidade (score 0-20, nível junior/pleno/senior)
  5. Sistema mostra dashboard com: health score, dimensões de maturidade, breakdown por área
- **Fluxos alternativos:**
  - `--no-cache`: Força análise fresca
  - `--json`: Saída em formato JSON
- **Eventos emitidos:** `analysis.complete`
- **Pós-condições:** Relatório salvo em `reports/`
- **Testes obrigatórios:** `cli-integration.test.ts > status`

---

### UC-06: Reavaliar Maturidade

- **Comando:** `shugo assess`
- **Objetivo:** Recalcular perfil de maturidade e comparar com versão anterior
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo assess`
  2. Sistema apresenta questionário (ou reutiliza respostas anteriores)
  3. Sistema recalcula 7 dimensões de maturidade
  4. Sistema compara com perfil anterior, mostra delta e sparkline de evolução
  5. Sistema grava snapshot de telemetria
  6. Sistema recomenda novas capacidades se aplicável
- **Eventos emitidos:** `maturity.changed`
- **Pós-condições:** Novo perfil salvo, histórico de evolução atualizado
- **Testes obrigatórios:** `cli-integration.test.ts > assess`

---

### UC-07: Detectar Padrões

- **Comando:** `shugo detect`
- **Objetivo:** Analisar histórico e reports para identificar erros recorrentes, decisões revertidas, áreas quentes
- **Pré-condições:** Shugo inicializado, histórico acumulado
- **Fluxo principal:**
  1. Tech Lead executa `shugo detect`
  2. Sistema lê entradas de histórico e reports de complexidade
  3. Sistema detecta: erros recorrentes (mesma área, 3+ ocorrências), decisões revertidas, áreas quentes
  4. Sistema propõe regras candidatas (PROPOSTAS — requer aprovação do Tech Lead)
  5. Tech Lead aprova/rejeita cada regra
- **Eventos emitidos:** `pattern.detected`
- **Pós-condições:** Relatório salvo em `reports/`, feedback registrado
- **Testes obrigatórios:** `cli-integration.test.ts > detect`

---

### UC-08: Auditoria de Governança

- **Comando:** `shugo audit`
- **Objetivo:** Auto-avaliação: regras mortas, violações, docs faltantes, grafo de conhecimento
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo audit`
  2. Sistema verifica 5 itens: regras mortas, hotspots de violação, docs faltantes, diretórios órfãos, context buffer obsoleto
  3. Sistema analisa grafo de conhecimento (ADRs, skills, contratos, workflows)
  4. Sistema gera optimizações: remove_rule, rewrite_rule, promote_to_lint, add_docs
  5. Tech Lead revisa e aprova otimizações
- **Eventos emitidos:** `health.checked`, `knowledge.analyzed`
- **Pós-condições:** Relatório salvo em `reports/`
- **Testes obrigatórios:** `cli-integration.test.ts > audit`

---

### UC-09: Mentoria de Engenharia

- **Comando:** `shugo doctor`
- **Objetivo:** Consolidar estado e fornecer orientação sobre riscos, melhorias e momentos de ensino
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo doctor`
  2. Sistema consolida estado da engenharia
  3. Sistema analisa riscos (knowledge debt, maturidade baixa, bloqueadores ativos, sem testes)
  4. Sistema analisa melhorias (sem CI/CD, poucas capacidades, sem knowledge graph)
  5. Sistema gera momentos de ensino (ADR vs Skill, sistema de capacidades, lifecycle do conhecimento)
  6. Sistema calcula health score
- **Eventos emitidos:** `health.checked`
- **Pós-condições:** Relatório de mentorship salvo
- **Testes obrigatórios:** `cli-integration.test.ts > doctor`

---

### UC-10: Evolução com Dual Path

- **Comando:** `shugo evolve`
- **Objetivo:** Gerar recomendações de evolução com caminho confortável e desafiador
- **Pré-condições:** Shugo inicializado, estado >= governed
- **Fluxo principal:**
  1. Tech Lead executa `shugo evolve`
  2. Sistema analisa estado atual e gera recomendações em 4 domínios: capacidade, conhecimento, governança, automação
  3. Para cada recomendação, sistema gera Dual Path: confortável + desafiador
  4. Tech Lead escolhe uma recomendação e um caminho
  5. Sistema registra feedback (accept/reject, pathChoice)
  6. Sistema ajusta confiança baseado no histórico
- **Fluxos alternativos:**
  - `--accept <id>`: Aceita recomendação especifica
  - `--reject <id>`: Rejeita recomendação com motivo
- **Eventos emitidos:** `evolution.recommended`
- **Pós-condições:** Feedback registrado, growth profile atualizado
- **Testes obrigatórios:** `cli-integration.test.ts > evolve`

---

### UC-11: Relatório de Performance

- **Comando:** `shugo report`
- **Objetivo:** Gerar relatório rico de performance com 7 dimensões, insights e próximos passos
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo report`
  2. Sistema carrega sumários de dimensões e métricas de sessão
  3. Sistema calcula scores das 7 dimensões (architectural_vision, scope_management, prompt_quality, decision_making, risk_management, technical_communication, sustainable_velocity)
  4. Sistema detecta padrões de feedback
  5. Sistema gera insights personalizados e próximos passos
  6. Sistema mostra: dimensões com tendências, métricas de sessão, métricas de feedback, tendências de debt/maturity
- **Fluxos alternativos:**
  - `--period <dias>`: Período personalizado (default: 30)
  - `--json`: Saída em formato JSON
  - `--save`: Salva relatório em disco
- **Eventos emitidos:** `analysis.complete`
- **Pós-condições:** Relatório exibido
- **Testes obrigatórios:** `performance-reporter.test.ts`

---

### UC-12: Pipeline Completo de Análise

- **Comando:** `shugo run`
- **Objetivo:** Executar pipeline de 5 estágios em sequência: analyze → score → detect → audit → evolve
- **Pré-condições:** Shugo inicializado, estado >= assessed
- **Fluxo principal:**
  1. Tech Lead executa `shugo run`
  2. Sistema executa 5 estágios sequencialmente:
     - **analyze**: Detecta estrutura do projeto
     - **score**: Calcula complexidade
     - **detect**: Detecta padrões no histórico
     - **audit**: Audita saúde da governança
     - **evolve**: Gera recomendações (respeita lifecycle gate)
  3. Cada estágio alimenta o próximo via PipelineContext
  4. Sistema mostra resultados consolidados com timing por estágio
- **Eventos emitidos:** `pipeline.stage.start`, `pipeline.stage.complete`, `pipeline.complete`
- **Pós-condições:** Relatórios salvos em `reports/`
- **Testes obrigatórios:** `cli-integration.test.ts > run`

---

### UC-13: Validar Sessão

- **Comando:** `shugo validate`
- **Objetivo:** Validar integridade da sessão: context buffer, ADRs, contratos, git status
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Tech Lead executa `shugo validate`
  2. Sistema verifica: context buffer, diretório ADR, opencode.json (modelo, papéis de agente), contratos, status da sessão, git status
  3. Sistema reporta pass/warn/fail por verificação
  4. Tech Lead pode usar `--fix` para correção automática
- **Fluxos alternativos:**
  - `--fix`: Corrige arquivos faltantes automaticamente
  - `--json`: Saída em formato JSON
- **Eventos emitidos:** `validation.completed`
- **Pós-condições:** Integridade verificada
- **Testes obrigatórios:** `cli-integration.test.ts > validate`

---

## Ator 2: AI Agent (Planner/Builder/Reviewer)

> Agentes de IA que consomem artefatos Shugo (AGENTS.md, contratos, skills, context buffer) para coordenar desenvolvimento de forma alinhada com a governança do projeto.

---

### UC-14: Consumir AGENTS.md

- **Objetivo:** Ler e seguir as diretrizes de comportamento do agente definidas no AGENTS.md
- **Pré-condições:** `shitenno/docs/AGENTS.md` existe
- **Fluxo principal:**
  1. AI Agent inicia sessão de trabalho
  2. Agent lê `shitenno/docs/AGENTS.md`
  3. Agent identifica: papéis (planner, builder, reviewer), regras, restrições
  4. Agent ajusta comportamento conforme diretrizes
  5. Agent documenta decisões em ADRs quando necessário
- **Pós-condições:** Agent opera dentro das diretrizes definidas
- **Testes obrigatórios:** Nenhum (comportamento do agent)

---

### UC-15: Seguir Contratos de Agente

- **Objetivo:** Respeitar contratos que definem responsabilidades entre agentes
- **Pré-condições:** Contratos em `shitenno/governance/contracts/`
- **Fluxo principal:**
  1. Agent identifica qual contrato se aplica à tarefa atual
  2. Agent lê responsabilidades, inputs esperados, outputs garantidos
  3. Agent cumpre sua parte do contrato
  4. Agent valida se outputs atendem ao contrato
- **Pós-condições:** Contrato cumprido, responsabilidades claras
- **Testes obrigatórios:** Nenhum

---

### UC-16: Executar Skills

- **Objetivo:** Aplicar conhecimento especializado documentado em skills
- **Pré-condições:** Skills em `shitenno/docs/skills/`
- **Fluxo principal:**
  1. Agent identifica skill relevante para a tarefa
  2. Agent lê descrição, quando aplicar, quando NÃO aplicar, anti-padrões
  3. Agent aplica o conhecimento na implementação
  4. Agent evita anti-padrões documentados
- **Pós-condições:** Skill aplicada corretamente
- **Testes obrigatórios:** Nenhum

---

### UC-17: Respeitar FORBIDDEN_OPERATIONS

- **Objetivo:** Evitar operações proibidas pela governança do projeto
- **Pré-condições:** `shitenno/docs/FORBIDDEN_OPERATIONS.md` existe
- **Fluxo principal:**
  1. Agent lê lista de operações proibidas
  2. Agent valida se a operação planejada está na lista
  3. Se proibida: Agent rejeita a operação e sugere alternativa
  4. Se permitida: Agent prossegue
- **Pós-condições:** Operação proibida não executada
- **Testes obrigatórios:** Nenhum

---

### UC-18: Usar Context Buffer

- **Objetivo:** Manter contexto da sessão atualizado para decisões informadas
- **Pré-condições:** `shitenno/context_buffer.yaml` existe
- **Fluxo principal:**
  1. Agent lê context buffer ao iniciar sessão
  2. Agent identifica: estado atual, tarefas pendentes, bloqueadores, decisões recentes
  3. Agent atualiza context buffer com progresso
  4. Agent persiste contexto entre sessões
- **Pós-condições:** Context buffer atualizado
- **Testes obrigatórios:** Nenhum

---

### UC-19: Gerar ADRs (via Sugestão)

- **Objetivo:** Criar Architecture Decision Records para decisões não documentadas
- **Pré-condições:** Template ADR disponível em `shitenno/docs/adrs/`
- **Fluxo principal:**
  1. Agent identifica decisão arquitetural não documentada
  2. Agent lê template ADR
  3. Agent cria ADR com: contexto, decisão, consequências, alternativas consideradas
  4. Agent salva em `shitenno/docs/adrs/ADR-XXX.md`
- **Eventos emitidos:** `adr.created`
- **Pós-condições:** ADR criado, knowledge graph atualizado
- **Testes obrigatórios:** Nenhum

---

### UC-20: Criar Skills (via Sugestão)

- **Objetivo:** Documentar conhecimento adquirido como skills reutilizáveis
- **Pré-condições:** Template skill disponível
- **Fluxo principal:**
  1. Agent identifica padrão de conhecimento recorrente
  2. Agent lê template de skill
  3. Agent cria skill com: descrição, quando aplicar, anti-padrões, exemplos
  4. Agent salva em `shitenno/docs/skills/`
- **Eventos emitidos:** `skill.created`
- **Pós-condições:** Skill criada, knowledge graph atualizado
- **Testes obrigatórios:** Nenhum

---

### UC-21: Seguir Workflows

- **Objetivo:** Executar processos de governança definidos em workflows
- **Pré-condições:** Workflows em `shitenno/governance/workflows/`
- **Fluxo principal:**
  1. Agent identifica workflow relevante para a tarefa
  2. Agent lê passos do workflow
  3. Agent executa cada passo na ordem definida
  4. Agent registra conclusão de cada passo
- **Pós-condições:** Workflow executado
- **Testes obrigatórios:** Nenhum

---

### UC-22: Responder a Challenge Generator

- **Objetivo:** Considerar caminho desafiador quando disponível
- **Pré-condições:** Recomendação com Dual Path disponível
- **Fluxo principal:**
  1. Agent recebe recomendação com Dual Path (confortável + desafiador)
  2. Agent analisa gap de conhecimento
  3. Agent avalia se capacidade atual suporta o caminho desafiador
  4. Agent recomenda caminho baseado no flow state do usuário
- **Pós-condições:** Caminho recomendado adequadamente
- **Testes obrigatórios:** Nenhum

---

### UC-23: Validar com shugo validate

- **Objetivo:** Garantir que sessão atende critérios de integridade antes de continuar
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Agent executa `shugo validate` antes de iniciar trabalho significativo
  2. Sistema verifica integridade da sessão
  3. Se falhas: Agent corrige ou reporta ao Tech Lead
  4. Se passes: Agent prossegue com trabalho
- **Pós-condições:** Sessão validada
- **Testes obrigatórios:** Nenhum

---

## Ator 3: Sistema (Auto-governo)

> O próprio Shitenno, executando auto-governo, detecção, evolução, telemetria e orquestração de forma autônoma.

---

### UC-24: State Machine Lifecycle

- **Objetivo:** Gerenciar lifecycle do próprio Shugo através de 5 estados
- **Pré-condições:** Shugo instalado
- **Fluxo principal:**
  1. Sistema detecta estado atual do filesystem:
     - `uninitialized`: Sem opencode.json
     - `discovered`: Sem perfil de maturidade
     - `assessed`: Sem WORKFLOW.md
     - `governed`: Estrutura básica completa
     - `evolved`: Relatórios de evolução existem
  2. Sistema valida transições permitidas
  3. Sistema persiste estado em `lifecycle-state.json`
- **Eventos emitidos:** `lifecycle.state_changed`
- **Pós-condições:** Estado atualizado e persistido
- **Testes obrigatórios:** `shitenno-state-machine.test.ts`

---

### UC-25: Command Gate Enforcement

- **Objetivo:** Impedir execução de comandos fora do estado lifecycle permitido
- **Pré-condições:** Estado lifecycle detectado
- **Fluxo principal:**
  1. Antes de cada comando, sistema valida:
     - `init`: Requer `uninitialized`
     - `status/detect/audit/assess/doctor`: Requer `discovered`
     - `upgrade/validate`: Requer `assessed`
     - `sync/clean/evolve`: Requer `governed`
  2. Se permitido: comando executa
  3. Se negado: sistema exibe mensagem de erro com estado requerido
- **Pós-condições:** Comando executado ou bloqueado
- **Testes obrigatórios:** `shitenno-state-machine.test.ts`

---

### UC-26: Knowledge Graph Auto-Rebuild

- **Objetivo:** Reconstruir grafo de conhecimento quando artefatos mudam
- **Pré-condições:** Knowledge graph configurado
- **Fluxo principal:**
  1. Sistema subscreve eventos: `adr.created`, `skill.created`, `capability.installed`
  2. Quando evento dispara, sistema reconstrói grafo
  3. Sistema descobre artefatos (ADRs, skills, contratos, workflows, runbooks, plans, scripts, docs)
  4. Sistema descobre relações (ADR→Skill, Skill→Contract, Contract→Script, etc.)
  5. Sistema salva `artifacts.json` e `relations.json`
- **Pós-condições:** Grafo reconstruído
- **Testes obrigatórios:** `knowledge-graph.test.ts` (se existir)

---

### UC-27: Entropy Calculation

- **Objetivo:** Medir deterioração organizacional: ativos órfãos, stale, dependências faltantes
- **Pré-condições:** Knowledge graph construído
- **Fluxo principal:**
  1. Sistema identifica ativos órfãos (sem relações)
  2. Sistema identifica ativos stale (30+ dias sem atualização)
  3. Sistema identifica dependências faltantes
  4. Sistema calcula entropy score (0-100, 100 = deterioração máxima)
- **Eventos emitidos:** `entropy.calculated`
- **Pós-condições:** Entropia calculada
- **Testes obrigatórios:** Nenhum

---

### UC-28: Capability Evaluation

- **Objetivo:** Avaliar maturidade de cada capacidade como entidade de primeira classe
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Sistema avalia 9 capacidades: core, knowledge, architecture, governance, ai, quality, metrics, operations, compliance
  2. Para cada capacidade, verifica nível: dormant → installed → configured → active → optimized
  3. Sistema verifica: arquivos, regras, skills, templates, métricas
  4. Sistema gera recomendações por capacidade
- **Pós-condições:** Capacidades avaliadas
- **Testes obrigatórios:** `capability-engine.test.ts`

---

### UC-29: Knowledge Debt Detection

- **Objetivo:** Detectar 10 tipos de gaps de conhecimento
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Sistema verifica: ADRs faltantes, runbooks faltantes, skills faltantes, docs faltantes, automação faltante, contratos faltantes, workflows faltantes, reviews faltantes, testes faltantes, ADRs stale
  2. Sistema calcula health score (0-100)
  3. Sistema gera recomendações para cada gap
- **Eventos emitidos:** `knowledge_debt.detected`
- **Pós-condições:** Gaps identificados
- **Testes obrigatórios:** Nenhum

---

### UC-30: Pattern Detection

- **Objetivo:** Detectar padrões recorrentes no histórico de trabalho
- **Pré-condições:** Histórico acumulado
- **Fluxo principal:**
  1. Sistema lê entradas de histórico e reports
  2. Sistema detecta: erros recorrentes (mesma área, 3+ ocorrências), decisões revertidas, áreas quentes
  3. Sistema propõe regras candidatas (propostas, não aplicadas automaticamente)
- **Eventos emitidos:** `pattern.detected`
- **Pós-condições:** Padrões identificados
- **Testes obrigatórios:** `pattern-detector.test.ts`

---

### UC-31: Feedback Pattern Analysis

- **Objetivo:** Analisar padrões comportamentais do Tech Lead nas decisões
- **Pré-condições:** Feedback acumulado
- **Fluxo principal:**
  1. Sistema lê sumários de feedback
  2. Sistema detecta padrões: always_rejects, always_accepts, rejects_after_threshold, defers_frequently
  3. Sistema ajusta scores de confiança das recomendações
- **Pós-condições:** Padrões detectados, confiança ajustada
- **Testes obrigatórios:** `feedback-loops.test.ts`

---

### UC-32: Growth Profile Management

- **Objetivo:** Rastrear preferência do usuário por caminho confortável vs. desafiador
- **Pré-condições:** Escolhas de path acumuladas
- **Fluxo principal:**
  1. Sistema registra cada escolha de path (comfortable vs. challenging)
  2. Sistema calcula growth capacity (0-1) e challenge level (0-1)
  3. Sistema detecta padrões: prefers_comfort, prefers_growth, balanced, sporadic_growth
  4. Sistema ajusta nível de desafio para manter usuário em flow state
- **Pós-condições:** Growth profile atualizado
- **Testes obrigatórios:** `growth-profile.test.ts`

---

### UC-33: Flow State Management

- **Objetivo:** Manter usuário no canal de flow (Csikszentmihalyi) — nem muito confortável nem muito desafiado
- **Pré-condições:** Growth profile calculado
- **Fluxo principal:**
  1. Sistema calcula nível ótimo de desafio: `capacity * 0.7 + 0.15`
  2. Sistema ajusta Dual Path baseado nesse nível
  3. Sistema garante que recomendações estão levemente acima da capacidade atual
- **Pós-condições:** Flow state mantido
- **Testes obrigatórios:** Nenhum

---

### UC-34: Confidence Adjustment

- **Objetivo:** Ajustar confiança das recomendações baseado no histórico de aceitação/rejeição
- **Pré-condições:** Feedback acumulado
- **Fluxo principal:**
  1. Sistema calcula taxa de aceitação/rejeição por recomendação
  2. Sistema aplica peso de 0.1 para ajuste
  3. Sistema suprime recomendações rejeitadas 5+ vezes
- **Pós-condições:** Confiança ajustada
- **Testes obrigatórios:** Nenhum

---

### UC-35: Recommendation Suppression

- **Objetivo:** Esconder recomendações indesejadas
- **Pré-condições:** Feedback acumulado
- **Fluxo principal:**
  1. Sistema conta rejeições por recomendação
  2. Se rejeições >= 5: recomendação é suprimida
  3. Sistema não mostra recomendações suprimidas
- **Pós-condições:** Recomendações indesejadas ocultas
- **Testes obrigatórios:** Nenhum

---

### UC-36: Session Tracking

- **Objetivo:** Rastrear sessões de trabalho para métricas de performance
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Sistema registra início da sessão
  2. Sistema conta comandos executados, duração, feedback dado
  3. Sistema registra fim da sessão
  4. Sistema persiste em `sessions.jsonl` (append-only)
- **Eventos emitidos:** `session.start`, `session.end`
- **Pós-condições:** Sessão registrada
- **Testes obrigatórios:** `session-tracker.test.ts`

---

### UC-37: Event Publishing

- **Objetivo:** Publicar eventos para comunicação desacoplada entre módulos
- **Pré-condições:** Event bus configurado
- **Fluxo principal:**
  1. Módulo produz evento (ex: `pattern.detected`)
  2. Event bus entrega para todos os subscribers
  3. Subscribers reagem conforme tipo de evento
- **Eventos suportados:** 31 tipos (session, analysis, scoring, patterns, health, capabilities, maturity, rules, evolution, knowledge, validation, pipeline, lifecycle, assets, entropy)
- **Pós-condições:** Eventos entregues
- **Testes obrigatórios:** `event-bus.test.ts`

---

### UC-38: Event Persistence

- **Objetivo:** Persistir eventos para auditoria e telemetria
- **Pré-condições:** Persistência habilitada
- **Fluxo principal:**
  1. Event bus recebe evento
  2. Sistema grava em `shitenno/telemetry/events-YYYY-MM-DD.jsonl`
  3. Eventos ficam disponíveis para análise posterior
- **Pós-condições:** Eventos persistidos
- **Testes obrigatórios:** Nenhum

---

### UC-39: Cache Management

- **Objetivo:** Gerenciar cache de análises para performance
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Sistema calcula checksum do conteúdo shitenno/
  2. Se checksum mudou: cache invalidado, análise refaz
  3. Se checksum igual: cache reusado
- **Pós-condições:** Cache gerenciado
- **Testes obrigatórios:** `cache.test.ts`

---

### UC-40: Plugin Loading

- **Objetivo:** Carregar e registrar plugins de extensão
- **Pré-condições:** Diretórios de plugin existem
- **Fluxo principal:**
  1. Sistema busca plugins em: `shitenno/plugins/` (projeto) e `~/.config/shugo/plugins/` (global)
  2. Sistema valida manifesto: nome, versão, descrição, hooks
  3. Sistema registra plugins com HookBus
- **Pós-condições:** Plugins carregados
- **Testes obrigatórios:** `plugin-system.test.ts`

---

### UC-41: Hook Execution

- **Objetivo:** Executar hooks registrados por plugins em pontos específicos do pipeline
- **Pré-condições:** Plugins com hooks registrados
- **Fluxo principal:**
  1. Pipeline atinge ponto de hook (pre-analysis, post-analysis, etc.)
  2. HookBus executa hooks registrados para esse ponto
  3. Hooks podem transformar contexto ou coletar resultados
- **Pós-condições:** Hooks executados
- **Testes obrigatórios:** `plugin-system.test.ts`

---

### UC-42: Pipeline Orchestration

- **Objetivo:** Orquestrar execução sequencial de estágios de análise
- **Pré-condições:** Pipeline configurado
- **Fluxo principal:**
  1. Pipeline recebe lista de estágios
  2. Para cada estágio: executa, captura timing, trata erros
  3. PipelineContext acumula resultados incrementalmente
  4. Erros em estágio não abortam pipeline inteiro
- **Eventos emitidos:** `pipeline.stage.start`, `pipeline.stage.complete`, `pipeline.complete`
- **Pós-condições:** Pipeline completo
- **Testes obrigatórios:** `pipeline.test.ts`

---

### UC-43: State Consolidation

- **Objetivo:** Consolidar toda informação de engenharia em EngineeringState canônico
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Sistema consolida: lifecycle, metadata, maturidade, capacidades, knowledge debt, knowledge graph, assets (18 tipos), métricas de entropia, health scores
  2. Sistema descobre todos EngineeringAssets do disco
  3. Sistema calcula entropy e health scores
- **Eventos emitidos:** `engineering_state.consolidated`
- **Pós-condições:** Estado consolidado
- **Testes obrigatórios:** `engineering-state.test.ts`

---

### UC-44: Telemetry Recording

- **Objetivo:** Gravar snapshots de telemetria para análise de tendência
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Após cada assess ou init, sistema grava snapshot de maturidade
  2. Sistema salva em `shitenno/telemetry/maturity-YYYY-MM-DD.json`
  3. Snapshots permitem análise de tendência temporal
- **Pós-condições:** Telemetria gravada
- **Testes obrigatórios:** Nenhum

---

### UC-45: Health Scoring

- **Objetivo:** Calcular score de saúde geral do projeto (0-100)
- **Pré-condições:** Shugo inicializado
- **Fluxo principal:**
  1. Sistema verifica 7 itens de saúde
  2. Sistema calcula score baseado em: checks pass, warnings, failures
  3. Sistema mostra barra de progresso colorida
- **Pós-condições:** Health score calculado
- **Testes obrigatórios:** `health-auditor.test.ts`

---

### UC-46: Maturity Calculation

- **Objetivo:** Calcular 7 dimensões de maturidade a partir de respostas e análise
- **Pré-condições:** Respostas do questionário e análise do projeto
- **Fluxo principal:**
  1. Sistema mapeia respostas para dimensões:
     - architecture (0-100): docs, ADRs, reviews
     - governance (0-100): padrões, processos, decisões
     - quality (0-100): CI/CD, testes, pipeline
     - automation (0-100): CI/CD, scripts, TypeScript
     - ai (0-100): uso de IA, implementação, revisão humana
     - documentation (0-100): docs, ADRs, skills
     - observability (0-100): logs, métricas, relatórios
  2. Sistema calcula overall score (média ponderada)
- **Pós-condições:** Perfil calculado
- **Testes obrigatórios:** `maturity-profile.test.ts`

---

### UC-47: Complexity Scoring

- **Objetivo:** Calcular score de complexidade (0-20) e nível (junior/pleno/senior)
- **Pré-condições:** Análise do projeto disponível
- **Fluxo principal:**
  1. Sistema analisa: contagem de arquivos, pacotes, monorepo
  2. Sistema analisa comportamento: violações, churn, superfície sensível, profundidade de dependências
  3. Sistema calcula score e nível
  4. Sistema gera breakdown por área com razões e sugestões
- **Pós-condições:** Complexidade calculada
- **Testes obrigatórios:** `scorer.test.ts`

---

### UC-48: Graph Analysis

- **Objetivo:** Analisar métricas do grafo de conhecimento
- **Pré-condições:** Knowledge graph construído
- **Fluxo principal:**
  1. Sistema conta: total de artefatos, total de relações
  2. Sistema identifica artefatos órfãos (sem relações)
  3. Sistema identifica hubs (mais conectados)
  4. Sistema detecta ciclos (DFS)
  5. Sistema calcula graph health score (0-100)
  6. Sistema gera sugestões de melhoria
- **Pós-condições:** Métricas calculadas
- **Testes obrigatórios:** Nenhum

---

## Fluxos entre Atores

### Fluxo 1: Tech Lead → Sistema → AI Agent

```
Tech Lead executa: shugo init
    ↓
Sistema: analisa projeto, questiona maturidade, scaffolding
    ↓
Sistema: gera AGENTS.md, skills, contratos
    ↓
AI Agent: lê AGENTS.md, segue contratos, executa skills
```

### Fluxo 2: AI Agent → Sistema → Tech Lead

```
AI Agent: identifica decisão não documentada
    ↓
AI Agent: cria ADR (via sugestão)
    ↓
Sistema: detecta ADR, reconstrói knowledge graph
    ↓
Sistema: atualiza health score
    ↓
Tech Lead: vê resultado em shugo audit
```

### Fluxo 3: Sistema → Sistema (Auto-governo)

```
Sistema: detecta capability.installed
    ↓
Sistema: reconstrói knowledge graph
    ↓
Sistema: recalcula entropy
    ↓
Sistema: ajusta recomendações
    ↓
Sistema: grava telemetria
```

### Fluxo 4: Tech Lead ↔ Sistema (Feedback Loop)

```
Tech Lead: executa shugo evolve
    ↓
Sistema: gera recomendação com Dual Path
    ↓
Tech Lead: aceita/rejeita com path choice
    ↓
Sistema: registra feedback
    ↓
Sistema: ajusta confiança e growth profile
    ↓
Sistema: próxima recomendação calibrada
```

---

## Referências

- [Knowledge Lifecycle](../../domain/knowledge-lifecycle.md)
- [Ubiquitous Language](../../domain/ubiquitous-language.md)
- [Engineering Assets](../../domain/engineering-assets.md)
- [Executive Summary](../00-EXECUTIVE-SUMMARY.md)
