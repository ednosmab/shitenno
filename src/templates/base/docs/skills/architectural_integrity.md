---
name: architectural-integrity
description: >
  Proteger a arquitetura limpa (Clean Architecture) e o isolamento do domínio, garantindo que as dependências fluam na direção correta.
category: engineering
lifecycle: Active
---

# 🏛️ SKILL: ARCHITECTURAL INTEGRITY & DEPENDENCY GUARD

## 🎯 Objetivo
Proteger a arquitetura limpa (Clean Architecture) e o isolamento do domínio, garantindo que as dependências fluam na direção correta e evitando "código espaguete" e dependências circulares.

## 🏗️ Hierarquia Unidirecional (Top-Down)
As dependências devem sempre apontar "para dentro" (em direção ao Domínio puro) ou "para baixo" (Infraestrutura via abstrações):
1. **UI (`apps/`)** -> Importa Hooks, Serviços de App e UseCases.
2. **Application (UseCases em `[package-core]/`)** -> Importa Interfaces (Contratos) e Domínio. Coordena o fluxo.
3. **Infraestrutura (Clientes de BD, Repositórios reais)** -> Importa Domínio e Contratos. Implementa as interfaces e fala com o mundo externo.
4. **Domain (`[package-de-contratos]`, Models, VOs)** -> O núcleo. **NÃO IMPORTA NADA** de camadas superiores.

## 🚫 Regras Inquebráveis contra Ciclos (Circular Dependencies)
- **Repositórios NUNCA devem importar UseCases.** A persistência (Infra) deve ser "burra" sobre as regras de orquestração do negócio.
- **Evite Index Exports Amplos (`index.ts` gigantes):** Eles facilitam importações emaranhadas que geram erros de `undefined` em runtime causados por dependências circulares.

## 🧱 Modularidade (Path Aliases no Monorepo)
- O monorepo resolve dependências entre si via aliases e links do PNPM.
- Use estritamente:
  - `[package-ui]`: Para importar componentes atômicos.
  - `[package-core]`: Para lógica compartilhada e domain services.
  - `[package-de-contratos]`: Para tipos globais e esquemas de validação.

## ⚠️ Sinais de Alerta Arquiteturais (Bad Smells)
- Erros de componente ou função que aparece como `undefined` durante importação.
- Uma função/hook que faz múltiplas requisições encadeadas e regras complexas condicionais (A lógica deveria ser abstraída num UseCase no Core).
