---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Plugin System

## Objetivo

Transformar o sistema de plugins em uma plataforma pública.

---

## Requisitos

Plugins devem possuir:

manifest

version

dependencies

permissions

compatibility

signature

---

## Segurança

Plugins nunca acessam infraestrutura diretamente.

Toda comunicação ocorre através de interfaces.

---

## Evolução

Fase 1

Plugins locais

Fase 2

Plugins externos

Fase 3

Marketplace

---

## Current Architecture

For the current plugin system implementation, see [../../architecture/plugin-system.md](../../architecture/plugin-system.md).