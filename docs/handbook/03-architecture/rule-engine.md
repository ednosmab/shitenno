---
category: architecture
lifecycle: Active
---

# Rule Engine

O motor de regras permite definir comportamentos reativos baseados em triggers e condições.

---

## Visão Geral

Regras são definidas em JSON e ativadas por triggers específicos, executando ações quando as condições são atendidas.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trigger    │────▶│  Conditions │────▶│   Actions   │
│  (Evento)    │     │  (Boolean)  │     │  (Executar) │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Estrutura de uma Regra

```json
{
  "id": "RULE-001",
  "description": "Descrição da regra",
  "trigger": "session_start",
  "conditions": [
    {
      "type": "glob",
      "pattern": "docs/**/*.md"
    }
  ],
  "actions": [
    {
      "type": "send_notification",
      "params": {
        "message": "Mensagem a enviar"
      }
    }
  ],
  "priority": 3,
  "enabled": true
}
```

---

## Triggers Disponíveis

| Trigger | Descrição |
|---|---|
| `session_start` | Início de sessão |
| `session_end` | Fim de sessão |
| `plan_created` | Novo plano criado |
| `plan_executed` | Plano executado |
| `file_changed` | Arquivo modificado |
| `custom` | Trigger customizado |

---

## Ações Disponíveis

| Ação | Descrição |
|---|---|
| `send_notification` | Enviar notificação |
| `create_reminder` | Criar lembrete |
| `log_event` | Registrar evento |
| `execute_command` | Executar comando |

---

## Criando Regras

### 1. Criar Arquivo JSON

Crie um arquivo em `shitenno/governance/rules/RULE-XXX.json`:

```json
{
  "id": "RULE-XXX",
  "description": "Minha regra customizada",
  "trigger": "session_start",
  "conditions": [],
  "actions": [
    {
      "type": "send_notification",
      "params": {
        "message": "Regra ativada!"
      }
    }
  ],
  "priority": 3,
  "enabled": true
}
```

### 2. Validar Schema

```bash
shugo validate --rule RULE-XXX
```

### 3. Testar

```bash
shugo rule test RULE-XXX
```

---

## Arquitetura

```
src/
├── rule-engine.ts        # Motor de regras
├── rules/
│   ├── RULE-001.json     # Regras padrão
│   └── RULE-HB-001.json  # Regra handbook
└── __tests__/
    └── rule-engine.test.ts # Testes
```
