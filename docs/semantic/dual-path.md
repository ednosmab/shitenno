---
category: product
lifecycle: Active
---

# Dual Path & Growth Profile

Como o sistema apresenta opções e aprende com as escolhas do utilizador.

## Dual Path

### Conceito

Para cada padrão detectado, o sistema apresenta dois caminhos:
- **Path A (Confortável)** — acção de baixo esforço, para revisão futura
- **Path B (Desafiador)** — acção de maior esforço, com benefício de crescimento

### Templates por Padrão

| Padrão | Path A (Confortável) | Path B (Desafiador) |
|--------|---------------------|---------------------|
| architectural_shift | Registrar para revisão futura | Criar ADR agora |
| scope_drift | Rever escopo no próximo planeamento | Re-definir limites de domínio agora |
| security_degradation | Agendar revisão de segurança | Executar audit de segurança agora |
| tech_debt_accumulation | Registar dívida para sprint futuro | Dedicar sprint de qualidade |
| capability_gap | Avaliar necessidade no próximo ciclo | Instalar capacidade agora |
| maturity_regression | Rever maturidade no próximo audit | Executar audit de maturidade agora |

### Estrutura

```typescript
interface SemanticDualPath {
  pattern: DetectedPattern;     // Padrão que originou
  pathA: SemanticPathOption;    // Opção confortável
  pathB: SemanticPathOption;    // Opção desafiadora
  challengeLevel: number;       // Nível de desafio actual
  domainLevel: number;          // Nível para o domínio específico
}

interface SemanticPathOption {
  label: string;                // Título da opção
  description: string;          // Descrição detalhada
  action: string;               // Acção concreta a tomar
  effort: "none" | "low" | "medium" | "high";
  growthBenefit?: string;       // Benefício de crescimento (Path B)
}
```

### Formatação

```typescript
import { createSemanticDualPath, formatSemanticDualPath } from "./semantic/dual-path-presenter.js";

const dualPath = createSemanticDualPath(pattern, profile);
const formatted = formatSemanticDualPath(dualPath);
console.log(formatted);
```

Saída:
```
  ╔══════════════════════════════════════════════════════╗
  ║         SEMANTIC PATTERN — Choose Your Way          ║
  ╚══════════════════════════════════════════════════════╝

  Pattern: 3 sinais de "persistence" detectados nas últimas 5 sessões
  Domain: persistence | Confidence: 80% | Domain Level: 50%

  ┌─ PATH A: COMFORTABLE ───────────────────────────────┐
  │ Registrar para revisão futura (persistence)
  │ Anotar a mudança para revisão numa sessão futura
  │ Effort: None
  │ Action: Criar nota no CHANGELOG ou journal interno
  └────────────────────────────────────────────────────┘

  ┌─ PATH B: CHALLENGING ──────────────────────────────┐
  │ Criar ADR agora (persistence)
  │ Documentar a decisão arquitetural como ADR
  │ Effort: Medium
  │ Growth: Melhora rastreabilidade de decisões arquiteturais
  │ Action: Criar ADR com contexto, decisões e consequências
  └────────────────────────────────────────────────────┘

  Choose: --comfortable or --challenging
```

## Growth Profile

### Conceito

O Growth Profile aprende com as escolhas do utilizador e adapta o nível de desafio.

### Métricas

| Métrica | Descrição | Como é calculada |
|---------|-----------|------------------|
| `growthCapacity` | 0-1, capacidade de crescimento | Ratio de escolhas "challenging" nas últimas 15 |
| `challengeLevel` | 0-1, nível de desafio | `capacity * 0.7 + 0.15` |
| `patternFrequency` | Frequência de padrões | Decaimento exponencial das escolhas |
| `domainChallengeLevels` | Níveis por domínio | +0.05 por "challenging", -0.03 por "comfortable" |

### Persistência

O perfil é persistido em `.shitenno/governance/semantic-growth-profile.json`:

```json
{
  "projectId": "my-project",
  "createdAt": "2026-07-23T02:00:00.000Z",
  "updatedAt": "2026-07-23T03:00:00.000Z",
  "growthCapacity": 0.5,
  "challengeLevel": 0.5,
  "pathHistory": [...],
  "patterns": [{ "type": "balanced", "confidence": 0.5, "description": "..." }],
  "semanticChoices": [...],
  "patternFrequency": {
    "architectural_shift": 3,
    "security_degradation": 1
  },
  "domainChallengeLevels": {
    "persistence": 0.6,
    "security": 0.4
  }
}
```

### Padrões de Crescimento

| Padrão | Descrição | Critério |
|--------|-----------|----------|
| `prefers_comfort` | Utilizador prefere caminho seguro | 70%+ escolhas "comfortable" |
| `prefers_growth` | Utilizador prefere desafios | 70%+ escolhas "challenging" |
| `balanced` | Equilíbrio entre conforto e crescimento | 30-70% "challenging" |
| `sporadic_growth` | Alterna entre caminhos | >60% alternâncias |

### API

```typescript
import {
  loadSemanticGrowthProfile,
  recordSemanticPathChoice,
  getDomainChallengeLevel,
  isDomainChallenging,
} from "./semantic/growth-profile.js";

// Carregar perfil
const profile = loadSemanticGrowthProfile(shitennoDir);

// Registar escolha
const updated = recordSemanticPathChoice(shitennoDir, {
  pathChosen: "challenging",
  patternType: "architectural_shift",
  domain: "persistence",
  context: { command: "evolve", recommendationType: "adr", maturityScore: 50 },
});

// Consultar nível de domínio
const level = getDomainChallengeLevel(profile, "persistence");

// Verificar se domínio é desafiador
const isChallenging = isDomainChallenging(profile, "security");
```

### Adaptação

O sistema adapta-se baseado no histórico:
- **5+ "challenging" seguidos** → sistema aumenta desafio
- **5+ "comfortable" seguidos** → sistema reduz desafio
- **Alternância frequente** → sistema mantém equilíbrio
