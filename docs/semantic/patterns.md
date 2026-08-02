---
category: product
lifecycle: Active
---

# Semantic Patterns

Referência completa dos padrões semânticos detectáveis.

## Visão Geral

O Pattern Matcher detecta 6 tipos de padrões a partir do Change Journal:

| Padrão | Descrição | Critério |
|--------|-----------|----------|
| `architectural_shift` | Mudança arquitetural significativa | 3+ sinais no mesmo domínio |
| `scope_drift` | Expansão além do escopo original | Domínios novos com confiança baixa |
| `security_degradation` | Degradação de segurança | Mudanças de segurança sem testes |
| `tech_debt_accumulation` | Acumulação de dívida técnica | Muitas alterações sem melhorias |
| `capability_gap` | Capacidade necessária mas ausente | Actividade sem governance |
| `maturity_regression` | Queda de maturidade | Sinais de alta confiança sem governance |

## Detalhes de Cada Padrão

### Architectural Shift

**O que detecta:** Múltiplos sinais no mesmo domínio indicam mudança arquitetural significativa.

**Critério:** 3+ sinais no mesmo domínio nas últimas 5 sessões.

**Exemplo:**
```
Sessão 1: dependency.added (pg) → persistence
Sessão 2: file.created (migrations/) → persistence
Sessão 3: config.changed (DATABASE_URL) → persistence
→ architectural_shift detectado em persistence
```

**Acções sugeridas:**
- Rever decisões arquiteturais em {domínio}
- Considerar criar ADR se a mudança for permanente
- Verificar se testes cobrem as alterações

### Scope Drift

**O que detecta:** Novos domínios semânticos aparecem além do escopo original do projecto.

**Critério:** 3+ domínios com confiança < 0.5 em 50 entradas recentes.

**Exemplo:**
```
Projecto original: persistence, api, testing
Actividade recente: frontend, infrastructure, observability (confiança baixa)
→ scope_drift detectado
```

**Acções sugeridas:**
- Rever o escopo original do projecto
- Verificar se novos módulos estão alinhados com o objectivo
- Considerar definir limites de domínio

### Security Degradation

**O que detecta:** Acumulação de sinais de segurança sem testes correspondentes.

**Critério:** 2+ entradas de segurança sem entradas de testing.

**Exemplo:**
```
dependency.added (helmet) → security
dependency.added (cors) → security
// Nenhum teste de segurança
→ security_degradation detectado
```

**Acções sugeridas:**
- Adicionar testes de segurança
- Rever vulnerabilidades potenciais
- Considerar security audit

### Tech Debt Accumulation

**O que detecta:** Múltiplas alterações sem melhorias de testes ou documentação.

**Critério:** 5+ alterações vs 1 ou menos melhorias de qualidade.

**Exemplo:**
```
6 alterações em persistence, api, infrastructure
1 teste criado
→ tech_debt_accumulation detectado
```

**Acções sugeridas:**
- Dedicar tempo a testes e documentação
- Rever dívida técnica acumulada
- Considerar sprint de qualidade

### Capability Gap

**O que detecta:** Actividade num domínio sem a capacidade governance correspondente.

**Critério:** 2+ entradas num domínio sem entradas de governance.

**Exemplo:**
```
dependency.added (pg) → persistence
file.created (migrations/) → persistence
// Nenhuma actividade de governance
→ capability_gap detectado em persistence
```

**Acções sugeridas:**
- Instalar capacidade de {domínio} se necessário
- Rever maturidade do domínio
- Considerar ADR para decisões em aberto

### Maturity Regression

**O que detecta:** Actividade sugere diminuição de maturidade.

**Critério:** 3+ entradas de alta confiança sem governance.

**Exemplo:**
```
3 alterações com confiança > 0.8
Nenhuma actividade de governance
→ maturity_regression detectado
```

**Acções sugeridas:**
- Rever nível de maturidade actual
- Verificar se capabilities estão instaladas
- Considerar executar shugo audit

## Estrutura de Padrão

```typescript
interface DetectedPattern {
  id: string;                    // ID único
  type: PatternType;             // Tipo do padrão
  domain: SemanticDomain;        // Domínio principal
  domains: SemanticDomain[];     // Todos os domínios envolvidos
  confidence: number;            // 0-1, confiança da detecção
  description: string;           // Descrição legível
  signals: string[];             // Sinais que contribuíram
  suggestedActions: string[];    // Acções sugeridas
  detectedAt: string;            // ISO-8601 timestamp
  windowSessions: number;        // Sessões na janela
  evidence: JournalEntry[];      // Entradas do journal
}
```

## Eventos

Quando um padrão é detectado, o evento `semantic.pattern_detected` é publicado:

```typescript
{
  patternId: string;
  patternType: PatternType;
  domain: SemanticDomain;
  confidence: number;
  description: string;
}
```

## Personalização

### Adicionar Novo Padrão

Edite `src/semantic/pattern-rules.ts`:

```typescript
const PATTERN_RULES: PatternRule[] = [
  // ... regras existentes
  {
    type: "my_custom_pattern",
    name: "My Custom Pattern",
    description: "Detects my custom pattern",
    condition: (journal, windowSessions) => {
      const entries = journal.getWindow("my-domain", windowSessions);
      if (entries.length >= 5) {
        return {
          id: `mcp-${Date.now()}`,
          type: "my_custom_pattern",
          domain: "my-domain",
          domains: ["my-domain"],
          confidence: 0.8,
          description: `${entries.length} sinais detectados`,
          signals: [...new Set(entries.flatMap((e) => e.signals))],
          suggestedActions: ["My suggested action"],
          detectedAt: new Date().toISOString(),
          windowSessions,
          evidence: entries.slice(0, 10),
        };
      }
      return null;
    },
  },
];
```

Não se esqueça de adicionar o tipo em `PatternType`:

```typescript
export type PatternType =
  | "architectural_shift"
  // ... tipos existentes
  | "my_custom_pattern";
```
