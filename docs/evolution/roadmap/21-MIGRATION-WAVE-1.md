---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Migration Wave 1
## Stabilization

Objetivo

Eliminar inconsistências e estabilizar a plataforma.

Duração estimada

2 semanas

---

## Tasks

### NX-STAB-001

Corrigir Lifecycle Gate

Prioridade

Critical

Dependências

Nenhuma

Critério

Todos os comandos respeitam a mesma política.

---

### NX-STAB-002

Adicionar testes de regressão

Escopo

Todos os bugs encontrados na auditoria.

---

### NX-STAB-003

Atualizar README

Eliminar divergências.

---

### NX-STAB-004

Modo não interativo

Adicionar

shugo init --answers-file

---

### NX-STAB-005

Padronizar mensagens

CLI

Errors

Warnings

Success

---

## Critério para concluir Wave 1

Todos os bugs críticos encerrados.

Cobertura mínima

90%

Pipeline verde.