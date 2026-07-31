---
name: design-patterns
description: >
  Utilizar soluções comprovadas para problemas recorrentes, padronizando a comunicação entre componentes e serviços.
---
category: product
lifecycle: Active

# 🧩 SKILL: DESIGN PATTERNS APLICADOS

## 🎯 Objetivo
Utilizar soluções comprovadas para problemas recorrentes, padronizando a comunicação entre componentes e serviços.

## 🛠️ Padrões Recomendados
1. **Strategy:** Para diferentes provedores de vídeo ou métodos de pagamento.
2. **Factory:** Para a criação dinâmica de componentes baseados no tipo de dado.
3. **Observer (Event Bus):** Para comunicação desacoplada entre partes do sistema (ex: disparar analytics quando uma aula é concluída).
4. **Adapter:** Para integrar bibliotecas externas ou APIs legadas sem poluir o domínio.
5. **Decorator:** Para adicionar responsabilidades extras a objetos (ex: logging, cache) sem modificar sua estrutura original.
6. **Compound Components:** Para criar componentes complexos e flexíveis (ex: `Select.Item`, `Select.Trigger`).

## 📂 Onde Aplicar
- `[package-renderer]/` (Factory/Strategy para blocos).
- `[package-core]/services/`.
