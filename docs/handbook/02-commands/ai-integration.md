---
category: reference
lifecycle: Active
---

# AI Integration

Comandos para integração com agentes AI e workflows.

---

## `shugo briefing`

Gere um briefing pré-sessão para agentes AI.

```bash
shugo briefing [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo briefing             # Briefing completo
shugo briefing --json      # Saída JSON
```

### Dicas

- Execute no início de cada sessão de chat com agentes AI
- Fornece contexto do projeto, riscos e regras ativas

---

## `shugo feedback`

Registre feedback de sessão para melhoria contínua.

```bash
shugo feedback [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--outcome <type>` | Resultado da sessão (success, failure, partial) |
| `--notes <text>` | Notas adicionais |
| `--areas <list>` | Áreas afetadas |

### Exemplos

```bash
shugo feedback --outcome success
shugo feedback --outcome failure --notes "Build failed"
shugo feedback --outcome partial --areas "auth,dashboard"
```

---

## `shugo profile`

Gerencie o perfil do usuário para calibrar respostas.

```bash
shugo profile [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo profile              # Ver perfil atual
shugo profile --json       # Saída JSON
```

---

## `shugo dashboard`

Dashboard interativo com visão geral do projeto.

```bash
shugo dashboard [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo dashboard            # Dashboard completo
shugo dashboard --json     # Saída JSON
```

---

## `shugo reminders`

Gerencie lembretes para o usuário.

```bash
shugo reminders [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `shugo reminders list` | Listar lembretes |
| `shugo reminders add` | Adicionar lembrete |
| `shugo reminders remove <id>` | Remover lembrete |

### Exemplos

```bash
shugo reminders list       # Listar lembretes
shugo reminders add "Revisar handbook" --priority medium
shugo reminders remove reminder-001
```
