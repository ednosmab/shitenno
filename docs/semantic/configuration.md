---
category: product
lifecycle: Active
---

# Configuração do Semantic Layer

O Semantic Layer é configurado principalmente através de variáveis de ambiente
e da estrutura de ficheiros do Shitenno.

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `SHITENNO_WATCH_SOURCE` | Observa alterações no código fonte (`1` para activar) | `0` (desactivado) |
| `SHITENNO_WATCH_GIT` | Observa eventos git (commit, branch switch) (`1` para activar) | `0` (desactivado) |
| `SHITENNO_PROACTIVE_INTERVAL_MS` | Intervalo do proactive digest em ms | `1800000` (30 min) |

## Ficheiros de Configuração

### Taxonomia Semântica

A taxonomia é definida em `src/semantic/taxonomy.ts` e inclui:

- **12 domínios semânticos** — persistence, authentication, api, security, infrastructure, frontend, testing, documentation, governance, data, performance, observability
- **Subdomínios** — categorias finas dentro de cada domínio
- **Tipos de sinais** — 22 tipos de sinais suportados

### Regras de Classificação

As regras são definidas em `src/semantic/rules.ts`:

- **35 regras** de classificação por padrão regex
- Cada regra tem: sinal, padrão regex, domínio, subdomínio, prioridade, boost de confiança
- Regras são avaliadas por prioridade (maior primeiro); primeira correspondência vence

### Regras de Detecção de Padrões

As regras são definidas em `src/semantic/pattern-rules.ts`:

| Regra | Condição | Threshold |
|-------|----------|-----------|
| `architectural_shift` | 3+ sinais no mesmo domínio nas últimas N sessões | N=5 |
| `scope_drift` | 3+ domínios com classificação incerta + 4+ domínios total | — |
| `security_degradation` | 2+ mudanças de segurança sem testes correspondentes | — |
| `tech_debt_accumulation` | 5+ alterações vs ≤1 melhorias de qualidade | ratio 5:1 |
| `capability_gap` | 2+ sinais num domínio sem governance correspondente | — |
| `maturity_regression` | 3+ alterações de alta confiança sem governance | confidence > 0.8 |

## Ficheiros de Estado

| Ficheiro | Descrição | Formato |
|----------|-----------|---------|
| `.shitenno/governance/change-journal.jsonl` | Journal temporal de classificações | JSONL |
| `.shitenno/governance/semantic-growth-profile.json` | Perfil de crescimento semântico | JSON |

### Change Journal

O journal grava cada classificação semântica como uma linha JSON:

```json
{
  "id": "uuid",
  "timestamp": "2026-07-23T10:00:00Z",
  "sessionId": "session-123",
  "classification": {
    "domain": "persistence",
    "subdomain": "database-driver",
    "confidence": 0.9,
    "evidence": ["Database driver dependency added", "Dependency: pg"],
    "signals": ["dependency.added"]
  },
  "eventCount": 1,
  "files": ["package.json"],
  "signals": ["dependency.added"]
}
```

**Rotação:** Quando o ficheiro atinge 2MB, o journal descarta automaticamente
as entradas mais antigas (mantém últimas 50%).

### Growth Profile

Vide [growth-profile.md](./growth-profile.md) para detalhes completos.

## Personalização

### Adicionar Regras de Classificação

Para adicionar regras personalizadas, edite `src/semantic/rules.ts`:

```typescript
{
  signal: "dependency.added",
  match: /minha-lib/i,           // padrão regex
  domain: "persistence",         // domínio semântico
  subdomain: "database-driver",  // subdomínio
  priority: 100,                 // prioridade (maior = avaliado primeiro)
  confidenceBoost: 0.9,          // boost de confiança (0-1)
  description: "Minha lib de BD",
}
```

### Desactivar Classificação

Para desactivar a classificação semântica, remova as subscrições de eventos
no `src/daemon/index.ts` na função `initEngines`.

### Ajustar Thresholds de Padrões

Para ajustar os thresholds de detecção, edite `src/semantic/pattern-rules.ts`:

```typescript
// Exemplo: aumentar threshold de architectural_shift de 3 para 5
condition: (journal, windowSessions) => {
  const entries = journal.getWindow(domain, windowSessions);
  if (entries.length >= 5) {  // era 3
    // ...
  }
}
```

## Integração com Outros Sistemas

| Sistema | Integração |
|---------|------------|
| **Event Bus** | 22 tipos de eventos são classificados em tempo real |
| **Daemon** | Consolidação periódica (15min) roda pattern matcher, reasoner, correlator |
| **Proactive Engine** | Padrões detectados publicam eventos que o proactive engine pode reagir |
| **Audit** | Pode usar classificações semânticas para priorizar achados |
| **Briefing** | Pode incluir padrões semânticos detectados |
