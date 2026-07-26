# 🛠️ AGENTS.md - REGRAS DO TIME DE ENGENHARIA DE IA

## 📐 ARQUITETURA E PADRÕES DO REPOSITÓRIO (OBRIGATÓRIO)
- **Stack do Projecto:** typescript
- **Idioma Único:** Todo código fonte deve ser escrito em **inglês** — nomes de arquivos, variáveis, constantes, funções, componentes, props, tipos, interfaces, enums, tabelas, colunas e mensagens de commit. Nomes em português são proibidos.
- **Estilização:** Usar apenas none para estilização
- **Banco de Dados:** none
- **Validação:** Validação de dados na camada de entrada
- **Registros de Arquitetura (ADRs):** Toda decisão arquitetural de alto impacto está documentada na pasta `docs/adrs/`. É OBRIGATÓRIO ler e respeitar os ADRs existentes. Caso uma nova biblioteca estrutural precise ser adicionada, você deve primeiro sugerir a criação de um novo arquivo ADR para aprovação do usuário.
- **Regras Vinculantes (FORBIDDEN_OPERATIONS):** O arquivo `docs/FORBIDDEN_OPERATIONS.md` contém **regras absolutas** que a IA DEVE ler e seguir em toda sessão. Qualquer violação deve ser reportada e corrigida imediatamente.
- **Diretrizes de Engenharia (DESDO):** O arquivo `docs/DESDO.md` consolida as regras de governança, mitigações operacionais e padrões arquiteturais (SOLID, TDD, segurança, documentação) que devem ser observados em toda geração de código ou alteração de estado no projeto.

---

## 📖 CÓDIGO DECLARATIVO E LEGÍVEL (REGRA ABSOLUTA)

Escreva códigos extremamente declarativos, simples e fáceis de ler. Evite otimizações prematuras ou sintaxes excessivamente complexas. Prefira legibilidade à concisão. Código deve ser autoexplicativo para um desenvolvedor pleno — se precisar de um comentário para explicar o fluxo, o código provavelmente está complexo demais.

---

## 🪜 Loading Profiles (Otimização de Tokens)

| Perfil | Regras carregadas | Quando usar | Tokens aprox. |
|---|---|---|---|
| `minimal` | #1-9 (workflow + git), FORBIDDEN_OPERATIONS, DESDO | Tarefas triviais (typo, rename, comment-only) | ~3-4k |
| `lite` (default) | `minimal` + #10-11 (sessão) | Implementação de feature pequena, bug fix isolado | ~5-6k |
| `full` | `lite` + #12-14 (tríade plan/build/review) + #15 (feedback) | Refactor, migration, multi-camada, adição de nova lib | ~8-10k |

**Override:** o campo `loading_profile` em `opencode.json` força o perfil independentemente do default.

**Regras detalhadas:** Ver `docs/rules/` para regras movidas (dependency-graph, agent-modes, feedback-protocol, branch-policy, lazy-loading, context-algorithm).

---

## 🛑 REGRAS CRUCIAIS DE WORKFLOW E GIT (LEI ABSOLUTA)

1. **NUNCA FAÇA COMMIT SEM PERMISSÃO:** É ESTREITAMENTE PROIBIDO executar comandos de `git commit` ou `git push` de forma automatizada. Você deve SEMPRE solicitar que o usuário teste as alterações localmente primeiro. Apenas após a confirmação visual e autorização explícita do usuário você poderá avançar ou sugerir o commit.
2. **COMMITS CURTOS EM INGLÊS:** Quando um commit for autorizado, a mensagem de commit gerada ou sugerida DEVE ser escrita em inglês. Ela deve ser altamente concisa, resumida e seguir rigorosamente a especificação do Conventional Commits (ex: `feat: add text block schema`, `chore: update database rules`).
3. **BOOTSTRAP E SETUP PROATIVO:** Ao receber guias de início rápido (Quick Starts) ou iniciar a fase estrutural (Semanas 1-8), o agente DEVE sempre validar e instalar dependências (pnpm), limpar cache se necessário, testar a instalação e criar fisicamente a estrutura de pastas base do monorepo (scaffolding) seguindo a estrutura de pastas definida no `governance/SYSTEM_MAP.md` antes de começar a codificar.
4. **REFINAMENTO CONTÍNUO (LEAN FLOW):** Ao identificar código repetido, desorganizado, mal nomeado ou que viola as regras de arquitetura (DRY, KISS, SOLID), você TEM A OBRIGAÇÃO de executar refatoração imediatamente. Documente o processo e as melhorias realizadas no `governance/context/context_buffer.yaml` na seção `technical_debt`.
5. **TDD ESTRITO — TEST-FIRST (RED-GREEN-REFACTOR):** Você DEVE seguir o ciclo TDD estrito. Primeiro escreva o teste (RED), depois a implementação mínima (GREEN), depois refatore (REFACTOR). Só após GREEN você pode enviar o código. Consulte `docs/skills/tdd_workflow.md` para o protocolo completo.
6. **VALIDAÇÃO DE SEGURANÇA (SECURITY BY DEFAULT):** Antes de implementar qualquer funcionalidade que envolva dados do usuário, você DEVE verificar o `docs/skills/security_xss_prevention.md`.
7. **POSTURA DE ENGENHARIA SÊNIOR (SKILL OBRIGATÓRIO):** Em TODA sessão que envolva escrita ou modificação de código, a skill `docs/skills/senior-engineer.md` DEVE estar activa.
8. **TDD ESTRITO — TEST-FIRST (SKILL OBRIGATÓRIO):** Em TODA sessão que envolva escrita de testes ou implementação de funcionalidades com cobertura, a skill `docs/skills/tdd-agent.md` DEVE estar activa.
9. **TESTE DE INTEGRIDADE POST-COMMIT (POST-MORTEM):** Após realizar qualquer commit, você DEVE executar imediatamente: (a) `pnpm run lint`, (b) `pnpm ls <dependencias-core>`, (c) `pnpm run test`. Se qualquer um falhar, corrigir e repetir até todos passarem.
10. **CHECKLIST DE AMBIENTE PRÉ-DEPLOY:** Antes de commitar qualquer alteração em configs de deploy, secrets ou env vars, valide que nenhuma flag de teste foi propagada para ficheiros de configuração de produção.
11. **PRIORIDADE DE ENTRADA DE SESSÃO:** Ao iniciar qualquer nova sessão, a PRIMEIRA tarefa a ser atacada é o item P0 activo no `docs/BACKLOG.md`. Itens P1/P2 só podem ser iniciados após (a) concluir o P0, ou (b) registar adiamento datado.
12. **MCP TOOLS — PATH DO `.shitenno`:** O directório `.shitenno` é **oculto**. Para aceder a ficheiros em `.shitenno/` (planos, governance, rules, skills), use **SEMPRE** o MCP `shitenno` (`getPlans`, `getRules`, `getSkills`, `getBacklog`, etc.) — NUNCA o `local-filesystem` (que já foi removido). Se precisar de ler um ficheiro `.shitenno/` específico, use o tool `read` com path explícito (ex: `.shitenno/governance/plans/PLAN-xxx.md`). **VIOLAÇÃO = sessão inválida.**

---

## 🛑 BLOQUEADORES DE SESSÃO

12. **INVARIANTE DE FIM DE SESSÃO:** Nenhuma sessão pode ser declarada "concluída" sem antes executar o ritual de fim de sessão: `pnpm run close:session`, buffer podado (≤ 50 linhas activas), backlog actualizado, testes verdes. Ver template detalhado em `docs/session-template.md`.
13. **QUICK BOARD DE AVISO (BLOQUEADOR DE SESSÃO):** ⛔ **NENHUMA RESPOSTA PODE SER ENVIADA AO UTILIZADOR SEM ANTES EXIBIR O QUICK BOARD.** Ao receber QUALQUER mensagem (incluindo "oi", "olá", ou qualquer saudação), o agente DEVE:
    a. **PRIMEIRO:** Ler `governance/context/context_buffer.yaml`
    b. **SEGUNDO:** Exibir o Quick Board no formato definido em `docs/opencode-context.md`
    c. **TERCEIRO:** Só então processar a mensagem do utilizador
    **VIOLAÇÃO = SESSÃO INVÁLIDA.**

---

## 📋 REGRAS MODULARES (carregar sob demanda)

As regras abaixo foram movidas para ficheiros separados para optimização de tokens. Carregar apenas quando necessário:

| Regra | Ficheiro | Gatilho |
|---|---|---|
| Grafo de Dependências | `docs/rules/dependency-graph.md` | loading_profile=full |
| Modos Plan/Build/Review | `docs/rules/agent-modes.md` | agent=plan/build/review |
| Feedback de Sessão | `docs/rules/feedback-protocol.md` | keywords fim-de-sessão |
| Política de Branches | `docs/rules/branch-policy.md` | operações git |
| Lazy Loading | `docs/rules/lazy-loading.md` | início de sessão |
| Algoritmo de Contexto | `docs/rules/context-algorithm.md` | tarefa de implementação |

---

## 📊 EVIDÊNCIA E MÉTRICAS

14. **EVIDÊNCIA ACIMA DA DOCUMENTAÇÃO:** Quando existir conflito entre documentação, implementação e comportamento real, priorizar: Runtime > Código > Documentação.
15. **MEDIR ANTES DE OPTIMIZAR:** Nenhuma optimização pode avançar sem métricas que a justifiquem. Excepção: Itens P0 (risco activo).

---

## 📋 ESTADOS E CHECKLISTS

16. **ESTADOS DE ITEM DO BACKLOG:** `planeado` | `em investigação` | `em implementação` | `em validação` | `concluído` | `encerrado` | `pausado` | `adiado`
17. **CHECKLIST DE CONCLUSÃO:** Nenhum item pode ser marcado como [x] sem: (1) Actualização da documentação, (2) Actualização do backlog, (3) Validação dos critérios, (4) Registo da decisão.

---

<!-- SHITENNO_CONTEXT_RULES -->
<!-- As regras abaixo são geradas automaticamente pelo Shugo baseadas no contexto do projeto.
     Não edite manualmente. Execute `shugo status` para atualizar. -->
<!-- /SHITENNO_CONTEXT_RULES -->

---

## 🧠 CONTEXTO DO PROJECTO (CONTEXT PIPELINE)

**ANTES de iniciar qualquer tarefa:**
1. Leia `governance/context/context_buffer.yaml` (Quick Board — fonte primária de contexto)
2. Verifique as áreas de risco, cobertura de testes e regras contextuais
3. **Se o campo `reminders` não estiver vazio, PAUSE e apresente ao utilizador o resumo dos reminders activos antes de prosseguir.** Cada reminder é um item de accão pendente — pergunte se o utilizador quer resolver algum deles agora.
4. Adapte o comportamento baseado nos alertas e recomendações do briefing

**APÓS completar a tarefa:**
1. Execute `shugo feedback --outcome success` se a tarefa foi concluída com sucesso
2. Execute `shugo feedback --outcome failure --notes "<descrição do problema>"` se falhou
3. Execute `shugo feedback --outcome partial --areas <áreas>"` se parcialmente concluída
