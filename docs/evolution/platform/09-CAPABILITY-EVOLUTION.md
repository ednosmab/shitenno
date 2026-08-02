---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Capability Evolution

## Problema Atual

As capabilities representam um dos principais conceitos do Shugo.

Entretanto ainda são tratadas como módulos.

Elas devem evoluir para entidades de domínio.

---

## Objetivo

Toda Capability deve possuir:

- Id
- Nome
- Versão
- Estado
- Dependências
- Métricas
- Owner
- Eventos
- Lifecycle

---

## Lifecycle

Draft

↓

Experimental

↓

Stable

↓

Deprecated

↓

Archived

---

## Eventos

CapabilityRegistered

CapabilityActivated

CapabilityUpdated

CapabilityDeprecated

CapabilityRemoved

---

## Critérios

Nenhuma capability poderá depender diretamente da CLI.

Todas deverão ser independentes da infraestrutura.

---

## Current Architecture

For the current capability engine implementation, see [../../architecture/capability-engine.md](../../architecture/capability-engine.md).

For the capability model definition, see [../../domain/capability-model.md](../../domain/capability-model.md).