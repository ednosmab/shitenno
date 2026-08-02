---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# AI Implementation Guide

## Objetivo

Definir como agentes de IA devem evoluir o Shitenno preservando sua arquitetura.

---

# Regra 1

Nunca modificar mais de um Bounded Context na mesma tarefa.

---

# Regra 2

Nunca alterar arquitetura e comportamento funcional simultaneamente.

---

# Regra 3

Toda mudança exige:

- testes
- documentação
- atualização do catálogo

---

# Regra 4

Nenhuma decisão arquitetural pode ser criada sem ADR.

---

# Regra 5

Toda tarefa deve ser pequena.

Máximo recomendado:

300 linhas alteradas.

---

# Regra 6

Executar checklist antes do merge.

---

# Regra 7

Atualizar documentação imediatamente após implementação.

---

# Regra 8

Não criar novos Engines sem justificar por ADR.

Priorizar Use Cases.

---

# Regra 9

Toda refatoração deve preservar compatibilidade pública.

---

# Regra 10

Toda implementação termina com validação E2E.