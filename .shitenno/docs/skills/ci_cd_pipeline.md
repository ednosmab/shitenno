---
category: engineering
lifecycle: Active
---

# 🚀 SKILL: CI/CD PIPELINE & GITHUB ACTIONS

## 🎯 Objetivo
Padronizar a criação e manutenção dos pipelines de Integração Contínua (CI) e Deploy Contínuo (CD), garantindo builds rápidos, cache eficiente e segurança antes de mesclar código.

## 🛠️ Stack e Ferramentas (exemplo de configuração)
- **CI Provider:** GitHub Actions (qualquer provider serve; os princípios abaixo generalizam)
- **Package Manager:** escolha um gerenciador e seja consistente em todo o pipeline (ex: `pnpm` com `pnpm/action-setup`)
- **Test Runner:** qualquer runner configurado no projeto (ex: `vitest`)

## ⚙️ Regras de Ouro do CI (Integração Contínua)
1. **Gatilhos (Triggers):** O CI deve rodar em todos os *Pull Requests* para as branches de integração e produção, e em *pushes* diretos para a branch de integração.
2. **Ordem de Execução (Fail-Fast):**
   - **Instalação:** Baixar dependências usando cache do gerenciador de pacotes.
   - **Análise Estática:** Rodar Linter e Type Checking. Se falhar, o pipeline aborta aqui para poupar recursos.
   - **Testes:** Rodar testes automatizados.
   - **Build:** Garantir que as aplicações finais conseguem compilar para produção.

## 🔄 Regras de Ouro do CD (Continuous Deployment)
1. **Gatilhos (Triggers):** Executado APENAS quando um *Pull Request* é mesclado com sucesso da branch de integração para a branch de produção.
2. **Automação:** O CD pode fazer merge automático e publicar releases, ou atualizar o ambiente de Produção.
3. **Living README:** Um job dentro do pipeline ou isolado deve atualizar badges dinâmicos (Coverage, Build Status) no `README.md` da raiz.

## 💾 Estratégia de Cache (Performance)
Em projetos monorepo, a instalação de dependências é o gargalo. Sempre configure cache do gerenciador de pacotes no provider de CI escolhido.

## 🚨 Prevenção de Erros Comuns
- **Padronize um único gerenciador de pacotes** nos pipelines — misturar gerenciadores no mesmo projeto causa lockfiles inconsistentes.
- Certifique-se de que variáveis de ambiente sigilosas (chaves de API, tokens) sejam passadas via secrets do provider de CI, e nunca hardcoded no YAML.
