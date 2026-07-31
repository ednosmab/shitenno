---
name: error_handling_observability
description: >
  Padrões de tratamento de erros e observabilidade. Use quando o agente for implementar
  tratamento de exceções, logging estruturado, métricas, ou qualquer funcionalidade que
  envolva visibilidade do comportamento do sistema em produção.
---
category: product
lifecycle: Active

# Error Handling & Observability

Padrões para tratamento de erros robusto e observabilidade completa.

---

## Tratamento de Erros

### Princípios

1. **Erro é dado, não exceção** — trate erros como informação valiosa
2. **Nunca engula erros silenciosamente** — sempre registre ou propague
3. **Erros devem ser acionáveis** — quem recebe deve saber o que fazer
4. **Fail fast** —detecte erros o mais cedo possível

### Padrões

```typescript
// ✅ GOOD — Erro com contexto
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error("riskyOperation failed", { error, context: { userId, action } });
  return { success: false, error: sanitizeError(error) };
}

// ❌ BAD — Engolir erro
try {
  await riskyOperation();
} catch (e) {
  // nothing
}
```

---

## Logging Estruturado

### Níveis

| Nível | Quando usar |
|---|---|
| `error` | Falhas que precisam de atenção imediata |
| `warn` | Situações inesperadas mas não críticas |
| `info` | Eventos normais do sistema |
| `debug` | Informações detalhadas para desenvolvimento |

### Formato

```typescript
logger.info("user.login", {
  userId: user.id,
  method: "oauth",
  duration: elapsed,
});
```

---

## Métricas

### tipos importantes

- **Counter** — contagem de eventos (requests, errors)
- **Histogram** — distribuição de valores (latência, tamanho)
- **Gauge** — valor actual (conexões activas, fila)

### Naming

```
<namespace>_<operation>_<unit>
```

Exemplo: `http_request_duration_seconds`

---

## Checklist

- [ ] Erros tratados com contexto suficiente
- [ ] Logging estruturado em pontos-chave
- [ ] Métricas para operações críticas
- [ ] Erros sanitizados antes de expor ao utilizador
