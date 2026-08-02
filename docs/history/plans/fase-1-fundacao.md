---
category: reference
lifecycle: Historical
---

# Fase 1 — Fundação

## Objetivo
Documentar o "porquê" do Shugo e corrigir bases legadas.

## Etapas

### 1.1 Criar estrutura docs/architecture/ e INDEX.md
- **Status:** Concluído
- **Arquivos:** `docs/architecture/INDEX.md`

### 1.2 Escrever 00-VISION.md
- **Status:** Pendente
- **Descrição:** Manifesto fundador do Shugo. O documento mais importante do repositório.
- **Critério:** Qualquer pessoa lê e explica o Shugo em 5 minutos.

### 1.3 Escrever 01-PROBLEM-STATEMENT.md
- **Status:** Pendente
- **Descrição:** Problema que resolve, Who, What, Non-Goals.

### 1.4 Escrever 02-UBIQUITOUS-LANGUAGE.md
- **Status:** Pendente
- **Descrição:** Glossário canônico com definições exatas.

### 1.5 Escrever 03-DESIGN-PRINCIPLES.md
- **Status:** Pendente
- **Descrição:** 10 princípios imutáveis.

### 1.6 Escrever 04-MENTAL-MODEL.md
- **Status:** Pendente
- **Descrição:** Diagrama conceitual com Mermaid.

### 1.7 Fix templates/l1/ → templates/base/
- **Status:** Pendente
- **Descrição:** Renomear pasta legada do sistema L1/L2/L3.
- **Arquivo afetado:** `src/scaffolder.ts:22`

### 1.8 Fix YAML parser em state-manager.ts
- **Status:** Pendente
- **Descrição:** Substituir parser regex por lib `yaml`.
- **Arquivo afetado:** `src/state-manager.ts:330-392`
