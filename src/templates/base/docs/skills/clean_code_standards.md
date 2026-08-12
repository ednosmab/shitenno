---
name: clean-code-standards
description: >
  Manter o código legível, testável e fácil de manter por qualquer membro do time.
category: engineering
lifecycle: Active
---

# 🧼 SKILL: PADRÕES DE CÓDIGO E CLEAN ARCHITECTURE (GLOBAL)

## 🎯 Objetivo
Manter o código legível, testável e fácil de manter por qualquer membro do time (ou Agente).

## 📜 Princípios Fundamentais
1. **DRY (Don't Repeat Yourself):** Se uma lógica se repete em 3 lugares, ela deve ir para `[package-core]`. Se um componente se repete, vai para `[package-ui]`.
2. **KISS (Keep It Simple, Stupid):** Prefira soluções simples e legíveis a abstrações prematuras e complexas.
3. **Nomenclatura Semântica:** 
   - **Idioma:** Todo código deve ser escrito em **inglês** — nomes de arquivos, variáveis, constantes, funções, componentes, props, tipos, interfaces, enums, tabelas, colunas, chaves, mensagens de commit.
   - Caso: `camelCase` (ex: `isUserAuthenticated`).
   - Componentes: `PascalCase` (ex: `CourseCard`).
   - Constantes/Enums: `UPPER_SNAKE_CASE` (ex: `MAX_UPLOAD_SIZE`).
   - Arquivos: `kebab-case` (ex: `course-card.tsx`).
4. **Early Return:** Evite aninhamento de `if/else`. Retorne o erro ou caso base o mais cedo possível.
5. **Comentários de "Porquê", não de "O quê":** O código deve ser autoexplicativo. Use comentários apenas para explicar decisões de arquitetura complexas ou hacks necessários.

## 🧪 Testes e Qualidade
- **Unitários:** Obrigatórios para lógica de negócio no `[package-core]`.
- **Linting:** Nunca ignore avisos do ESLint ou erros do TypeScript (`@ts-ignore` é terminantemente proibido).
- **Refatoração:** "Deixe o código sempre um pouco mais limpo do que o encontrou".

## 📂 Onde Aplicar
- Em todo o monorepo.
