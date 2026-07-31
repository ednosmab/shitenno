---
category: engineering
lifecycle: Active
---

# Context Algorithm — Algoritmo de Gestão de Contexto

> **Gatilho:** Tarefa de implementação, refactor, bug fix

## ⚠️ Regra Absoluta

Toda task de implementação, refatoração ou correção DEVE começar pelo carregamento dos documentos. Nenhuma linha de código pode ser escrita antes da leitura completa dos P0 + P2 da camada.

## Os 4 Passos

Sempre que o usuário enviar uma nova mensagem ou comando, você DEVE executar rigorosamente os 4 passos abaixo na ordem exata, usando suas ferramentas MCP.

### Passo 1: Diagnóstico e Leitura Preguiçosa (Lazy Loading)

- **Leia `governance/WORKFLOW.md` primeiro** — ele define o fluxo da sessão com base no tipo de operação (FEATURE/BUG/REFACTOR/DOCUMENTATION/PLANNING).
- Use o MCP para ler `governance/SYSTEM_MAP.md` e localize a pasta da camada da tarefa.
- Use o MCP para ler `governance/context/context_buffer.yaml` para extrair o estado da última execução.
- **Leia TODOS os P0 obrigatórios** (já injetados como system prompt pelo `opencode.json`): AGENTS.md, FORBIDDEN_OPERATIONS.md, DESDO.md, Requisitos_plataforma.md, CONTEXT_HIERARCHY.md
- Use o MCP para ler a Skill e o Plano de Execução específicos da camada afetada (P2).
- **Registre no buffer quais documentos foram lidos** na seção `## 🕹️ Documentos Carregados via MCP`.

### Passo 2: Atualização da Memória RAM (Before-Code)

- Antes de modificar qualquer código fonte, atualize o `governance/context/context_buffer.yaml`.
- Atualize o campo `current_task.status` com o objetivo imediato do turno.
- Atualize os `model_assignments` conforme o plano activo.

### Passo 3: Execução Cirúrgica

- Escreva ou altere o código estritamente dentro da pasta permitida ao seu Agente.
- Se o usuário reportar erros de terminal (TypeScript/Lint), pare imediatamente.
- Escreva o erro detalhado na seção `## ⚠️ Impedimentos & Logs de Erro Recentes` do buffer.
- Tente a correção apenas após documentar o erro no buffer.

### Passo 4: Consolidação e Purga (After-Code)

- Assim que o código compilar com sucesso, marque `[x]` na tarefa correspondente do plano.
- Execute `pnpm run validate:session` para verificar integridade do estado.
- Limpe a seção de `imported-tools` do buffer inserindo: "*Nenhum erro ativo.*"
- Execute o ritual de fim de sessão conforme regra #12: `pnpm run close:session`, buffer podado (≤ 50 linhas activas), backlog actualizado, testes verdes.
- Termine sua resposta exibindo o estado atual resumido do buffer e o consumo estimado da sessão.

## Protocolo de Registro Histórico de Longo Prazo

1. **Imutabilidade:** Os arquivos dentro de `docs/history/` são registros históricos. Você está PROIBIDO de alterar arquivos de sessões passadas.
2. **Geração de Saída:** Quando o usuário solicitar o encerramento ou resumo de uma sessão para transição de chat, sintetize os pontos em um formato denso contendo: Data, Objetivos Alcançados, Decisões Técnicas de Arquitetura e Estado do Repositório.
3. **Leitura Sob Demanda:** Você só deve ler a pasta `docs/history/` se o usuário solicitar explicitamente uma retrospectiva sobre o motivo de uma decisão tomada em sessões anteriores.
