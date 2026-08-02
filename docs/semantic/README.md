# Semantic Layer

O Shitenno Semantic Layer classifica eventos em categorias semânticas significativas, detecta padrões temporais e apresenta dual paths para decisão humana.

## Visão Geral

```
Eventos brutos (76 tipos)
       │
       ▼
┌─────────────────────┐
│  Signal Classifier   │ ← Classifica em domínios semânticos
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Change Journal      │ ← Time-series de classificações
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Matcher     │ ← Detecta padrões temporais
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Reasoner            │ ← Gera insights cross-system
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Dual Path Presenter │ ← Path A (confortável) + Path B (desafiador)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Growth Profile      │ ← Aprende com escolhas do utilizador
└─────────────────────┘
```

## Componentes

| Componente | Ficheiro | Descrição |
|------------|----------|-----------|
| Taxonomia | `src/semantic/taxonomy.ts` | 12 domínios semânticos, subdomínios, tipos de sinais |
| Regras | `src/semantic/rules.ts` | 35 regras de classificação por padrão regex |
| Signal Classifier | `src/semantic/signal-classifier.ts` | Motor de classificação determinístico |
| Change Journal | `src/semantic/change-journal.ts` | Journal temporal JSONL com query e rotação |
| Pattern Rules | `src/semantic/pattern-rules.ts` | 6 regras de detecção de padrões |
| Pattern Matcher | `src/semantic/pattern-matcher.ts` | Motor de detecção com histórico |
| Reasoner | `src/semantic/reasoner.ts` | 6 regras de raciocínio cross-system |
| Correlator | `src/semantic/correlator.ts` | 4 regras de correlação cross-system |
| Growth Profile | `src/semantic/growth-profile.ts` | Perfil de crescimento semântico |
| Dual Path Presenter | `src/semantic/dual-path-presenter.ts` | Apresentador de dual path com 6 templates |

## Como Funciona

### 1. Classificação Semântica

Cada evento é classificado num domínio semântico (persistence, security, auth, etc.) usando regras de padrão regex. A classificação inclui:
- **Domínio primário** — a área semântica principal
- **Subdomínio** — especificidade dentro do domínio
- **Confiança** — 0-1, baseada em quantas regras casaram
- **Evidência** — quais sinais justificaram a classificação

### 2. Change Journal

Classificações são gravadas em JSONL para consulta temporal:
- **Query** — filtrar por domínio, confiança, sinal, período
- **Window** — obter entradas das últimas N sessões
- **Rotação** — automática quando o ficheiro atinge 2MB

### 3. Detecção de Padrões

O Pattern Matcher analisa o journal para detectar:
- **Architectural Shift** — 3+ sinais no mesmo domínio
- **Scope Drift** — domínios novos além do escopo original
- **Security Degradation** — mudanças de segurança sem testes
- **Tech Debt** — muitas alterações sem melhorias de qualidade
- **Capability Gap** — actividade sem governance correspondente
- **Maturity Regression** — sinais de alta confiança sem governance

### 4. Raciocínio Semântico

O Reasoner gera insights de nível superior:
- Connecte padrões com risk map, maturity profile, health score
- Gera acções sugeridas para cada insight
- Prioriza por urgência (urgent > high > medium > low)

### 5. Correlação Cross-System

O Correlator detecta correlações entre subsistemas:
- **Risk-Maturity Divergence** — risco alto com maturidade alta
- **Health-Knowledge Mismatch** — saúde alta mas muitos gaps
- **Domain Isolation** — domínios sem conexões
- **Cascade Effect** — mudanças rápidas em múltiplos domínios

### 6. Dual Path

Cada padrão detectado é apresentado com dois caminhos:
- **Path A (Confortável)** — acção de baixo esforço, para revisão futura
- **Path B (Desafiador)** — acção de maior esforço, com benefício de crescimento

### 7. Growth Profile

O sistema aprende com as escolhas do utilizador:
- **Growth Capacity** — 0-1, baseado no histórico de escolhas
- **Challenge Level** — nível de desafio ajustado
- **Pattern Frequency** — quais padrões são mais frequentes
- **Domain Challenge Levels** — níveis por domínio

## Integração com Daemon

O Semantic Layer é integrado no daemon através do timer de consolidação (15min):

1. **Event Subscriptions** — todos os eventos são classificados no journal
2. **Pattern Detection** — matcher roda no timer de consolidação
3. **Reasoning** — insights são gerados a partir de padrões detectados
4. **Correlation** — correlações cross-system são detectadas
5. **Event Publishing** — `semantic.pattern_detected` e `semantic.insight_detected`

## Eventos

| Evento | Descrição |
|--------|-----------|
| `semantic.pattern_detected` | Padrão semântico detectado |
| `semantic.insight_detected` | Insight de raciocínio gerado |

## Configuração

O Semantic Layer é configurado através de variáveis de ambiente:
- `SHITENNO_WATCH_SOURCE=1` — observa código fonte
- `SHITENNO_WATCH_GIT=1` — observa eventos git

## Ficheiros Gerados

| Ficheiro | Descrição |
|----------|-----------|
| `.shitenno/governance/change-journal.jsonl` | Journal temporal de classificações |
| `.shitenno/governance/semantic-growth-profile.json` | Perfil de crescimento semântico |
