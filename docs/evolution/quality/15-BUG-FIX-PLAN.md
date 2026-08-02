---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Bug Fix Plan

## Objetivo

Consolidar todas as inconsistências encontradas durante a auditoria arquitetural e validação E2E em um único backlog priorizado.

---

# Criticidade

## CRITICAL

### NX-BUG-001

Título

Lifecycle Gate inconsistente

Origem

Auditoria E2E

Problema

O comando `run` executa comportamentos incompatíveis com a política definida pela máquina de estados.

Impacto

Alto

Risco

Inconsistência arquitetural.

Plano

- Definir política em ADR.
- Atualizar State Machine.
- Atualizar Pipeline.
- Atualizar testes.

Critério de aceite

Todos os comandos respeitam a mesma política de transição.

---

## HIGH

### NX-BUG-002

Regex do Scaffolder

Status

Resolvido.

Ação

Manter teste de regressão permanente.

---

### NX-BUG-003

Empate entre força e fraqueza.

Problema

Empates geram resultados inconsistentes.

Plano

Criar algoritmo determinístico.

Critério

Mesmo conjunto de dados produz sempre o mesmo resultado.

---

### NX-BUG-004

README divergente da implementação.

Plano

Documentação passa a ser validada em CI.

---

## MEDIUM

### NX-BUG-005

Init sem modo não interativo.

Plano

Adicionar:

```bash
shugo init --answers-file config.yaml
```

Objetivo

Permitir CI/CD.

---

## LOW

Padronização de mensagens da CLI.

Melhoria de UX.
