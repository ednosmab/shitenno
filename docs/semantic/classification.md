---
category: product
lifecycle: Active
---

# Signal Classification

Como o Signal Classifier funciona e como personalizar regras.

## Visão Geral

O Signal Classifier é um motor determinístico que classifica eventos brutos em domínios semânticos usando regras de padrão regex.

## Fluxo de Classificação

```
Evento Bruto
     │
     ▼
┌────────────────┐
│ Extract Data   │ ← payload, file paths, dependency names
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Apply Rules    │ ← CLASSIFICATION_RULES (35 regras)
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Pick Best      │ ← maior prioridade + confiança
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Classify       │ ← domínio, subdomínio, confiança, evidência
└────────────────┘
```

## Regras de Classificação

Cada regra tem:
- **signal** — tipo de sinal aplicável
- **match** — padrão regex para testar
- **domain** — domínio alvo
- **subdomain** — subdomínio alvo
- **priority** — prioridade (maior = testado primeiro)
- **confidenceBoost** — boost de confiança quando casado

### Exemplo de Regra

```typescript
{
  signal: "dependency.added",
  match: /\b(pg|mysql|sqlite|typeorm|prisma|drizzle)\b/i,
  domain: "persistence",
  subdomain: "database-driver",
  priority: 100,
  confidenceBoost: 0.9,
  description: "Database driver or ORM dependency added",
}
```

## Algoritmo

1. **Extrair dados do evento** — payload, file paths, dependency names
2. **Encontrar regras aplicáveis** — filtrar por tipo de sinal
3. **Testar padrões regex** — contra texto combinado
4. **Ordenar por prioridade** — prioridade + confidenceBoost
5. **Calcular confiança** — baseada em quantas regras casaram
6. **Detectar domínio secundário** — se regras de domínios diferentes casaram

## Personalização

### Adicionar Nova Regra

Edite `src/semantic/rules.ts`:

```typescript
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ... regras existentes
  {
    signal: "file.created",
    match: /(?:src\/my-domain\/)/i,
    domain: "my-domain",
    subdomain: "my-subdomain",
    priority: 85,
    confidenceBoost: 0.8,
    description: "My custom classification rule",
  },
];
```

### Adicionar Novo Domínio

1. Adicione o domínio em `src/semantic/taxonomy.ts`:

```typescript
export type SemanticDomain =
  | "persistence"
  // ... domínios existentes
  | "my-new-domain";
```

2. Adicione subdomínios:

```typescript
export const SUBDOMAINS: SubdomainMap = {
  // ... subdomínios existentes
  "my-new-domain": ["subdomain-1", "subdomain-2"],
};
```

3. Adicione metadados:

```typescript
export const DOMAIN_INFO: Record<SemanticDomain, DomainInfo> = {
  // ... metadados existentes
  "my-new-domain": {
    domain: "my-new-domain",
    label: "My New Domain",
    description: "Description of my new domain",
    keywords: ["keyword1", "keyword2"],
    riskWeight: 0.5,
  },
};
```

## Estatísticas

O classifier mantém estatísticas de classificação:

```typescript
interface ClassifierStats {
  totalClassified: number;      // Total de eventos classificados
  byDomain: Record<SemanticDomain, number>; // Contagem por domínio
  avgConfidence: number;        // Confiança média
}
```

Aceda via:

```typescript
import { getSignalClassifier } from "./semantic/signal-classifier.js";

const classifier = getSignalClassifier();
const stats = classifier.getStats();
console.log(stats.totalClassified);
console.log(stats.byDomain);
```

## Type Safety

O campo `semantic?` é adicionado opcionalmente ao `EventEnvelope`:

```typescript
interface EventEnvelope<T = unknown> {
  type: ShitennoEventType;
  payload: T;
  timestamp: string;
  traceId: TraceId;
  correlationId?: CorrelationId;
  semantic?: SemanticAnnotation;  // NOVO
}

interface SemanticAnnotation {
  domain: string;
  subdomain: string;
  confidence: number;
  evidence: string[];
}
```
