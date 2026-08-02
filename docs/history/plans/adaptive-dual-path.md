---
category: reference
lifecycle: Historical
---

# Plano: Sistema Adaptativo de Dualidade de Caminhos

## Visão

O sistema Shugo mostra **sempre dois caminhos** ao utilizador:
- **Caminho A (Confortável)**: Dentro de como o utilizador actualmente pensa
- **Caminho B (Desafiador)**: Além de como o utilizador pensa — exige crescimento

O utilizador escolhe. O sistema aprende com a escolha e adapta o nível de desafio ao longo do tempo, mantendo o utilizador no "flow state" (Csikszentmihalyi) — nem demasiado confortável, nem demasiado desafiado.

## Princípios Fundamentais

1. **Dualidade Sempre Presente**: Em todo o comando que faz recomendações, mostrar os dois caminhos
2. **Intenção como Motor**: A escolha do utilizador revela a sua intenção de crescer
3. **Aprendizagem Moderada**: Adaptar o nível de desafio a cada ~10 escolhas
4. **Desafio Dual**: Exige gap de conhecimento OU mudança de paradigma
5. **Per-projecto**: Cada projecto tem o seu perfil de crescimento

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    User Interaction                     │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  Path A      │    │  Path B      │                   │
│  │  (Comfort)   │    │  (Challenge) │                   │
│  └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                           │
│         └─────────┬─────────┘                           │
│                   ▼                                     │
│         ┌─────────────────┐                             │
│         │  Choice Record  │                             │
│         └────────┬────────┘                             │
│                  ▼                                      │
│         ┌─────────────────┐                             │
│         │ Growth Profile  │◄─── Analysis                │
│         │  (per-project)  │                             │
│         └────────┬────────┘                             │
│                  ▼                                      │
│         ┌─────────────────┐                             │
│         │ Challenge Level │                             │
│         │   Calculator    │                             │
│         └────────┬────────┘                             │
│                  ▼                                      │
│         ┌─────────────────┐                             │
│         │  Next Dual Path │                             │
│         │   Generation    │                             │
│         └─────────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

## Módulos a Criar

### 1. `src/growth-profile.ts` — Perfil de Crescimento do Utilizador

Responsável por:
- Rastrear escolhas do utilizador (confortável vs desafiador)
- Calcular "growth capacity" (0-1)
- Analisar padrões ao longo do tempo
- Determinar nível de desafio adequado

**Estrutura de Dados:**
```typescript
interface GrowthProfile {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  growthCapacity: number; // 0-1, calculado
  challengeLevel: number; // 0-1, ajustado automaticamente
  pathHistory: PathChoice[];
  patterns: GrowthPattern[];
}

interface PathChoice {
  id: string;
  timestamp: string;
  pathChosen: "comfortable" | "challenging";
  context: {
    command: string;
    recommendationType: string;
    maturityScore: number;
  };
}

interface GrowthPattern {
  type: "prefers_comfort" | "prefers_growth" | "balanced" | "sporadic_growth";
  confidence: number;
  description: string;
}
```

**Funções Principais:**
- `loadGrowthProfile(shitennoDir: string): GrowthProfile`
- `saveGrowthProfile(shitennoDir: string, profile: GrowthProfile): void`
- `recordPathChoice(shitennoDir: string, choice: PathChoice): GrowthProfile`
- `calculateGrowthCapacity(profile: GrowthProfile): number`
- `calculateChallengeLevel(profile: GrowthProfile): number`
- `detectGrowthPatterns(profile: GrowthProfile): GrowthPattern[]`

### 2. `src/challenge-generator.ts` — Gerador de Desafios

Responsável por:
- Tomar uma recomendação "confortável" e gerar a versão "desafiadora"
- Calcular o gap de conhecimento
- Detectar mudança de paradigma necessária
- Garantir que o desafio é alcançável (flow state)

**Funções Principais:**
- `generateChallengingAlternative(comfortable: Recommendation, profile: GrowthProfile): Recommendation`
- `calculateKnowledgeGap(recommendation: Recommendation, state: ShitennoState): KnowledgeGap`
- `detectParadigmShift(recommendation: Recommendation): ParadigmShift | null`
- `ensureFlowState(challenge: number, capacity: number): number`

### 3. `src/dual-path-presenter.ts` — Apresentador de Dualidade

Responsável por:
- Formatar os dois caminhos para output humano
- Formatar os dois caminhos para JSON
- Adicionar contexto explicativo
- Mostrar progressão do utilizador

**Funções Principais:**
- `formatDualPath(comfortable: Recommendation, challenging: Recommendation, profile: GrowthProfile): string`
- `formatDualPathJson(comfortable: Recommendation, challenging: Recommendation, profile: GrowthProfile): object`
- `formatGrowthProgress(profile: GrowthProfile): string`

## Módulos a Modificar

### 4. `src/feedback-loops.ts`

**Mudanças:**
- Adicionar `pathChoice` ao `FeedbackRecord`
- Adicionar `pathChoice` ao `FeedbackSummary`
- Modificar `recordFeedback()` para aceitar pathChoice
- Modificar `updateSummary()` para incluir pathChoice

### 5. `src/auto-evolution.ts`

**Mudanças:**
- Modificar `analyzeEvolution()` para gerar DUAS recomendações por situação
- Carregar Growth Profile para calibrar desafio
- Chamar `generateChallengingAlternative()` para cada recomendação
- Retornar `EvolutionReport` com `dualRecommendations`

### 6. `src/commands/evolve.ts`

**Mudanças:**
- Mostrar dual path para cada recomendação
- Gravar pathChoice quando utilizador escolhe
- Mostrar progressão de crescimento
- Adicionar opção `--comfortable` e `--challenging` para escolha directa

### 7. `src/commands/audit.ts`

**Mudanças:**
- Mostrar dual path para recomendações de saúde
- Gravar pathChoice
- Mostrar como a saúde melhora com crescimento

### 8. `src/commands/status.ts`

**Mudanças:**
- Mostrar dual path para recomendações de status
- Gravar pathChoice
- Mostrar estado actual vs potencial

### 9. `src/commands/detect.ts`

**Mudanças:**
- Mostrar dual path para detecção
- Gravar pathChoice
- Mostrar o que foi detectado vs o que poderia ser detectado

## Testes a Criar

### 10. `src/__tests__/growth-profile.test.ts`
- Testar criação de perfil
- Testar registo de escolhas
- Testar cálculo de growth capacity
- Testar cálculo de challenge level
- Testar detecção de padrões
- Testar persistência

### 11. `src/__tests__/challenge-generator.test.ts`
- Testar geração de alternativa desafiadora
- Testar cálculo de gap de conhecimento
- Testar detecção de mudança de paradigma
- Testar flow state

### 12. `src/__tests__/dual-path-presenter.test.ts`
- Testar formatação humana
- Testar formatação JSON
- Testar formatação de progressão

### 13. Actualizar testes existentes
- `src/__tests__/feedback-loops.test.ts` — adicionar testes de pathChoice
- `src/__tests__/cli-integration.test.ts` — adicionar testes de dual path

## Ordem de Implementação

1. **Criar `src/growth-profile.ts`** — Base de tudo
2. **Criar testes para growth-profile** — Garantir correcto
3. **Criar `src/challenge-generator.ts`** — Gerar desafios
4. **Criar testes para challenge-generator** — Garantir correcto
5. **Modificar `src/feedback-loops.ts`** — Adicionar pathChoice
6. **Actualizar testes de feedback-loops** — Garantir correcto
7. **Criar `src/dual-path-presenter.ts`** — Formatar output
8. **Criar testes para dual-path-presenter** — Garantir correcto
9. **Modificar `src/auto-evolution.ts`** — Gerar dual paths
10. **Modificar `src/commands/evolve.ts`** — Mostrar dual paths
11. **Modificar `src/commands/audit.ts`** — Mostrar dual paths
12. **Modificar `src/commands/status.ts`** — Mostrar dual paths
13. **Modificar `src/commands/detect.ts`** — Mostrar dual paths
14. **Actualizar testes de integração** — Garantir correcto
15. **Executar testes completos** — 226+ testes
16. **Verificar typecheck** — 0 erros
17. **Verificar build** — Compila correctamente

## Critérios de Sucesso

- [ ] Todos os 226+ testes passam
- [ ] Typecheck limpo (0 erros)
- [ ] Build compila correctamente
- [ ] Dualidade visível em todos os comandos
- [ ] Growth Profile persiste por projecto
- [ ] Sistema adapta nível de desafio a cada ~10 escolhas
- [ ] Desafio inclui gap de conhecimento OU mudança de paradigma
- [ ] Output humano claro e informativo
- [ ] Output JSON estruturado
- [ ] Documentação actualizada

## Ficheiros a Criar/Modificar

**Novos (3):**
- `src/growth-profile.ts`
- `src/challenge-generator.ts`
- `src/dual-path-presenter.ts`

**Novos - Testes (3):**
- `src/__tests__/growth-profile.test.ts`
- `src/__tests__/challenge-generator.test.ts`
- `src/__tests__/dual-path-presenter.test.ts`

**Modificados (6):**
- `src/feedback-loops.ts`
- `src/auto-evolution.ts`
- `src/commands/evolve.ts`
- `src/commands/audit.ts`
- `src/commands/status.ts`
- `src/commands/detect.ts`

**Testes Modificados (2):**
- `src/__tests__/feedback-loops.test.ts`
- `src/__tests__/cli-integration.test.ts`

**Total: 14 ficheiros**
