---
category: architecture
lifecycle: Active
---

# Event System

O sistema de eventos do Shugo é a base para comunicação entre componentes.

---

## Visão Geral

O event bus permite que componentes se comuniquem de forma desacoplada, publicando e subscrevendo eventos.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Componente  │────▶│  Event Bus  │────▶│  Componente  │
│  (Producer)  │     │             │     │  (Consumer)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Tipos de Eventos

| Evento | Descrição | Trigger |
|---|---|---|
| `session_start` | Início de sessão | Chat inicia |
| `session_end` | Fim de sessão | Chat termina |
| `plan_created` | Plano criado | Arquivo .md em plans/ |
| `plan_executed` | Plano executado | Comando plan execute |
| `rule_triggered` | Regra ativada | Condição da regra verdadeira |
| `feedback_received` | Feedback recebido | Comando feedback |

---

## Uso

### Publicar Evento

```typescript
import { eventBus } from './event-bus';

eventBus.publish({
  type: 'plan_created',
  payload: { planId: 'plan-001', path: 'plans/plan-001.md' }
});
```

### Subscrever Evento

```typescript
import { eventBus } from './event-bus';

eventBus.subscribe('plan_created', (event) => {
  console.log(`Plano criado: ${event.payload.planId}`);
});
```

---

## Arquitetura

```
src/
├── event-bus.ts          # Implementação do event bus
├── events/
│   ├── session.ts        # Eventos de sessão
│   ├── plan.ts           # Eventos de plano
│   └── rule.ts           # Eventos de regra
└── __tests__/
    └── event-bus.test.ts # Testes
```
