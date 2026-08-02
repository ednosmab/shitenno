---
category: architecture
lifecycle: Active
---

# Custom Rules

Guia para criar regras customizadas no Shugo.

---

## Visão Geral

O Shugo permite criar regras customizadas para automatizar fluxos de trabalho específicos do seu projeto.

---

## Passo a Passo

### 1. Entenda o Trigger

Escolha o trigger adequado para a sua necessidade:

| Trigger | Quando Usar |
|---|---|
| `session_start` | Ao iniciar uma sessão de chat |
| `session_end` | Ao encerrar uma sessão |
| `plan_created` | Quando um plano é criado |
| `file_changed` | Quando um arquivo é modificado |

### 2. Defina as Condições

Condições são opcionalizam a execução da regra:

```json
{
  "conditions": [
    {
      "type": "glob",
      "pattern": "src/**/*.ts"
    }
  ]
}
```

### 3. Escolha as Ações

Defina o que acontece quando a regra é ativada:

```json
{
  "actions": [
    {
      "type": "send_notification",
      "params": {
        "message": "Regra ativada!"
      }
    }
  ]
}
```

### 4. Crie o Arquivo JSON

Crie o arquivo em `shitenno/governance/rules/`:

```json
{
  "id": "RULE-CUSTOM-001",
  "description": "Minha regra customizada",
  "trigger": "session_start",
  "conditions": [],
  "actions": [
    {
      "type": "send_notification",
      "params": {
        "message": "Bem-vindo à sessão!"
      }
    }
  ],
  "priority": 3,
  "enabled": true
}
```

### 5. Valide e Teste

```bash
shugo validate --rule RULE-CUSTOM-001
shugo rule test RULE-CUSTOM-001
```

---

## Exemplos

### Regra de Bem-Vindo

```json
{
  "id": "RULE-WELCOME",
  "description": "Mensagem de boas-vindas ao iniciar sessão",
  "trigger": "session_start",
  "actions": [
    {
      "type": "send_notification",
      "params": {
        "message": "👋 Bem-vindo! Use 'shugo status' para verificar a saúde do projeto."
      }
    }
  ]
}
```

### Regra de Notificação de Plano

```json
{
  "id": "RULE-PLAN-NOTIFY",
  "description": "Notificar quando um plano é criado",
  "trigger": "plan_created",
  "actions": [
    {
      "type": "log_event",
      "params": {
        "event": "plan_created",
        "message": "Novo plano detectado"
      }
    }
  ]
}
```

---

## Boas Práticas

1. **IDs únicos**: Use prefixos como `RULE-`, `RULE-HB-`, `RULE-CUSTOM-`
2. **Descrições claras**: Explique o que a regra faz
3. **Prioridades**: Use 1-5 (1 = mais alta)
4. **Teste sempre**: Valide antes de ativar
5. **Documente**: Adicione comentários no arquivo
