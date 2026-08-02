---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Testing Strategy

## Pirâmide

70%

Unitários

20%

Integração

10%

End-to-End

---

# Obrigatório

Todo bug gera:

- teste unitário
- teste de regressão

---

# Cobertura

Application

100%

Domain

100%

Infrastructure

≥85%

CLI

≥80%

---

# Testes Arquiteturais

Verificar:

- dependências proibidas
- imports inválidos
- contextos
- interfaces

---

# Testes E2E

Fluxos completos.

Cenários negativos.

Rollback.

Migração.

Upgrade.
