---
category: reference
lifecycle: Active
---

# Documentation

Comandos para auditoria e manutenção da documentação.

---

## `shugo docs-audit`

Audite a documentação do projeto para inconsistências e problemas.

```bash
shugo docs-audit [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
shugo docs-audit           # Auditoria completa
shugo docs-audit --json    # Saída JSON
```

### Dicas

- Verifica links quebrados, formatação inválida e inconsistências
- Execute periodicamente para manter a documentação saudável
