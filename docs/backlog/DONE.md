---
category: product
lifecycle: Draft
---

## Done

| Item | Severidade | Resolucao |
|---|---|---|
| 0.1 Remover auto-feedback "success" no briefing command | Alto | Concluído |
| 0.2 Evitar deteccao de padroes redundante | Alto | Concluído |
| 0.3 Remover dead code em briefing.ts | Medio | Concluído |
| 0.4 Remover dead code em dashboard.ts | Baixo | Concluído |
| 0.5 Simplificar getLatestFeedback | Baixo | Concluído |
| 0.6 Documentacao dinamica + deteccao proativa de gaps | Critico | Dois problemas combinados: (A) A documentacao (AGENTS.md, SYSTEM_MAP.md) descreve a arquitetura completa como se tudo estivesse presente, mas o sistema ja suporta entrega incremental por capacidades. A documentacao nao indica claramente o que esta instalado vs disponivel vs futuro. (B) O AGENTS.md nao inclui regras que obriguem o agente a detectar gaps proativamente e informar ao usuario. A capacidade tecnica ja existe (auto-evolution.ts, doctor.ts, status.ts, knowledge-debt.ts) mas nao esta acionada pelas regras do time. |
| 0.7 Actualizar documentação desactualizada (6 ficheiros) | Critico | Concluído |
| 1.1 Ligacao feedback ↔ session ativo | Alto | Concluído |
| 1.2 Logging de erros no enrichment | Medio | Concluído |
| 1.3 Unificar computeInputHash | Medio | Concluído |
| 1.4 Dashboard correlacionar session-tracker + feedback | Medio | Concluído |
| 1.5 Dynamico: estimativas de tokens no bench | Baixo | Concluído |
| 1.6 Corrigir writeBriefingMarkdown path | Medio | Concluído |
| 1.7 Evitar race condition no cache | Baixo | Concluído |
| 1.8 Validar shitennoDir antes de operacoes | Medio | Concluído |
| 1.9 Testes para comandos novos | Alto | Concluído |
| 1.10 Testes para enrichBriefingWithPatterns | Alto | Concluído |
| 1.11 Testes para getFeedbackForSession e getLatestFeedback | Medio | Concluído |
| 1.12 Coverage gap: comandos CLI com 0% | Alto | 7 comandos com 0% de coverage cobertos com 36 novos testes. |
| 1.13 Empty catch blocks (erros silenciados) | Medio | Concluído |
| 1.14 Remover displayBriefing dead code | Medio | `displayBriefing()` e uma funcao de ~70 linhas que nao e mais chamada — substituida por `displayBriefingByDepth()`. |
| 2.1 Aprovacao de regras candidatas | Medio | `detectPatterns()` gera `candidateRules` com status "proposed" mas nao existe mecanismo para aprovar/rejeitar. |
| 2.2a Feedback do utilizador (user rating + comment) | Medio | Feedback completo com user ratings e comment. |
| 2.3 Shugo update — comando de actualizacao com change detection | Medio | Nao existe `shugo update`. O `shugo upgrade` so adiciona capabilities novas, nunca actualiza existentes. Templates estao congelados no install time. Shitenno-system precisa saber que houve mudanças no shitenno-cli. |
| 2.2b Feedback ↔ capability-engine | Baixo | O capability-engine recomenda instalacoes mas nao aprende com falhas. |
| 2.3b shugo bench --compare historico | Baixo | Benchmark mostra resultados atuais mas nao compara com execucoes anteriores. |
| 2.4 shugo feedback --list | Baixo | Nao existe forma de ver os registros de feedback sem usar `--summary`. |
| 2.5 Desacoplar context-collector de pattern-detector | Medio | Concluído |
| 2.6 Type BriefingDepth como tipo proprio no briefing | Baixo | Concluído |
| 2.7 Usar differentialBriefing no --diff | Baixo | `differentialBriefing()` do token-optimizer e mais compacto que `generateDiff()` do briefing.ts. O `--diff` usa `generateDiff()` que gera markdown verboso. |
| 2.8 Validação de schema nos records lidos | Medio | Concluído |
| 2.9 Extrair modulo shared de display | Baixo | Concluído |
| 2.18 Dashboard: cliques do mouse nas abas | Medio | Cliques do mouse nas abas do dashboard funcionais. |
| 2.19 Dashboard: responsividade do layout | Baixo | O dashboard so e visualizado corretamente com a tela maximizada. Em terminais menores (fora do VSCode ou sem maximizar), o layout fica quebrado com overflow. |
| 2.10 Atualizar AGENTS.md template | Medio | Concluído |
| 2.11 Linkar ROI.md no README | Baixo | Concluído |
| 2.12 JSDoc nas funcoes novas | Baixo | 8 funcoes exportadas/novas sem JSDoc. |
| 2.13 Consolidar planos de plans/ | Medio | Concluído |
| 2.14 Documentar limitacoes conhecidas | Baixo | Concluído |
| 2.15 Teste manual de onboarding (5 minutos) | Medio | Validar que o reescrita de onboarding (README + dashboard discover/use) atinge o criterio dos 5 minutos: pessoa sem contexto consegue correr `shugo init` e entender o output sem perguntar nada. Teste manual com participante real. |
| 2.15b Cache intermediario no collectContext | Medio | Concluído |
| 2.16 Lazy loading de modulos pesados | Baixo | Todas as importacoes sao estaticas no topo do arquivo. `pattern-detector.ts`, `session-feedback.ts`, `analyser.ts` sao carregados mesmo quando nao necessarios. |
| 2.17 Benchmark suite automatizada CI | Baixo | O benchmark existe mas nao roda no CI. Regressoes de performance passam despercebidas. |
| A1 MCP server | Alto | Servidor MCP (Model Context Protocol) para agentes IA consumirem contexto do Shugo. Ferramentas: getBriefing, getRiskMap, getRules. |
| A2 OpenCode plugin | Alto | Hook automatico antes de cada tarefa no OpenCode. Injeta briefing no contexto do agente. |
| A3 Cursor integration | Medio | Extensao para Cursor IDE que mostra briefing no sidebar. |
| A4 Git hooks | Medio | Pre-commit: auto-briefing. Pre-push: validation. Post-commit: feedback automatico. |
| A5 Webhook de sessao | Baixo | POST briefing result para API externa (Slack, Discord, webhook custom). |
| A6 Context injection API | Baixo | Endpoint REST para briefing sob demanda. Agentes podem chamar HTTP em vez de CLI. |
| A7 Skill template para shitenno-cli | Medio | shitenno-cli precisa prover um template para criar novas skills. Atualmente as 14 skills em `shitenno/docs/skills/` foram criadas manualmente sem padrao formal. O template deve definir: frontmatter obrigatorio (name, description), estrutura de secoes (objetivo, regras, onde aplicar), e validacao. Comando: `shugo skill:create <nome>` que scaffolds um novo arquivo `.md` com o template preenchido. |
| A8 Feedback personalizado agente + usuario com calibragem de perfil | Alto | Concluído |
| D1 Interactive tutorial | Medio | `shugo tutorial` — guided tour interativo que mostra cada comando com exemplos reais. |
| D2 Example projects | Medio | 3 templates: web-app (Next.js), API (Express), library (TypeScript). Cada um com governance pre-configurada. |
| D3 Migration guide | Baixo | Como migrar de outros tools (ESLint, Prettier, SonarQube) para Shugo. |
| D4 API documentation | Baixo | Referencia completa das funcoes internas para quem quer usar como biblioteca. |
| D5 SDK/library mode | Baixo | Uso como biblioteca Node.js, nao CLI. `import { generateBriefing } from 'shitenno'`. |
| D6 Video walkthrough | Baixo | 5min demo no YouTube mostrando o fluxo completo: init → briefing → feedback. |
| DA1 Usage analytics | Medio | Quais comandos sao mais usados, horarios de pico, taxa de sucesso por comando. |
| DA2 Error tracking | Medio | Relatorio automatico de erros: tipo, frequencia, contexto. |
| DA3 User behavior analysis | Baixo | Fluxo tipico de uso: quais comandos sao executados em sequencia. |
| DA4 A/B testing framework | Baixo | Testar variacoes de briefing: formato, profundidade, ordem de secoes. |
| S1 Penetration testing | Medio | Teste de seguranca no CLI: injection via inputs, path traversal, command injection. |
| S2 Dependency auditing | Alto | `npm audit` automatico no CI. Bloquear builds com vulnerabilidades criticas. |
| S3 Secret scanning | Medio | Detectar keys/tokens no output do CLI. Evitar vazar informacoes sensiveis. |
| S4 Supply chain security | Baixo | SLSA compliance, provenance, SBOM. |
| SA1 governance/WORKFLOW.md faltando | Critico | Documento governance/WORKFLOW.md nao encontrado. Critico para lifecycle state — impede comandos que requerem estado governed. |
| SA2 Bug: digest require("fs") incompativel com ESM | Critico | Comando digest falha com "Dynamic require of fs is not supported". Usa require() em vez de import, incompativel com ESM. |
| SA3 Governanca 0% | Critico | Dimensao Governance do score de maturidade esta em 0%. Nenhuma pratica de governanca formalizada no codigo. |
| SA4 Arquitetura 15% | Alto | Dimensao Architecture do score de maturidade esta em 15%. 46 arquivos flat em src/, sem camadas, sem bounded contexts. |
| SA5 Documentacao 10% | Alto | ADRs de arquitetura documentados: Single Agent, Event-Driven, Knowledge Graph, Orphan Events. |
| SA6 15 artifacts orfaos no knowledge graph | Alto | 15 artifacts no knowledge graph sem relacoes conectando-os. Impossivel rastrear fluxo de conhecimento. |
| SA7 Baixa densidade de relacoes no knowledge graph | Alto | Relacao baixa entre artifacts (24 relacoes para 26 artifacts). Sugestao: adicionar mais conexoes. |
| SA8 context_buffer.yaml nao encontrado | Alto | Arquivo context_buffer.yaml movido de governance para core. |
| SA9 Agent contracts configurados | Alto | Agent contracts com papeis e responsabilidades definidos. |
| SA10 Clean Architecture violado | Alto | 46 arquivos flat em src/, sem separacao de camadas. Domain logic misturado com infrastructure. Commands importam implementacoes concretas. |
| SA11 SOLID violado | Alto | God modules (feedback-loops.ts 396 linhas, state-manager.ts 438 linhas). Sem dependency injection. Interface Segregation violada (ShitennoState com 60+ campos). |
| SA12 Knowledge graph nao inicializado | Baixo | Knowledge graph nao inicializado. Impossivel rastrear como conhecimento flui pelo projeto. |
| SA13 ADRs criados | Baixo | ADRs de arquitetura: Single Agent, Event-Driven, Knowledge Graph, Orphan Events. |
| SA14 docs/session-template.md faltando | Baixo | Documento session-template.md nao encontrado. Recomendado para estruturar sessoes de trabalho. |
| SA15 DDD nao aplicado | Baixo | Domain-Driven Design nao aplicado. Sem bounded contexts, sem ubiquitous language, models anemicos. |
| SA16 TDD nao aplicado | Baixo | Testes escritos depois do codigo, nao antes. 580 testes mas nao e TDD — e test-after. |
| SA17 Commander state persistence | Baixo | Commander singleton retém _optionValues entre chamadas .parse(). Testes de sync precisam de fresh instances. |
