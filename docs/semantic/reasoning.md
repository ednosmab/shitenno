---
category: product
lifecycle: Active
---

# Reasoning & Correlation

Como o sistema gera insights de nível superior e detecta correlações cross-system.

## Reasoner

### Conceito

O Reasoner analisa padrões semânticos juntamente com dados de múltiplos subsistemas para gerar insights de nível superior.

### Regras de Raciocínio

| Insight | Descrição | Fontes de Dados |
|---------|-----------|-----------------|
| `architecture_evolution` | Mudanças arquiteturais significativas | Padrões architectural_shift |
| `security_posture_change` | Mudança na postura de segurança | Padrões security_degradation + risk map |
| `scope_expansion` | Expansão do escopo do projecto | Padrões scope_drift |
| `maturity_mismatch` | Incompatibilidade de maturidade | Maturity profile |
| `debt_accumulation` | Acumulação de dívida | Padrões tech_debt + health score |
| `governance_gap` | Gaps de governance | Padrões capability_gap |

### Estrutura de Insight

```typescript
interface SemanticInsight {
  id: string;                    // ID único
  type: InsightType;             // Tipo do insight
  domains: SemanticDomain[];     // Domínios envolvidos
  description: string;           // Descrição legível
  confidence: number;            // 0-1, confiança
  evidence: Evidence[];          // Evidências de múltiplas fontes
  suggestedActions: string[];    // Acções sugeridas
  priority: "urgent" | "high" | "medium" | "low";
  detectedAt: string;            // ISO-8601 timestamp
  sourcePatterns: string[];      // IDs dos padrões fonte
}
```

### Evidência

O Reasoner recolhe evidência de múltiplas fontes:

```typescript
interface Evidence {
  source: "pattern" | "risk" | "maturity" | "knowledge" | "journal" | "health";
  description: string;
  data: Record<string, unknown>;
}
```

### Prioridade

Insights são ordenados por prioridade:
1. **urgent** — requer acção imediata
2. **high** — deve ser tratado em breve
3. **medium** — deve ser planeado
4. **low** — pode ser adiado

### Evento

Quando um insight é gerado, o evento `semantic.insight_detected` é publicado:

```typescript
{
  insightId: string;
  insightType: InsightType;
  domains: SemanticDomain[];
  priority: string;
  confidence: number;
}
```

## Correlator

### Conceito

O Correlator detecta correlações entre subsistemas que um único subsistema não consegue ver.

### Regras de Correlação

| Correlação | Descrição | Fontes |
|------------|-----------|--------|
| `risk_maturity_divergence` | Risco alto com maturidade alta | Risk map + Maturity profile |
| `health_knowledge_mismatch` | Saúde alta mas muitos gaps | Health score + Knowledge debt |
| `domain_isolation` | Domínios sem conexões | Change journal |
| `cascade_effect` | Mudanças rápidas em múltiplos domínios | Change journal |

### Estrutura de Correlação

```typescript
interface Correlation {
  id: string;                    // ID único
  type: CorrelationType;         // Tipo da correlação
  domains: SemanticDomain[];     // Domínios envolvidos
  description: string;           // Descrição legível
  confidence: number;            // 0-1, confiança
  signals: CorrelationSignal[];  // Sinais que geraram
  strength: "weak" | "moderate" | "strong";
}
```

### Exemplos

#### Risk-Maturity Divergence
```
Risk Map: overallScore = 75 (high)
Maturity Profile: overallScore = 65 (high)
→ Risco elevado apesar de maturidade alta — possível deterioração não detectada
```

#### Health-Knowledge Mismatch
```
Health Score: score = 80 (high)
Knowledge Debt: totalGaps = 15 (many)
→ Saúde alta mas 15 gaps de conhecimento — possível false positive
```

#### Domain Isolation
```
Journal: persistence (5 entradas), testing (3 entradas), security (1 entrada)
→ Security está isolado sem conexões com outros domínios
```

#### Cascade Effect
```
Journal: persistence (2 mudanças recentes), api (2 mudanças recentes), security (2 mudanças recentes)
→ Efeito cascata — 3 domínios alterados em sequência rápida
```

## Integração

Tanto o Reasoner como o Correlator são executados no timer de consolidação do daemon (15min):

```typescript
// No daemon/index.ts
const consolidationTimer = setInterval(() => {
  // ... pattern matcher ...

  // Reasoner
  const insights = generateInsights(shitennoDir, projectRoot, patterns, journal);
  for (const insight of insights) {
    bus.publish("semantic.insight_detected", { ... });
  }

  // Correlator
  const correlations = detectCorrelations(shitennoDir, projectRoot, journal);
  // correlations são logadas mas não publicam eventos
}, 15 * 60 * 1000);
```
