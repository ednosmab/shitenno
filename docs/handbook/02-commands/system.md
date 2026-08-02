---
category: reference
lifecycle: Active
---

# System

Comandos de sistema e utilitários.

---

## `shugo validate`

Valide a configuração e integridade do projeto.

```bash
shugo validate [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo validate             # Validação completa
shugo validate --json      # Saída JSON
```

---

## `shugo shell-init`

Inicialize o shell para integração com o Shugo.

```bash
shugo shell-init [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--shell <type>` | Tipo do shell (bash, zsh, fish) |

### Exemplos

```bash
shugo shell-init           # Detectar shell automaticamente
shugo shell-init --shell zsh
```

---

## `shugo handbook`

Acesse o handbook do projeto no terminal.

```bash
shugo handbook [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--level <n>` | Filtrar por nível (1, 2, 3) |
| `--topic <name>` | Abrir tópico específico |
| `--list` | Listar todos os tópicos |
| `--print` | Imprimir conteúdo no terminal |
| `--fill` | Preencher dados semânticos do template |

### Exemplos

```bash
shugo handbook              # TUI interativo
shugo handbook --level 1    # Apenas fundamentos
shugo handbook --level 2    # Apenas comandos
shugo handbook --level 3    # Apenas arquitetura
shugo handbook --list       # Listar tópicos
shugo handbook --print      # Imprimir no terminal
shugo handbook --fill       # Preencher dados semânticos
```

---

## `shugo hooks`

Instalar ou remover git hooks do Shugo.

```bash
shugo hooks [--uninstall] [--dir <path>]
```

### Opções

| Opção | Descrição |
|---|---|
| `--uninstall` | Remover hooks do git |

### Exemplos

```bash
shugo hooks              # Instalar hooks
shugo hooks --uninstall  # Remover hooks
```

---

## `shugo daemon`

Gerir o daemon de automação em background.

```bash
shugo daemon <start|stop|status|restart>
```

### Subcomandos

| Subcomando | Descrição |
|---|---|
| `start` | Iniciar o daemon em background |
| `stop` | Parar o daemon graciosamente |
| `status` | Mostrar PID, uptime, circuit breaker |
| `restart` | Parar e reiniciar |

### O que faz

- Observa arquivos de governança para mudanças
- Auto-arquiva planos concluídos
- Expõe socket IPC para consultas de estado
- Circuit breaker: 5 crashes em 60s activa o breaker

### Exemplos

```bash
shugo daemon start       # Iniciar daemon
shugo daemon stop        # Parar daemon
shugo daemon status      # Ver estado
shugo daemon restart     # Reiniciar
```

---

## `shugo watch`

Log de eventos em tempo real para monitorização de governança.

```bash
shugo watch [--events <types>] [--dir <path>]
```

### Opções

| Opção | Descrição |
|---|---|
| `--events <types>` | Filtrar por tipo de evento (ex: `plan.*,session.*`) |

### Exemplos

```bash
shugo watch                              # Todos os eventos
shugo watch --events plan.*,daemon.*     # Filtrar eventos
```

---

## `shugo events`

Mostrar trace de execução do motor de regras.

```bash
shugo events [--last <n>] [--trigger <type>] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--last <n>` | Últimos N eventos (padrão: 20) |
| `--trigger <type>` | Filtrar por tipo de trigger |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo events                    # Últimos 20 eventos
shugo events --last 50          # Últimos 50
shugo events --trigger session  # Filtrar por session
```

---

## `shugo context`

Contexto completo do projecto para agentes AI.

```bash
shugo context [--json] [--for-agent <name>]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |
| `--for-agent <name>` | Filtrar contexto para um agente |

### Exemplos

```bash
shugo context                    # Contexto completo
shugo context --for-agent plan   # Contexto para agente plan
```

---

## `shugo history`

Ver histórico de estado de engenharia com diffs opcionais.

```bash
shugo history [--from <date>] [--to <date>] [--diff] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--from <date>` | Data inicial (formato ISO) |
| `--to <date>` | Data final (formato ISO) |
| `--diff` | Mostrar diff entre snapshots |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo history                    # Listar snapshots
shugo history --diff             # Com diffs
shugo history --from 2026-07-01  # A partir de data
```

---

## `shugo reminders`

Gerir lembretes de sessão com prioridade e categoria.

```bash
shugo reminders [add|rm|clear] [options]
```

### Subcomandos

| Subcomando | Descrição |
|---|---|
| (nenhum) | Listar todos os lembretes activos |
| `add <msg>` | Adicionar lembrete |
| `rm <index>` | Remover por índice |
| `rm --message <text>` | Remover por mensagem parcial |
| `clear` | Remover todos |

### Opções (add)

| Opção | Descrição |
|---|---|
| `--priority <level>` | Prioridade: high, medium, low (padrão: medium) |
| `--category <cat>` | Categoria: bug, feature, debt, security, docs, infra |
| `--notify` | Enviar notificação desktop |

### Exemplos

```bash
shugo reminders add "Rodar audit" --priority high
shugo reminders add "Fix auth bug" --category bug
shugo reminders rm 1
shugo reminders clear
```

---

## `shugo update`

Detectar mudanças em templates e aplicar actualizações.

```bash
shugo update [--apply] [--dir <path>] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--apply` | Aplicar actualizações detectadas |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo update            # Ver mudanças pendentes
shugo update --apply    # Aplicar actualizações
```

---

## `shugo docs-audit`

Auditar ciclo de vida da documentação e propor organização.

```bash
shugo docs-audit [--apply] [--dir <path>] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--apply` | Aplicar movimentações propostas |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo docs-audit            # Dry-run: ver movimentações
shugo docs-audit --apply    # Aplicar movimentações
```
