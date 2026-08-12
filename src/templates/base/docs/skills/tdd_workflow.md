---
name: tdd_workflow
description: >
  Workflow TDD completo — ciclo Red-Green-Refactor aplicado a qualquer tarefa de implementação.
  Use quando o agente precisa de um guia passo a passo para aplicar TDD de forma consistente.
category: engineering
lifecycle: Active
---

# TDD Workflow

Guia operacional para aplicar Test-Driven Development em qualquer tarefa.

---

## Ciclo Red-Green-Refactor

### 1. RED — Escrever teste que falha

- Escreva **um único teste** que descreve o comportamento desejado
- Execute o teste e confirme que falha
- A falha deve ser clara e descritiva

### 2. GREEN — Implementação mínima

- Escreva **a menor quantidade de código** possível para fazer o teste passar
- Não adicione funcionalidades extras
- Execute o teste e confirme que passa

### 3. REFACTOR — Melhorar o código

- Elimine duplicação
- Extraia funções se necessário
- Mantenha os testes verdes durante todo o refactor

---

## Regras

1. **Nunca pule o teste** — toda funcionalidade começa com um teste
2. **Um teste por vez** — não escreva múltiplos testes antes de implementar
3. **Teste deve falhar primeiro** — confirme o RED antes de escrever código
4. **Implementação mínima** — não adicione features não testadas
5. **Refactor é obrigatório** — não é opcional depois do GREEN

---

## Checklist por Tarefa

- [ ] Teste escrito e falhando (RED)
- [ ] Implementação mínima feita (GREEN)
- [ ] Código refatorado (REFACTOR)
- [ ] Todos os testes passando
- [ ] Sem novas advertências de lint
