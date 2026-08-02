---
category: engineering
lifecycle: Active
---

# Lazy Loading — Diretriz de Leitura Preguiçosa

> **Gatilho:** Início de sessão, nova tarefa iniciada

## Regras

1. **PROIBIDO** realizar buscas globais (globbing) ou ler múltiplos arquivos da pasta `docs/` ou `governance/` de forma simultânea no início do chat.
2. A primeira leitura obrigatória é `governance/WORKFLOW.md` — ele determina o fluxo da sessão.
3. Sempre que o usuário solicitar uma tarefa, analise o escopo e use o arquivo `governance/SYSTEM_MAP.md` para identificar os caminhos exatos dos arquivos de plano e skill necessários.
4. Use a ferramenta MCP para ler exclusivamente os arquivos mapeados para a tarefa atual e ignore as demais pastas de documentação.
5. Leia `governance/context/context_buffer.yaml` ao iniciar cada nova tarefa para obter o estado actual (exceto durante fluxos de refatoração ou correção de bugs).
