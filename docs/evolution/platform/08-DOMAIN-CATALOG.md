---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Domain Catalog

## Objetivo

Formalizar o domínio do Shitenno.

Este documento representa a fonte oficial da linguagem ubíqua utilizada pelo projeto.

---

# Agregados

## Capability

Representa uma competência da plataforma.

Responsabilidades

- possuir ciclo de vida
- possuir estado
- emitir eventos
- registrar dependências
- possuir métricas

---

## Assessment

Representa uma avaliação executada sobre um projeto.

---

## Recommendation

Representa uma ação recomendada pela plataforma.

---

## Engineering State

Representa o estado atual da engenharia do projeto.

---

# Value Objects

CapabilityId

CapabilityVersion

CapabilityDependency

RuleId

AssessmentResult

PipelineStage

---

# Domain Services

CapabilityService

RecommendationService

AssessmentService

PipelineService

KnowledgeService

EvolutionService

---

# Eventos

CapabilityActivated

CapabilityDisabled

AssessmentCompleted

PipelineFinished

RecommendationGenerated

KnowledgeUpdated

EngineeringStateChanged

---

# Casos de Uso

AnalyzeProject

AssessProject

RunPipeline

GenerateReport

DetectCapabilities

SynchronizeKnowledge

RecommendActions

ExecuteEvolution