---
category: reference
lifecycle: Active
---

# Reports & Dashboards

Comandos para visualizar relatórios, dashboards e resumos.

---

## `shugo console`

Console de economia de tokens com métricas de sessão.

```bash
shugo console [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--days <n>` | Últimos N dias |

### Exemplos

```bash
shugo console              # Console completo
shugo console --days 30    # Últimos 30 dias
```

---

## `shugo report`

Gere um relatório de desempenho para o usuário.

```bash
shugo report [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo report               # Relatório completo
shugo report --json        # Saída JSON
```

---

## `shugo digest`

Resumo diário da saúde do projeto e mudanças recentes.

```bash
shugo digest [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo digest               # Digest de hoje
shugo digest --json        # Saída JSON
```

---

## `shugo bench`

Execute benchmarks de performance do sistema.

```bash
shugo bench [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo bench                # Benchmark completo
shugo bench --json         # Saída JSON
```
