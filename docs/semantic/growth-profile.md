---
category: product
lifecycle: Active
---

# Semantic Growth Profile

O Semantic Growth Profile é o mecanismo de aprendizagem do Semantic Layer.
Registra como o utilizador responde às apresentações de dual path e adapta
o nível de desafio de acordo com o histórico de escolhas.

## Conceito

Quando o sistema detecta um padrão semântico (ex: "mudança arquitetural em persistence"),
apresenta dois caminhos:

- **Path A (Confortável):** Acção de baixo esforço, ex: "Registar para revisão futura"
- **Path B (Desafiador):** Acção de maior esforço, ex: "Criar ADR agora"

O utilizador escolhe um caminho. O Growth Profile regista essa escolha e adapta
o comportamento futuro.

## Métricas

| Métrica | Descrição | Faixa |
|---------|-----------|-------|
| `growthCapacity` | Capacidade de crescimento do utilizador | 0.0 – 1.0 |
| `challengeLevel` | Nível de desafio actual | 0.0 – 1.0 |
| `patternFrequency` | Frequência de cada tipo de padrão apresentado | Mapa |
| `domainChallengeLevels` | Nível de desafio por domínio semântico | Mapa |

## Padrões de Crescimento

O sistema detecta padrões no comportamento do utilizador:

| Padrão | Condição | Descrição |
|--------|----------|-----------|
| `prefers_growth` | ≥70% escolhas "challenging" | Utilizador aceita desafios frequentemente |
| `prefers_comfort` | ≤30% escolhas "challenging" | Utilizador prefere o caminho confortável |
| `balanced` | 30-70% escolhas "challenging" | Utilizador equilibra conforto e desafio |
| `sporadic_growth` | Dados insuficientes (<3 escolhas) | Padrão por defecto |

## Adaptação

### Crescimento de Capacidade

```
growthCapacity = 0.1 + (ratio_de_challenging × 0.8)
```

Onde `ratio_de_challenging` é a proporção de escolhas "challenging" nas últimas 15.

### Nível de Desafio

```
challengeLevel = growthCapacity × 0.7 + 0.15
```

### Níveis por Domínio

Cada domínio semântico (persistence, security, etc.) tem o seu próprio nível:

- **Escolha "challenging":** `domainLevel += 0.05` (max 1.0)
- **Escolha "comfortable":** `domainLevel -= 0.03` (min 0.0)

Isto permite que o sistema adapte o desafio por área. Por exemplo, se o utilizador
aceita desafios em "security" mas não em "frontend", o sistema ajusta independentemente.

## Persistência

O profile é gravado em `.shitenno/governance/semantic-growth-profile.json`:

```json
{
  "projectId": "default",
  "createdAt": "2026-07-23T10:00:00Z",
  "updatedAt": "2026-07-23T12:00:00Z",
  "growthCapacity": 0.55,
  "challengeLevel": 0.53,
  "pathHistory": [...],
  "patterns": [
    {
      "type": "balanced",
      "confidence": 0.8,
      "description": "User balances semantic comfort and growth"
    }
  ],
  "semanticChoices": [
    {
      "id": "SPC-1234567890-abc123",
      "timestamp": "2026-07-23T11:30:00Z",
      "pathChosen": "challenging",
      "patternType": "architectural_shift",
      "domain": "persistence"
    }
  ],
  "patternFrequency": {
    "architectural_shift": 3,
    "security_degradation": 1
  },
  "domainChallengeLevels": {
    "persistence": 0.65,
    "security": 0.45
  }
}
```

## Exemplo de Fluxo

1. **Sessão 1:** Sistema detecta "architectural_shift" em persistence
2. **Apresentação:** Path A (Registar) vs Path B (Criar ADR)
3. **Escolha:** Utilizador escolhe Path B (challenging)
4. **Registo:** `semanticChoices` adiciona entrada com `patternType: "architectural_shift"`, `domain: "persistence"`
5. **Recálculo:** `growthCapacity` aumenta, `domainChallengeLevels.persistence` aumenta
6. **Sessão 2:** Sistema detecta novo padrão em persistence
7. **Adaptação:** Apresenta Path B com mais destaque (domain level mais alto)

## Integração

O Growth Profile é usado por:

- **Dual Path Presenter** — para adaptar a apresentação dos caminhos
- **Pattern Matcher** — para decidir quais padrões mostrar
- **Daemon** — para logar estado durante consolidação periódica
- **Briefing** — pode incluir resumo do perfil

## Comandos Relacionados

| Comando | Descrição |
|---------|-----------|
| `shugo evolve --comfortable` | Escolhe Path A para uma recomendação |
| `shugo evolve --challenging` | Escolhe Path B para uma recomendação |

As escolhas são registadas automaticamente no Growth Profile.
