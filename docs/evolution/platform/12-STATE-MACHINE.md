---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# State Machine

## Objetivo

Garantir consistência entre todos os comandos.

---

## Regras

Uma única máquina de estados.

Nenhuma transição implícita.

Todos os estados documentados.

Todos os eventos registrados.

---

## Testes

Cada transição deve possuir:

teste válido

teste inválido

teste de regressão

---

## Current Architecture

For the current state machine implementation, see [../../architecture/state-machine.md](../../architecture/state-machine.md).