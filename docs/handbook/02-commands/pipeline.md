---
category: reference
lifecycle: Active
---

# Pipeline & Execution

Comandos para executar pipelines de análise e ações de governança.

---

## `shugo run`

Execute o pipeline de análise completo (analisar → pontuar → detectar → auditar → evoluir).

```bash
shugo run [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo run                 # Pipeline completo
shugo run --json          # Saída JSON
```

### Dicas

- Combina todos os estágios de análise em um único comando
- Útil para CI/CD ou verificações de saúde periódicas

---

## `shugo evolve`

Mostre recomendações de evolução e gerencie feedback.

```bash
shugo evolve [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo evolve              # Mostrar recomendações
shugo evolve --json       # Saída JSON
```

---

## `shugo act`

Execute ações com garantias de idempotência.

```bash
shugo act [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `shugo act create` | Criar nova ação |
| `shugo act list` | Listar todas as ações |

### Opções

| Opção | Descrição |
|---|---|
| `--title <title>` | Título da ação |
| `--action-type <type>` | Tipo da ação (bugfix, feature, etc.) |

### Exemplos

```bash
shugo act create --title 'Fix auth' --action-type bugfix
shugo act list            # Listar todas as ações
```

---

## `shugo plan`

Gerencie sequências de ações coordenadas (planos).

```bash
shugo plan <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `shugo plan create <name>` | Criar um plano |
| `shugo plan execute <plan-id>` | Executar um plano |
| `shugo plan list` | Listar todos os planos |
| `shugo plan show <plan-id>` | Mostrar detalhes do plano |
| `shugo plan md prepare <id>` | Preparar pipeline de validação |

### Exemplos

```bash
shugo plan create my-plan           # Criar plano
shugo plan execute plan-001         # Executar plano
shugo plan list                     # Listar planos
shugo plan show plan-001            # Detalhes do plano
shugo plan md prepare plan-001      # Preparar pipeline
```
