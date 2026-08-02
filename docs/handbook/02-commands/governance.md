---
category: reference
lifecycle: Active
---

# Governance

Comandos para gerenciar metas, decisões e políticas.

---

## `shugo goal`

Gerencie metas de governança.

```bash
shugo goal <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `shugo goal create` | Criar nova meta |
| `shugo goal list` | Listar todas as metas |
| `shugo goal show <id>` | Mostrar detalhes da meta |

### Opções

| Opção | Descrição |
|---|---|
| `--title <title>` | Título da meta |
| `--priority <level>` | Prioridade (high, medium, low) |

### Exemplos

```bash
shugo goal create --title 'Improve tests' --priority high
shugo goal list            # Listar metas
shugo goal show goal-001   # Detalhes da meta
```

---

## `shugo decide`

Avalie ações propostas usando avaliadores especializados.

```bash
shugo decide <action> [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--category <cat>` | Categoria da decisão |

### Exemplos

```bash
shugo decide "upgrade auth to OAuth2"
shugo decide "add rate limiting" --category security
shugo decide list          # Listar todas as decisões
```

### Dicas

- Avalia risco, impacto, confiança e alinhamento com metas

---

## `shugo policy`

Gerencie e avalie políticas de governança declarativas.

```bash
shugo policy <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `shugo policy list` | Listar todas as políticas |
| `shugo policy evaluate` | Avaliar estado atual contra políticas |

### Exemplos

```bash
shugo policy list          # Listar políticas
shugo policy evaluate      # Avaliar políticas
```
