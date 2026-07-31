---
name: pnpm-management
description: >
  Manter o monorepo organizado, rápido e com dependências bem geridas usando pnpm.
---
category: product
lifecycle: Active

# 📦 SKILL: GESTÃO DE MONOREPO COM PNPM

## 🎯 Objetivo
Manter o monorepo organizado, rápido e com dependências bem geridas, evitando o "phantom dependencies" e o inchaço de `node_modules`.

## ⚙️ Workflow PNPM
1. **Workspace Protocol:** Sempre use `workspace:*` para dependências internas entre packages e apps.
2. **Filtros:** Use `--filter` para rodar comandos em pastas específicas (ex: `pnpm --filter [app-admin] dev`).
3. **Ghost Dependencies:** O PNPM impede o uso de pacotes não declarados no `package.json`. Se precisar de um pacote, adicione-o explicitamente.
4. **Hoisting:** Entenda as regras de hoisting do PNPM para evitar conflitos de versões entre packages.
5. **Shared Configs:** Centralize configurações de ESLint, TypeScript e Vitest na raiz ou em packages específicos de config.

## 📂 Onde Aplicar
- Em todo o monorepo.
- `pnpm-workspace.yaml`.
