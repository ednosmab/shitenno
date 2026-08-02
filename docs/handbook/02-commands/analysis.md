---
category: reference
lifecycle: Active
---

# Status & Analysis

Comandos para verificar saúde do projeto, maturidade e padrões.

---

## `shugo status`

Verifica o status de saúde da governança com pontuação de maturidade.

```bash
shugo status [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |
| `--no-cache` | Ignorar cache, recalcular |

### Exemplos

```bash
shugo status              # Relatório completo
shugo status --json       # Saída JSON
shugo status --no-cache   # Recalcular tudo
```

### Dicas

- Mostra pontuação de saúde (0-100), problemas e status do knowledge graph
- Execute periodicamente para acompanhar a saúde da governança ao longo do tempo

---

## `shugo audit`

Audite a saúde da governança, knowledge graph e problemas.

```bash
shugo audit [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON para CI/CD |

### Exemplos

```bash
shugo audit               # Auditoria completa com pontuação
shugo audit --json        # Saída JSON
```

---

## `shugo doctor`

Mentor de engenharia — identifique riscos e sugira melhorias.

```bash
shugo doctor [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo doctor              # Relatório diagnóstico completo
shugo doctor --json       # Saída JSON
```

---

## `shugo assess`

Reavalie a maturidade do projeto e recomende novas capacidades.

```bash
shugo assess [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo assess              # Reavaliação interativa
shugo assess --json       # Saída JSON
```

### Dicas

- Execute quando o projeto cresceu para descobrir novas capacidades

---

## `shugo detect`

Detecte padrões no histórico e proponha regras candidatas.

```bash
shugo detect [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo detect              # Analisar histórico
shugo detect --json       # Saída JSON
```
