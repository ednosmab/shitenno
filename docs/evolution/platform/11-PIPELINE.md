---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Pipeline Evolution

## Problemas identificados

Divergência entre README e implementação.

Lifecycle Gate inconsistente.

---

## Objetivos

Pipeline declarativo.

Pipeline extensível.

Pipeline observável.

Pipeline testável.

---

## Melhorias

Registrar telemetria.

Permitir plugins.

Adicionar rollback.

Permitir retry.

Executar validações automáticas.

---

## Critérios

Cada estágio deverá possuir:

entrada

saída

métricas

eventos

testes

---

## Current Architecture

For the current pipeline engine implementation, see [../../architecture/pipeline-engine.md](../../architecture/pipeline-engine.md).